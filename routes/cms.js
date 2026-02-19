import express from 'express'
import multer from 'multer'
import mongoose from 'mongoose'
import { GridFSBucket } from 'mongodb'
import SiteSettings from '../models/SiteSettings.js'
import Holiday from '../models/Holiday.js'
import { authenticate, requireRole } from '../middleware/auth.js'

const router = express.Router()

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/jpg'].includes(file.mimetype)) return cb(null, true)
    cb(new Error('Logo must be PNG or JPEG'))
  }
})

const faviconUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 512 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'image/svg+xml') return cb(null, true)
    cb(new Error('Favicon must be SVG'))
  }
})

function getCmsBucket() {
  const db = mongoose.connection.db
  return db ? new GridFSBucket(db, { bucketName: 'cmsAssets' }) : null
}

const DEFAULT_SETTINGS = {
  sidebarLogoUrl: '',
  appName: 'Artihcus',
  faviconUrl: '',
  holidayCalendarTitle: 'Holiday Calendar',
  holidayCalendarSubtitle: 'Organization holidays'
}

// GET site settings (public or authenticated - no sensitive data)
router.get('/settings', async (req, res) => {
  try {
    let doc = await SiteSettings.findOne()
    if (!doc) {
      doc = await SiteSettings.create(DEFAULT_SETTINGS)
    }
    res.json({
      settings: {
        sidebarLogoUrl: doc.sidebarLogoUrl || DEFAULT_SETTINGS.sidebarLogoUrl,
        appName: doc.appName || DEFAULT_SETTINGS.appName,
        faviconUrl: doc.faviconUrl || DEFAULT_SETTINGS.faviconUrl,
        holidayCalendarTitle: doc.holidayCalendarTitle || DEFAULT_SETTINGS.holidayCalendarTitle,
        holidayCalendarSubtitle: doc.holidayCalendarSubtitle || DEFAULT_SETTINGS.holidayCalendarSubtitle
      }
    })
  } catch (error) {
    console.error('GET /cms/settings error:', error)
    res.status(500).json({ message: 'Failed to load settings' })
  }
})

// PUT site settings (admin only)
router.put('/settings', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { sidebarLogoUrl, appName, faviconUrl, holidayCalendarTitle, holidayCalendarSubtitle } = req.body
    const update = {}
    if (sidebarLogoUrl !== undefined) update.sidebarLogoUrl = String(sidebarLogoUrl)
    if (appName !== undefined) update.appName = String(appName)
    if (faviconUrl !== undefined) update.faviconUrl = String(faviconUrl)
    if (holidayCalendarTitle !== undefined) update.holidayCalendarTitle = String(holidayCalendarTitle)
    if (holidayCalendarSubtitle !== undefined) update.holidayCalendarSubtitle = String(holidayCalendarSubtitle)
    update.updatedBy = req.user._id

    const doc = await SiteSettings.findOneAndUpdate(
      {},
      { $set: update },
      { new: true, upsert: true }
    )
    res.json({
      settings: {
        sidebarLogoUrl: doc.sidebarLogoUrl || '',
        appName: doc.appName || 'Artihcus',
        faviconUrl: doc.faviconUrl || '',
        holidayCalendarTitle: doc.holidayCalendarTitle || 'Holiday Calendar',
        holidayCalendarSubtitle: doc.holidayCalendarSubtitle || 'Organization holidays'
      }
    })
  } catch (error) {
    console.error('PUT /cms/settings error:', error)
    res.status(500).json({ message: 'Failed to save settings' })
  }
})

// GET holidays by year (authenticated)
router.get('/holidays', authenticate, async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear()
    const list = await Holiday.find({ year }).sort({ month: 1, day: 1 }).lean()
    res.json({ holidays: list })
  } catch (error) {
    console.error('GET /cms/holidays error:', error)
    res.status(500).json({ message: 'Failed to load holidays' })
  }
})

// POST create holiday (admin only)
router.post('/holidays', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { year, month, day, name, description } = req.body
    if (year == null || month == null || day == null || !name || !String(name).trim()) {
      return res.status(400).json({ message: 'Year, month, day and name are required' })
    }
    const doc = await Holiday.create({
      year: parseInt(year, 10),
      month: parseInt(month, 10),
      day: parseInt(day, 10),
      name: String(name).trim(),
      description: description ? String(description).trim() : '',
      updatedBy: req.user._id
    })
    res.status(201).json({ holiday: doc })
  } catch (error) {
    console.error('POST /cms/holidays error:', error)
    res.status(500).json({ message: 'Failed to create holiday' })
  }
})

// PUT update holiday (admin only)
router.put('/holidays/:id', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { year, month, day, name, description } = req.body
    const update = {}
    if (year != null) update.year = parseInt(year, 10)
    if (month != null) update.month = parseInt(month, 10)
    if (day != null) update.day = parseInt(day, 10)
    if (name !== undefined) update.name = String(name).trim()
    if (description !== undefined) update.description = String(description).trim()
    update.updatedBy = req.user._id

    const doc = await Holiday.findByIdAndUpdate(req.params.id, { $set: update }, { new: true })
    if (!doc) return res.status(404).json({ message: 'Holiday not found' })
    res.json({ holiday: doc })
  } catch (error) {
    console.error('PUT /cms/holidays/:id error:', error)
    res.status(500).json({ message: 'Failed to update holiday' })
  }
})

