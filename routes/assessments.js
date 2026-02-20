import express from 'express'
import multer from 'multer'
import mongoose from 'mongoose'
import { GridFSBucket } from 'mongodb'
import { ObjectId } from 'mongodb'
import AssessmentAccessRequest from '../models/AssessmentAccessRequest.js'
import AssessmentModule from '../models/AssessmentModule.js'
import AssessmentQuestion from '../models/AssessmentQuestion.js'
import AssessmentKnowledgeNote from '../models/AssessmentKnowledgeNote.js'
import User from '../models/User.js'
import { authenticate, requireRole } from '../middleware/auth.js'
import XLSX from 'xlsx'
import { parseAssessmentExcel } from '../utils/parseAssessmentExcel.js'

const router = express.Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.originalname?.toLowerCase().endsWith('.xlsx')
    cb(null, !!ok)
  }
})

const notesUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ]
    const ok = allowed.includes(file.mimetype) ||
      /\.(pdf|doc|docx|txt)$/i.test(file.originalname || '')
    cb(null, !!ok)
  }
})

function getAssessmentNotesBucket() {
  const db = mongoose.connection.db
  return db ? new GridFSBucket(db, { bucketName: 'assessmentNotes' }) : null
}

// Public: Submit access request (from assessments app)
router.post('/access-requests', async (req, res) => {
  try {
    const { employeeId } = req.body
    if (!employeeId || !String(employeeId).trim()) {
      return res.status(400).json({ message: 'Employee ID is required' })
    }

    const trimmedId = String(employeeId).trim()

    // Verify employee exists in User collection
    const user = await User.findOne({
      $or: [{ employeeId: trimmedId }, { officialEmail: trimmedId.toLowerCase() }]
    }).select('fullName officialEmail employeeId')

    if (!user) {
      return res.status(404).json({ message: 'Employee not found. Please check your Employee ID.' })
    }

    // Check for existing pending request (one at a time per employee)
    const existing = await AssessmentAccessRequest.findOne({
      employeeId: user.employeeId || trimmedId,
      status: 'pending'
    })
    if (existing) {
      return res.status(400).json({ message: 'You already have a pending access request.' })
    }

    // Each new session requires fresh approval - no auto-access for previously approved users
    const request = new AssessmentAccessRequest({
      employeeId: user.employeeId || trimmedId
    })
    await request.save()

    res.status(201).json({
      message: 'Access request submitted. An admin will review it shortly.',
      requestId: request._id,
      status: 'pending'
    })
  } catch (error) {
    console.error('Assessment access request error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Public: Check access status (for polling from assessments app)
router.get('/access-requests/check/:employeeId', async (req, res) => {
  try {
    const raw = decodeURIComponent(req.params.employeeId || '').trim()
    if (!raw) {
      return res.status(400).json({ message: 'Employee ID is required' })
    }

    // Resolve canonical employeeId (user may enter employeeId or email)
    const user = await User.findOne({
      $or: [{ employeeId: raw }, { officialEmail: raw.toLowerCase() }]
    }).select('employeeId')
    const canonicalId = user?.employeeId || raw

    const request = await AssessmentAccessRequest.findOne({ employeeId: canonicalId })
      .sort({ createdAt: -1 })

    if (!request) {
      return res.json({ status: 'none', message: 'No request found' })
    }

    res.json({
      status: request.status,
      requestId: request._id,
      approvedAt: request.approvedAt
    })
  } catch (error) {
    console.error('Check access status error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Admin: List pending access requests
router.get('/access-requests', authenticate, requireRole('admin', 'super_admin', 'hr'), async (req, res) => {
  try {
    const requests = await AssessmentAccessRequest.find({ status: 'pending' })
      .sort({ createdAt: -1 })
      .populate('approvedBy', 'fullName')

    // Enrich with user data (fullName, officialEmail) from User
    const enriched = await Promise.all(requests.map(async (r) => {
      const user = await User.findOne({ employeeId: r.employeeId })
        .select('fullName officialEmail employeeId firstName lastName')
      const name = user
        ? (user.fullName || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.officialEmail)
        : r.employeeId
      return {
        _id: r._id,
        id: r._id,
        employeeId: r.employeeId,
        requesterName: name,
        officialEmail: user?.officialEmail || '',
        createdAt: r.createdAt,
        status: r.status
      }
    }))

    res.json({ requests: enriched })
  } catch (error) {
    console.error('List access requests error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Admin: Approve access request
router.put('/access-requests/:id/approve', authenticate, requireRole('admin', 'super_admin', 'hr'), async (req, res) => {
  try {
    const request = await AssessmentAccessRequest.findById(req.params.id)
    if (!request) {
      return res.status(404).json({ message: 'Request not found' })
    }
    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request is no longer pending' })
    }

    request.status = 'approved'
    request.approvedBy = req.user._id
    request.approvedAt = new Date()
    await request.save()

    res.json({
      message: 'Access approved',
      request: {
        _id: request._id,
        employeeId: request.employeeId,
        status: request.status,
        approvedAt: request.approvedAt
      }
    })
  } catch (error) {
    console.error('Approve access request error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Admin: Reject access request
router.put('/access-requests/:id/reject', authenticate, requireRole('admin', 'super_admin', 'hr'), async (req, res) => {
  try {
    const request = await AssessmentAccessRequest.findById(req.params.id)
    if (!request) {
      return res.status(404).json({ message: 'Request not found' })
    }
    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request is no longer pending' })
    }

    request.status = 'rejected'
    request.rejectedBy = req.user._id
    request.rejectedAt = new Date()
    await request.save()

    res.json({
      message: 'Access rejected',
      request: {
        _id: request._id,
        employeeId: request.employeeId,
        status: request.status
      }
    })
  } catch (error) {
    console.error('Reject access request error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// ========== Modules (admin + public for test-taking) ==========

// Public: Download Excel template for questions upload
router.get('/questions-template', (_req, res) => {
  try {
    const rows = [
      ['SECTION', 'TYPE', 'QUESTION', 'OPTION_A', 'OPTION_B', 'OPTION_C', 'OPTION_D', 'CORRECT_ANSWER'],
      ['Multiple Choice', 'mcq', 'What is 2+2?', '3', '4', '5', '6', 'B'],
      ['Yes or No', 'yes_no', 'Is the sky blue?', 'Yes', 'No', '', '', 'Yes'],
      ['Fill in the Blanks', 'fill_blanks', 'The capital of India is _____.', '', '', '', '', 'New Delhi'],
      ['Short Answer', 'short_answer', 'Name one planet.', '', '', '', '', 'Earth|Mars|Jupiter'],
      ['Long Answer', 'long_answer', 'Describe the water cycle in one sentence.', '', '', '', '', 'Water evaporates, condenses, and falls as rain.']
    ]
    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Questions')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename=assessment_questions_template.xlsx')
    res.send(buf)
  } catch (error) {
    console.error('Template download error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Public: List modules (for assessments app – select module to take test)
router.get('/modules', async (req, res) => {
  try {
    const modules = await AssessmentModule.find({}).sort({ createdAt: -1 }).lean()
    res.json({ modules: modules.map(m => ({ _id: m._id, id: m._id, name: m.name, description: m.description || '' })) })
  } catch (error) {
    console.error('List modules error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Admin: Create module
router.post('/modules', authenticate, requireRole('admin', 'super_admin', 'hr'), async (req, res) => {
  try {
    const { name, description } = req.body
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Module name is required' })
    }
    const module = new AssessmentModule({
      name: String(name).trim(),
      description: description ? String(description).trim() : ''
    })
    await module.save()
    res.status(201).json({ module: { _id: module._id, id: module._id, name: module.name, description: module.description } })
  } catch (error) {
    console.error('Create module error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Public: Get single module (for assessments app)
router.get('/modules/:id', async (req, res) => {
  try {
    const module = await AssessmentModule.findById(req.params.id).lean()
    if (!module) return res.status(404).json({ message: 'Module not found' })
    res.json({ module: { _id: module._id, id: module._id, name: module.name, description: module.description } })
  } catch (error) {
    console.error('Get module error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Admin: Delete module (and its questions and knowledge notes)
router.delete('/modules/:id', authenticate, requireRole('admin', 'super_admin', 'hr'), async (req, res) => {
  try {
    const module = await AssessmentModule.findById(req.params.id)
    if (!module) return res.status(404).json({ message: 'Module not found' })
    const notes = await AssessmentKnowledgeNote.find({ moduleId: req.params.id }).lean()
    const bucket = getAssessmentNotesBucket()
    if (bucket) {
      for (const note of notes) {
        try {
          await bucket.delete(note.gridFsFileId)
        } catch (e) {
          console.warn('GridFS delete note file:', e.message)
        }
      }
    }
    await AssessmentKnowledgeNote.deleteMany({ moduleId: req.params.id })
    await AssessmentQuestion.deleteMany({ moduleId: req.params.id })
    await AssessmentModule.findByIdAndDelete(req.params.id)
    res.json({ message: 'Module deleted' })
  } catch (error) {
    console.error('Delete module error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Public: Get module settings (for test-taking)
router.get('/modules/:id/settings', async (req, res) => {
  try {
    const module = await AssessmentModule.findById(req.params.id).select('settings').lean()
    if (!module) return res.status(404).json({ message: 'Module not found' })
    res.json({ settings: module.settings || {} })
  } catch (error) {
    console.error('Get settings error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Admin: Update module settings
router.put('/modules/:id/settings', authenticate, requireRole('admin', 'super_admin', 'hr'), async (req, res) => {
  try {
    const module = await AssessmentModule.findById(req.params.id)
    if (!module) return res.status(404).json({ message: 'Module not found' })
    const s = req.body || {}
    if (!module.settings) module.settings = {}
    if (s.durationMinutes != null) module.settings.durationMinutes = Number(s.durationMinutes) || 60
    if (s.totalQuestions != null) module.settings.totalQuestions = Math.max(1, Number(s.totalQuestions) || 20)
    if (s.passingScore != null) module.settings.passingScore = Math.min(100, Math.max(0, Number(s.passingScore) || 70))
    if (s.shuffleQuestions != null) module.settings.shuffleQuestions = !!s.shuffleQuestions
    if (s.shuffleOptions != null) module.settings.shuffleOptions = !!s.shuffleOptions
    if (s.showResults != null) module.settings.showResults = !!s.showResults
    if (s.allowRetake != null) module.settings.allowRetake = !!s.allowRetake
    if (s.rules != null) module.settings.rules = String(s.rules)
    await module.save()
    res.json({ settings: module.settings })
  } catch (error) {
    console.error('Update settings error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Admin: Get module questions (full, with correct answers – for admin UI)
router.get('/modules/:id/questions', authenticate, requireRole('admin', 'super_admin', 'hr'), async (req, res) => {
  try {
    const questions = await AssessmentQuestion.find({ moduleId: req.params.id }).sort({ order: 1 }).lean()
    res.json({ questions })
  } catch (error) {
    console.error('Get questions error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Admin: Upload Excel – parse and save questions (replace existing for this module)
router.post('/modules/:id/questions/upload', authenticate, requireRole('admin', 'super_admin', 'hr'), upload.single('file'), async (req, res) => {
  try {
    const module = await AssessmentModule.findById(req.params.id)
    if (!module) return res.status(404).json({ message: 'Module not found' })
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: 'Please upload an Excel file (.xlsx)' })
    }
    const { questions: parsed, errors } = parseAssessmentExcel(req.file.buffer)
    if (parsed.length === 0 && errors.length > 0) {
      return res.status(400).json({ message: 'No valid questions found', errors })
    }
    await AssessmentQuestion.deleteMany({ moduleId: req.params.id })
    const toInsert = parsed.map((q, i) => ({
      moduleId: module._id,
      section: q.section,
      type: q.type,
      text: q.text,
      options: q.options,
      correctAnswer: q.correctAnswer,
      order: q.order !== undefined ? q.order : i
    }))
    if (toInsert.length > 0) {
      await AssessmentQuestion.insertMany(toInsert)
    }
    res.json({
      message: `Uploaded ${parsed.length} question(s)`,
      count: parsed.length,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    console.error('Upload questions error:', error)
    res.status(500).json({ message: error.message || 'Server error' })
  }
})

// Public: Get test data (module + settings + questions without correctAnswer) for taking the test
router.get('/modules/:id/test', async (req, res) => {
  try {
    const module = await AssessmentModule.findById(req.params.id).lean()
    if (!module) return res.status(404).json({ message: 'Module not found' })
    const settings = module.settings || {}
    let questions = await AssessmentQuestion.find({ moduleId: req.params.id }).sort({ order: 1 }).lean()
    const totalWanted = Math.max(1, settings.totalQuestions || 20)
    if (settings.shuffleQuestions) {
      for (let i = questions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [questions[i], questions[j]] = [questions[j], questions[i]]
      }
    }
    questions = questions.slice(0, totalWanted)
    if (settings.shuffleOptions && questions.length > 0) {
      questions = questions.map(q => {
        if (!q.options || q.options.length < 2) return q
        const opts = [...q.options]
        for (let i = opts.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [opts[i], opts[j]] = [opts[j], opts[i]]
        }
        return { ...q, options: opts }
      })
    }
    const safe = questions.map(q => {
      // eslint-disable-next-line no-unused-vars -- omit correctAnswer from client response
      const { correctAnswer, ...rest } = q
      return rest
    })
    res.json({
      module: { _id: module._id, name: module.name, description: module.description },
      settings: {
        durationMinutes: settings.durationMinutes || 60,
        passingScore: settings.passingScore || 70,
        showResults: settings.showResults !== false,
        rules: settings.rules || ''
      },
      questions: safe
    })
  } catch (error) {
    console.error('Get test error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Public: Submit test answers and get score
router.post('/modules/:id/submit', async (req, res) => {
  try {
    const module = await AssessmentModule.findById(req.params.id).lean()
    if (!module) return res.status(404).json({ message: 'Module not found' })
    const settings = module.settings || {}
    const { answers } = req.body || {}
    if (!Array.isArray(answers)) {
      return res.status(400).json({ message: 'answers array is required' })
    }
    const questionIds = answers.map(a => a.questionId)
    const questions = await AssessmentQuestion.find({ _id: { $in: questionIds }, moduleId: req.params.id }).lean()
    const byId = Object.fromEntries(questions.map(q => [String(q._id), q]))
    let correctCount = 0
    for (const a of answers) {
      const q = byId[a.questionId]
      if (!q) continue
      const userVal = (a.value != null ? String(a.value).trim() : '')
      const userLower = userVal.toLowerCase()
      const correct = (q.correctAnswer || '').trim()
      const correctLower = correct.toLowerCase()
      if (q.type === 'mcq' || q.type === 'yes_no') {
        let correctLabel = correct
        if (['a', 'b', 'c', 'd'].includes(correctLower)) {
          correctLabel = correctLower
        } else {
          const opt = (q.options || []).find(o => (o.text || '').toLowerCase() === correctLower)
          if (opt?.label) correctLabel = opt.label.toLowerCase()
        }
        if (userLower === correctLabel) correctCount++
      } else {
        const accepted = correct.split('|').map(s => s.trim().toLowerCase()).filter(Boolean)
        if (accepted.length && accepted.includes(userLower)) correctCount++
        else if (userLower === correctLower) correctCount++
      }
    }
    const total = questions.length
    const percent = total ? Math.round((correctCount / total) * 100) : 0
    const passingScore = settings.passingScore != null ? Number(settings.passingScore) : 70
    res.json({
      score: percent,
      correctCount,
      total,
      passed: percent >= passingScore,
      showResults: settings.showResults !== false
    })
  } catch (error) {
    console.error('Submit test error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// ========== Knowledge Base (notes per module) ==========

// Public: List knowledge base notes (optional ?moduleId= for filter)
router.get('/knowledge-base', async (req, res) => {
  try {
    const { moduleId } = req.query
    const filter = {}
    if (moduleId) filter.moduleId = moduleId
    const notes = await AssessmentKnowledgeNote.find(filter)
      .populate('moduleId', 'name')
      .sort({ createdAt: -1 })
      .lean()
    const items = notes.map(n => ({
      _id: n._id,
      id: n._id,
      moduleId: n.moduleId?._id || n.moduleId,
      moduleName: n.moduleId?.name || '',
      title: n.title || n.fileName,
      fileName: n.fileName,
      mimeType: n.mimeType,
      createdAt: n.createdAt
    }))
    res.json({ items })
  } catch (error) {
    console.error('List knowledge base error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Admin: Upload a notes document for a module
router.post('/knowledge-base', authenticate, requireRole('admin', 'super_admin', 'hr'), notesUpload.single('file'), async (req, res) => {
  try {
    const moduleId = req.body.moduleId || req.body.module
    if (!moduleId) {
      return res.status(400).json({ message: 'Module is required' })
    }
    const module = await AssessmentModule.findById(moduleId)
    if (!module) return res.status(404).json({ message: 'Module not found' })
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: 'Please upload a file (PDF, DOC, DOCX, or TXT)' })
    }
    const bucket = getAssessmentNotesBucket()
    if (!bucket) return res.status(503).json({ message: 'File storage unavailable' })
    const title = (req.body.title || '').trim() || req.file.originalname || 'Note'
    const filename = `${moduleId}-${Date.now()}-${(req.file.originalname || 'file').replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const uploadStream = bucket.openUploadStream(filename, {
      metadata: { moduleId: String(moduleId), title }
    })
    uploadStream.end(req.file.buffer)
    await new Promise((resolve, reject) => {
      uploadStream.on('finish', resolve)
      uploadStream.on('error', reject)
    })
    const note = new AssessmentKnowledgeNote({
      moduleId,
      title,
      fileName: req.file.originalname || filename,
      mimeType: req.file.mimetype || 'application/octet-stream',
      gridFsFileId: uploadStream.id
    })
    await note.save()
    res.status(201).json({
      message: 'Note uploaded',
      item: {
        _id: note._id,
        id: note._id,
        moduleId: note.moduleId,
        moduleName: module.name,
        title: note.title,
        fileName: note.fileName,
        mimeType: note.mimeType,
        createdAt: note.createdAt
      }
    })
  } catch (error) {
    console.error('Upload knowledge base error:', error)
    res.status(500).json({ message: error.message || 'Server error' })
  }
})

// Public: Download / view a knowledge base note (stream from GridFS)
router.get('/knowledge-base/:id/download', async (req, res) => {
  try {
    const note = await AssessmentKnowledgeNote.findById(req.params.id).populate('moduleId', 'name').lean()
    if (!note) return res.status(404).json({ message: 'Note not found' })
    const bucket = getAssessmentNotesBucket()
    if (!bucket) return res.status(503).json({ message: 'File storage unavailable' })
    const fileId = note.gridFsFileId && (note.gridFsFileId._id || note.gridFsFileId)
    const oid = fileId instanceof ObjectId ? fileId : new ObjectId(String(fileId))
    const files = await bucket.find({ _id: oid }).toArray()
    if (!files.length) return res.status(404).json({ message: 'File not found' })
    const safeName = (note.fileName || 'download').replace(/[^a-zA-Z0-9._-]/g, '_')
    res.setHeader('Content-Type', note.mimeType || 'application/octet-stream')
    res.setHeader('Content-Disposition', `inline; filename="${safeName}"`)
    const downloadStream = bucket.openDownloadStream(oid)
    downloadStream.pipe(res)
  } catch (error) {
    console.error('Download knowledge base error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Admin: Delete a knowledge base note
router.delete('/knowledge-base/:id', authenticate, requireRole('admin', 'super_admin', 'hr'), async (req, res) => {
  try {
    const note = await AssessmentKnowledgeNote.findById(req.params.id)
    if (!note) return res.status(404).json({ message: 'Note not found' })
    const bucket = getAssessmentNotesBucket()
    if (bucket) {
      try {
        await bucket.delete(note.gridFsFileId)
      } catch (e) {
        console.warn('GridFS delete error:', e.message)
      }
    }
    await AssessmentKnowledgeNote.findByIdAndDelete(req.params.id)
    res.json({ message: 'Note deleted' })
  } catch (error) {
    console.error('Delete knowledge base error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

export default router
