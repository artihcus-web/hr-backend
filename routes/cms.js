import express from 'express'
import SiteSettings from '../models/SiteSettings.js'
import Holiday from '../models/Holiday.js'
import { authenticate, requireRole } from '../middleware/auth.js'

const router = express.Router()

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

export default router