// DELETE holiday (admin only)
router.delete('/holidays/:id', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const doc = await Holiday.findByIdAndDelete(req.params.id)
    if (!doc) return res.status(404).json({ message: 'Holiday not found' })
    res.json({ message: 'Holiday deleted' })
  } catch (error) {
    console.error('DELETE /cms/holidays/:id error:', error)
    res.status(500).json({ message: 'Failed to delete holiday' })
  }
})

// GET serve CMS asset (logo or favicon) from GridFS – public
router.get('/assets/:type', async (req, res) => {
  try {
    const type = req.params.type === 'logo' ? 'cms_logo' : req.params.type === 'favicon' ? 'cms_favicon' : null
    if (!type) return res.status(400).json({ message: 'Invalid asset type' })
    const bucket = getCmsBucket()
    if (!bucket) return res.status(503).json({ message: 'Storage not available' })
    const cursor = bucket.find({ 'metadata.assetType': type }).sort({ uploadDate: -1 }).limit(1)
    const files = await cursor.toArray()
    if (!files.length) return res.status(404).json({ message: 'Asset not found' })
    res.set('Content-Type', files[0].contentType || (type === 'cms_favicon' ? 'image/svg+xml' : 'image/png'))
    const stream = bucket.openDownloadStream(files[0]._id)
    stream.pipe(res)
    stream.on('error', (_err) => {
      if (!res.headersSent) res.status(500).json({ message: 'Error streaming asset' })
    })
  } catch (error) {
    console.error('GET /cms/assets/:type error:', error)
    if (!res.headersSent) res.status(500).json({ message: 'Failed to serve asset' })
  }
})

// POST upload logo (admin only) – PNG/JPEG
router.post('/upload/logo', authenticate, requireRole('admin', 'super_admin'), (req, res, next) => {
  logoUpload.single('logo')(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message || 'Invalid logo file' })
    next()
  })
}, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file. Use field name "logo".' })
    const bucket = getCmsBucket()
    if (!bucket) return res.status(503).json({ message: 'Storage not available' })
    const cursor = bucket.find({ 'metadata.assetType': 'cms_logo' })
    const existing = await cursor.toArray()
    for (const f of existing) {
      try { await bucket.delete(f._id) } catch { /* ignore */ }
    }
    const filename = `logo-${Date.now()}.${req.file.mimetype === 'image/png' ? 'png' : 'jpg'}`
    const uploadStream = bucket.openUploadStream(filename, {
      contentType: req.file.mimetype,
      metadata: { assetType: 'cms_logo' }
    })
    uploadStream.end(req.file.buffer)
    await new Promise((resolve, reject) => {
      uploadStream.on('finish', resolve)
      uploadStream.on('error', reject)
    })
    const url = '/api/cms/assets/logo'
    const doc = await SiteSettings.findOneAndUpdate({}, { $set: { sidebarLogoUrl: url, updatedBy: req.user._id } }, { new: true, upsert: true })
    res.json({ url, settings: { sidebarLogoUrl: doc.sidebarLogoUrl, appName: doc.appName, faviconUrl: doc.faviconUrl, holidayCalendarTitle: doc.holidayCalendarTitle, holidayCalendarSubtitle: doc.holidayCalendarSubtitle } })
  } catch (error) {
    console.error('POST /cms/upload/logo error:', error)
    res.status(500).json({ message: 'Failed to upload logo' })
  }
})

// POST upload favicon (admin only) – SVG
router.post('/upload/favicon', authenticate, requireRole('admin', 'super_admin'), (req, res, next) => {
  faviconUpload.single('favicon')(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message || 'Invalid favicon file' })
    next()
  })
}, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file. Use field name "favicon".' })
    const bucket = getCmsBucket()
    if (!bucket) return res.status(503).json({ message: 'Storage not available' })
    const cursor = bucket.find({ 'metadata.assetType': 'cms_favicon' })
    const existing = await cursor.toArray()
    for (const f of existing) {
      try { await bucket.delete(f._id) } catch { /* ignore */ }
    }
    const filename = `favicon-${Date.now()}.svg`
    const uploadStream = bucket.openUploadStream(filename, {
      contentType: 'image/svg+xml',
      metadata: { assetType: 'cms_favicon' }
    })
    uploadStream.end(req.file.buffer)
    await new Promise((resolve, reject) => {
      uploadStream.on('finish', resolve)
      uploadStream.on('error', reject)
    })
    const url = '/api/cms/assets/favicon'
    const doc = await SiteSettings.findOneAndUpdate({}, { $set: { faviconUrl: url, updatedBy: req.user._id } }, { new: true, upsert: true })
    res.json({ url, settings: { sidebarLogoUrl: doc.sidebarLogoUrl, appName: doc.appName, faviconUrl: doc.faviconUrl, holidayCalendarTitle: doc.holidayCalendarTitle, holidayCalendarSubtitle: doc.holidayCalendarSubtitle } })
  } catch (error) {
    console.error('POST /cms/upload/favicon error:', error)
    res.status(500).json({ message: 'Failed to upload favicon' })
  }
})

export default router
