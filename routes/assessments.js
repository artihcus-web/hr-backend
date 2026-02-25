import express from 'express'
import multer from 'multer'
import mongoose from 'mongoose'
import { GridFSBucket } from 'mongodb'
import { ObjectId } from 'mongodb'
import AssessmentAccessRequest from '../models/AssessmentAccessRequest.js'
import AssessmentDepartment from '../models/AssessmentDepartment.js'
import AssessmentModule from '../models/AssessmentModule.js'
import AssessmentTest from '../models/AssessmentTest.js'
import AssessmentTestAttempt from '../models/AssessmentTestAttempt.js'
import AssessmentQuestion from '../models/AssessmentQuestion.js'
import AssessmentKnowledgeNote from '../models/AssessmentKnowledgeNote.js'
import KnowledgeBaseRequest from '../models/KnowledgeBaseRequest.js'
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

function getKnowledgeRequestBucket() {
  const db = mongoose.connection.db
  return db ? new GridFSBucket(db, { bucketName: 'knowledgeRequestDocs' }) : null
}

// Public: Submit access request (from assessments app)
router.post('/access-requests', async (req, res) => {
  try {
    const { employeeId, departmentId } = req.body
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

    let departmentName = ''
    if (departmentId) {
      const dept = await AssessmentDepartment.findById(departmentId).select('name').lean()
      departmentName = dept?.name || ''
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
      employeeId: user.employeeId || trimmedId,
      departmentId: departmentId || undefined,
      departmentName: departmentName || undefined
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
      approvedAt: request.approvedAt,
      departmentId: request.departmentId ? String(request.departmentId) : undefined
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

    // Enrich with user data (fullName, officialEmail) and department
    const enriched = await Promise.all(requests.map(async (r) => {
      const user = await User.findOne({ employeeId: r.employeeId })
        .select('fullName officialEmail employeeId firstName lastName')
      const name = user
        ? (user.fullName || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.officialEmail)
        : r.employeeId
      let departmentName = r.departmentName
      if (!departmentName && r.departmentId) {
        const dept = await AssessmentDepartment.findById(r.departmentId).select('name').lean()
        departmentName = dept?.name || ''
      }
      return {
        _id: r._id,
        id: r._id,
        employeeId: r.employeeId,
        requesterName: name,
        officialEmail: user?.officialEmail || '',
        departmentId: r.departmentId,
        departmentName: departmentName || '',
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

// ========== Departments (public list for Login dropdown + admin CRUD) ==========

// Public: List departments (for Login dropdown and assessments app)
router.get('/departments', async (req, res) => {
  try {
    const departments = await AssessmentDepartment.find({}).sort({ name: 1 }).lean()
    res.json({ departments: departments.map(d => ({ _id: d._id, id: d._id, name: d.name, description: d.description || '' })) })
  } catch (error) {
    console.error('List departments error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Admin: Create department
router.post('/departments', authenticate, requireRole('admin', 'super_admin', 'hr'), async (req, res) => {
  try {
    const { name, description } = req.body
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Department name is required' })
    }
    const department = new AssessmentDepartment({
      name: String(name).trim(),
      description: description ? String(description).trim() : ''
    })
    await department.save()
    res.status(201).json({ department: { _id: department._id, id: department._id, name: department.name, description: department.description } })
  } catch (error) {
    console.error('Create department error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Admin: Delete department (and its modules/tests/questions - cascade)
router.delete('/departments/:id', authenticate, requireRole('admin', 'super_admin', 'hr'), async (req, res) => {
  try {
    const department = await AssessmentDepartment.findById(req.params.id)
    if (!department) return res.status(404).json({ message: 'Department not found' })
    const modules = await AssessmentModule.find({ departmentId: req.params.id }).lean()
    const moduleIds = modules.map(m => m._id)
    const tests = await AssessmentTest.find({ moduleId: { $in: moduleIds } }).lean()
    const testIds = tests.map(t => t._id)
    await AssessmentQuestion.deleteMany({ testId: { $in: testIds } })
    await AssessmentTest.deleteMany({ moduleId: { $in: moduleIds } })
    await AssessmentKnowledgeNote.deleteMany({ moduleId: { $in: moduleIds } })
    await AssessmentModule.deleteMany({ departmentId: req.params.id })
    await AssessmentDepartment.findByIdAndDelete(req.params.id)
    res.json({ message: 'Department deleted' })
  } catch (error) {
    console.error('Delete department error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// ========== Modules (admin + public) ==========

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

// Public: List modules (optional ?departmentId= filter)
router.get('/modules', async (req, res) => {
  try {
    const filter = {}
    if (req.query.departmentId) filter.departmentId = req.query.departmentId
    const modules = await AssessmentModule.find(filter).populate('departmentId', 'name').sort({ createdAt: -1 }).lean()
    res.json({
      modules: modules.map(m => ({
        _id: m._id,
        id: m._id,
        departmentId: m.departmentId?._id || m.departmentId,
        departmentName: m.departmentId?.name || '',
        name: m.name,
        description: m.description || ''
      }))
    })
  } catch (error) {
    console.error('List modules error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Admin: Create module (departmentId required)
router.post('/modules', authenticate, requireRole('admin', 'super_admin', 'hr'), async (req, res) => {
  try {
    const { name, description, departmentId } = req.body
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Module name is required' })
    }
    if (!departmentId) {
      return res.status(400).json({ message: 'Department is required' })
    }
    const department = await AssessmentDepartment.findById(departmentId)
    if (!department) return res.status(400).json({ message: 'Department not found' })
    const module = new AssessmentModule({
      departmentId,
      name: String(name).trim(),
      description: description ? String(description).trim() : ''
    })
    await module.save()
    res.status(201).json({
      module: {
        _id: module._id,
        id: module._id,
        departmentId: module.departmentId,
        departmentName: department.name,
        name: module.name,
        description: module.description
      }
    })
  } catch (error) {
    console.error('Create module error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Public: Get single module (for assessments app)
router.get('/modules/:id', async (req, res) => {
  try {
    const module = await AssessmentModule.findById(req.params.id).populate('departmentId', 'name').lean()
    if (!module) return res.status(404).json({ message: 'Module not found' })
    res.json({
      module: {
        _id: module._id,
        id: module._id,
        departmentId: module.departmentId?._id || module.departmentId,
        departmentName: module.departmentId?.name || '',
        name: module.name,
        description: module.description
      }
    })
  } catch (error) {
    console.error('Get module error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Public: List all tests (for assessments app – select test to take). Returns tests with module and department names.
// Optional query: departmentId – only return tests whose module belongs to this department.
router.get('/tests', async (req, res) => {
  try {
    let filter = {}
    if (req.query.departmentId) {
      const moduleIds = await AssessmentModule.find({ departmentId: req.query.departmentId }).select('_id').lean()
      filter.moduleId = { $in: moduleIds.map(m => m._id) }
    }
    const tests = await AssessmentTest.find(filter)
      .populate('moduleId', 'name departmentId')
      .sort({ order: 1, createdAt: 1 })
      .lean()
    const departmentIds = [...new Set(tests.map(t => t.moduleId?.departmentId).filter(Boolean))]
    const departments = await AssessmentDepartment.find({ _id: { $in: departmentIds } }).select('name').lean()
    const deptByName = Object.fromEntries(departments.map(d => [String(d._id), d.name]))
    res.json({
      tests: tests.map(t => ({
        _id: t._id,
        id: t._id,
        moduleId: t.moduleId?._id || t.moduleId,
        moduleName: t.moduleId?.name || '',
        departmentId: t.moduleId?.departmentId?._id || t.moduleId?.departmentId,
        departmentName: deptByName[String(t.moduleId?.departmentId?._id || t.moduleId?.departmentId)] || '',
        name: t.name,
        description: t.description || '',
        order: t.order
      }))
    })
  } catch (error) {
    console.error('List all tests error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// List tests for a module (admin + public for listing)
router.get('/modules/:moduleId/tests', async (req, res) => {
  try {
    const tests = await AssessmentTest.find({ moduleId: req.params.moduleId }).sort({ order: 1, createdAt: 1 }).lean()
    res.json({ tests: tests.map(t => ({ _id: t._id, id: t._id, moduleId: t.moduleId, name: t.name, description: t.description || '', order: t.order })) })
  } catch (error) {
    console.error('List tests error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Admin: Create test under a module
router.post('/modules/:moduleId/tests', authenticate, requireRole('admin', 'super_admin', 'hr'), async (req, res) => {
  try {
    const module = await AssessmentModule.findById(req.params.moduleId)
    if (!module) return res.status(404).json({ message: 'Module not found' })
    const { name, description } = req.body
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Test name is required' })
    }
    const count = await AssessmentTest.countDocuments({ moduleId: req.params.moduleId })
    const test = new AssessmentTest({
      moduleId: req.params.moduleId,
      name: String(name).trim(),
      description: description ? String(description).trim() : '',
      order: count
    })
    await test.save()
    res.status(201).json({ test: { _id: test._id, id: test._id, moduleId: test.moduleId, name: test.name, description: test.description, order: test.order } })
  } catch (error) {
    console.error('Create test error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Admin: Delete module (and its tests, questions, knowledge notes)
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
    const tests = await AssessmentTest.find({ moduleId: req.params.id }).lean()
    const testIds = tests.map(t => t._id)
    await AssessmentQuestion.deleteMany({ testId: { $in: testIds } })
    await AssessmentTest.deleteMany({ moduleId: req.params.id })
    await AssessmentModule.findByIdAndDelete(req.params.id)
    res.json({ message: 'Module deleted' })
  } catch (error) {
    console.error('Delete module error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// ========== Tests (per module: settings, questions, take test, submit) ==========

// Get one test
router.get('/tests/:id', async (req, res) => {
  try {
    const test = await AssessmentTest.findById(req.params.id).populate('moduleId', 'name departmentId').lean()
    if (!test) return res.status(404).json({ message: 'Test not found' })
    res.json({
      test: {
        _id: test._id,
        id: test._id,
        moduleId: test.moduleId?._id || test.moduleId,
        moduleName: test.moduleId?.name || '',
        name: test.name,
        description: test.description || '',
        order: test.order
      }
    })
  } catch (error) {
    console.error('Get test error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Admin: Update test (name, description)
router.put('/tests/:id', authenticate, requireRole('admin', 'super_admin', 'hr'), async (req, res) => {
  try {
    const test = await AssessmentTest.findById(req.params.id)
    if (!test) return res.status(404).json({ message: 'Test not found' })
    const { name, description } = req.body
    if (name != null) test.name = String(name).trim()
    if (description != null) test.description = String(description).trim()
    await test.save()
    res.json({ test: { _id: test._id, name: test.name, description: test.description } })
  } catch (error) {
    console.error('Update test error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Admin: Delete test (and its questions)
router.delete('/tests/:id', authenticate, requireRole('admin', 'super_admin', 'hr'), async (req, res) => {
  try {
    const test = await AssessmentTest.findById(req.params.id)
    if (!test) return res.status(404).json({ message: 'Test not found' })
    await AssessmentQuestion.deleteMany({ testId: req.params.id })
    await AssessmentTest.findByIdAndDelete(req.params.id)
    res.json({ message: 'Test deleted' })
  } catch (error) {
    console.error('Delete test error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Get test settings (for test-taking or admin)
router.get('/tests/:id/settings', async (req, res) => {
  try {
    const test = await AssessmentTest.findById(req.params.id).select('settings').lean()
    if (!test) return res.status(404).json({ message: 'Test not found' })
    res.json({ settings: test.settings || {} })
  } catch (error) {
    console.error('Get test settings error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Admin: Update test settings
router.put('/tests/:id/settings', authenticate, requireRole('admin', 'super_admin', 'hr'), async (req, res) => {
  try {
    const test = await AssessmentTest.findById(req.params.id)
    if (!test) return res.status(404).json({ message: 'Test not found' })
    const s = req.body || {}
    if (!test.settings) test.settings = {}
    if (s.durationMinutes != null) test.settings.durationMinutes = Number(s.durationMinutes) || 60
    if (s.totalQuestions != null) test.settings.totalQuestions = Math.max(1, Number(s.totalQuestions) || 20)
    if (s.passingScore != null) test.settings.passingScore = Math.min(100, Math.max(0, Number(s.passingScore) || 70))
    if (s.shuffleQuestions != null) test.settings.shuffleQuestions = !!s.shuffleQuestions
    if (s.shuffleOptions != null) test.settings.shuffleOptions = !!s.shuffleOptions
    if (s.showResults != null) test.settings.showResults = !!s.showResults
    if (s.allowRetake != null) test.settings.allowRetake = !!s.allowRetake
    if (s.rules != null) test.settings.rules = String(s.rules)
    await test.save()
    res.json({ settings: test.settings })
  } catch (error) {
    console.error('Update test settings error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Admin: Get test questions (full, with correct answers)
router.get('/tests/:id/questions', authenticate, requireRole('admin', 'super_admin', 'hr'), async (req, res) => {
  try {
    const questions = await AssessmentQuestion.find({ testId: req.params.id }).sort({ order: 1 }).lean()
    res.json({ questions })
  } catch (error) {
    console.error('Get test questions error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Admin: Upload Excel – parse and save questions for a test (replace existing)
router.post('/tests/:id/questions/upload', authenticate, requireRole('admin', 'super_admin', 'hr'), upload.single('file'), async (req, res) => {
  try {
    const test = await AssessmentTest.findById(req.params.id)
    if (!test) return res.status(404).json({ message: 'Test not found' })
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: 'Please upload an Excel file (.xlsx)' })
    }
    const { questions: parsed, errors } = parseAssessmentExcel(req.file.buffer)
    if (parsed.length === 0 && errors.length > 0) {
      return res.status(400).json({ message: 'No valid questions found', errors })
    }
    await AssessmentQuestion.deleteMany({ testId: req.params.id })
    const toInsert = parsed.map((q, i) => ({
      testId: test._id,
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
    console.error('Upload test questions error:', error)
    res.status(500).json({ message: error.message || 'Server error' })
  }
})

// Public: Get test data (settings + questions without correctAnswer) for taking the test
router.get('/tests/:id/test', async (req, res) => {
  try {
    const test = await AssessmentTest.findById(req.params.id).populate('moduleId', 'name').lean()
    if (!test) return res.status(404).json({ message: 'Test not found' })
    const settings = test.settings || {}
    let questions = await AssessmentQuestion.find({ testId: req.params.id }).sort({ order: 1 }).lean()
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
      module: { _id: test.moduleId?._id || test.moduleId, name: test.moduleId?.name || test.name, description: test.description },
      test: { _id: test._id, name: test.name },
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
router.post('/tests/:id/submit', async (req, res) => {
  try {
    const test = await AssessmentTest.findById(req.params.id).populate('moduleId', 'name departmentId').lean()
    if (!test) return res.status(404).json({ message: 'Test not found' })
    const settings = test.settings || {}
    const { answers, meta } = req.body || {}
    if (!Array.isArray(answers)) {
      return res.status(400).json({ message: 'answers array is required' })
    }
    const questionIds = answers.map(a => a.questionId)
    const questions = await AssessmentQuestion.find({ _id: { $in: questionIds }, testId: req.params.id }).lean()
    const byId = Object.fromEntries(questions.map(q => [String(q._id), q]))
    let correctCount = 0
    const questionAttempts = []
    const answeredSet = new Set()
    const visitedSet = new Set((meta?.visitedQuestionIds || []).map(String))
    for (const a of answers) {
      const q = byId[a.questionId]
      if (!q) continue
      const userVal = (a.value != null ? String(a.value).trim() : '')
      const userLower = userVal.toLowerCase()
      const correct = (q.correctAnswer || '').trim()
      const correctLower = correct.toLowerCase()
      let isCorrect = false
      if (q.type === 'mcq' || q.type === 'yes_no') {
        let correctLabel = correct
        if (['a', 'b', 'c', 'd'].includes(correctLower)) {
          correctLabel = correctLower
        } else {
          const opt = (q.options || []).find(o => (o.text || '').toLowerCase() === correctLower)
          if (opt?.label) correctLabel = opt.label.toLowerCase()
        }
        if (userLower === correctLabel) {
          correctCount++
          isCorrect = true
        }
      } else {
        const accepted = correct.split('|').map(s => s.trim().toLowerCase()).filter(Boolean)
        if (accepted.length && accepted.includes(userLower)) {
          correctCount++
          isCorrect = true
        } else if (userLower === correctLower) {
          correctCount++
          isCorrect = true
        }
      }
      if (userVal) answeredSet.add(String(q._id))
      questionAttempts.push({
        questionId: q._id,
        section: q.section || '',
        type: q.type || '',
        text: q.text || '',
        answered: !!userVal,
        visited: visitedSet.has(String(q._id)),
        userAnswer: userVal,
        correctAnswer: correct,
        isCorrect
      })
    }
    const total = questions.length
    const percent = total ? Math.round((correctCount / total) * 100) : 0
    const passingScore = settings.passingScore != null ? Number(settings.passingScore) : 70
    const responsePayload = {
      score: percent,
      correctCount,
      total,
      passed: percent >= passingScore,
      showResults: settings.showResults !== false
    }

    // Persist analytics / attempt record if meta provided with employee + timing
    if (meta && meta.employeeId && meta.startedAt && meta.endedAt) {
      try {
        const startedAt = new Date(meta.startedAt)
        const endedAt = new Date(meta.endedAt)
        const durationSeconds = Math.max(0, Math.round((endedAt - startedAt) / 1000))
        const moduleId = test.moduleId?._id || test.moduleId
        const departmentId = test.moduleId?.departmentId || undefined
        await AssessmentTestAttempt.create({
          employeeId: String(meta.employeeId),
          testId: test._id,
          moduleId,
          departmentId,
          testName: test.name,
          moduleName: test.moduleId?.name || '',
          departmentName: meta.departmentName || '',
          startedAt,
          endedAt,
          durationSeconds,
          endReasonCode: meta.endReasonCode || 'unknown',
          endReasonText: meta.endReasonText || '',
          totalQuestionsServed: total,
          questionsVisitedCount: Array.isArray(meta.visitedQuestionIds) ? meta.visitedQuestionIds.length : 0,
          questionsAnsweredCount: answeredSet.size,
          correctCount,
          scorePercent: percent,
          passed: percent >= passingScore,
          questions: questionAttempts
        })
      } catch (e) {
        console.warn('Failed to save AssessmentTestAttempt:', e.message)
      }
    }

    res.json(responsePayload)
  } catch (error) {
    console.error('Submit test error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// ========== Test Reports / Analytics ==========

// Public (per-user): list my attempts with optional filters
router.get('/reports/my-attempts', async (req, res) => {
  try {
    const employeeId = req.query.employeeId && String(req.query.employeeId).trim()
    if (!employeeId) {
      return res.status(400).json({ message: 'employeeId is required' })
    }
    const filter = { employeeId }
    if (req.query.moduleId) filter.moduleId = req.query.moduleId
    if (req.query.testId) filter.testId = req.query.testId
    if (req.query.from || req.query.to) {
      filter.startedAt = {}
      if (req.query.from) filter.startedAt.$gte = new Date(req.query.from)
      if (req.query.to) filter.startedAt.$lte = new Date(req.query.to)
    }
    const attempts = await AssessmentTestAttempt.find(filter).sort({ startedAt: -1 }).lean()
    res.json({
      attempts: attempts.map(a => ({
        _id: a._id,
        id: a._id,
        employeeId: a.employeeId,
        testId: a.testId,
        moduleId: a.moduleId,
        departmentId: a.departmentId,
        testName: a.testName,
        moduleName: a.moduleName,
        departmentName: a.departmentName,
        startedAt: a.startedAt,
        endedAt: a.endedAt,
        durationSeconds: a.durationSeconds,
        endReasonCode: a.endReasonCode,
        scorePercent: a.scorePercent,
        passed: a.passed
      }))
    })
  } catch (error) {
    console.error('List my attempts error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Public (per-user): get full report for a single attempt
router.get('/reports/attempts/:id', async (req, res) => {
  try {
    const attempt = await AssessmentTestAttempt.findById(req.params.id).lean()
    if (!attempt) return res.status(404).json({ message: 'Report not found' })
    res.json({ attempt })
  } catch (error) {
    console.error('Get attempt report error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Admin: list employees who have at least one attempt
router.get('/reports/employees', authenticate, requireRole('admin', 'super_admin', 'hr'), async (req, res) => {
  try {
    const pipeline = [
      { $group: { _id: '$employeeId', attempts: { $sum: 1 }, lastAttemptAt: { $max: '$startedAt' } } },
      { $sort: { lastAttemptAt: -1 } }
    ]
    const grouped = await AssessmentTestAttempt.aggregate(pipeline)
    res.json({
      employees: grouped.map(g => ({
        employeeId: g._id,
        attempts: g.attempts,
        lastAttemptAt: g.lastAttemptAt
      }))
    })
  } catch (error) {
    console.error('List report employees error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Admin: list attempts for a specific employee with optional filters
router.get('/reports/employees/:employeeId/attempts', authenticate, requireRole('admin', 'super_admin', 'hr'), async (req, res) => {
  try {
    const employeeId = String(req.params.employeeId).trim()
    const filter = { employeeId }
    if (req.query.moduleId) filter.moduleId = req.query.moduleId
    if (req.query.testId) filter.testId = req.query.testId
    if (req.query.from || req.query.to) {
      filter.startedAt = {}
      if (req.query.from) filter.startedAt.$gte = new Date(req.query.from)
      if (req.query.to) filter.startedAt.$lte = new Date(req.query.to)
    }
    const attempts = await AssessmentTestAttempt.find(filter).sort({ startedAt: -1 }).lean()
    res.json({ attempts })
  } catch (error) {
    console.error('List employee attempts error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// ========== Knowledge Base (request-based, per-user, secure view-only) ==========

// Public: Submit a knowledge base request (user requests a document)
router.post('/knowledge-requests', async (req, res) => {
  try {
    const { employeeId, description, title } = req.body
    const desc = (description && String(description).trim()) || ''
    if (!desc) {
      return res.status(400).json({ message: 'Please provide a clear description of the document or content you need.' })
    }
    const trimmedId = (employeeId && String(employeeId).trim()) || ''
    if (!trimmedId) {
      return res.status(400).json({ message: 'Employee ID is required.' })
    }
    const user = await User.findOne({
      $or: [{ employeeId: trimmedId }, { officialEmail: trimmedId.toLowerCase() }]
    }).select('fullName officialEmail employeeId firstName lastName')
    if (!user) {
      return res.status(404).json({ message: 'Employee not found. Please check your Employee ID.' })
    }
    const requesterName = user.fullName || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.officialEmail || trimmedId
    const request = new KnowledgeBaseRequest({
      employeeId: user.employeeId || trimmedId,
      requesterName,
      title: title ? String(title).trim() : '',
      description: desc,
      status: 'pending'
    })
    await request.save()
    res.status(201).json({
      message: 'Your request has been submitted. An admin will review and upload the document when ready.',
      request: {
        _id: request._id,
        id: request._id,
        status: request.status,
        description: request.description,
        createdAt: request.createdAt
      }
    })
  } catch (error) {
    console.error('Knowledge request submit error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Admin: List all knowledge base requests (optional ?status= filter)
router.get('/knowledge-requests', authenticate, requireRole('admin', 'super_admin', 'hr'), async (req, res) => {
  try {
    const filter = {}
    if (req.query.status) filter.status = req.query.status
    const requests = await KnowledgeBaseRequest.find(filter).sort({ createdAt: -1 }).lean()
    res.json({
      requests: requests.map(r => ({
        _id: r._id,
        id: r._id,
        employeeId: r.employeeId,
        requesterName: r.requesterName,
        title: r.title,
        description: r.description,
        status: r.status,
        documentTitle: r.documentTitle,
        fileName: r.fileName,
        createdAt: r.createdAt,
        respondedAt: r.respondedAt
      }))
    })
  } catch (error) {
    console.error('List knowledge requests error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// User: List my knowledge requests (requires employeeId in query - from session)
router.get('/knowledge-requests/my', async (req, res) => {
  try {
    const employeeId = req.query.employeeId && String(req.query.employeeId).trim()
    if (!employeeId) {
      return res.status(400).json({ message: 'Employee ID is required.' })
    }
    const user = await User.findOne({
      $or: [{ employeeId }, { officialEmail: employeeId.toLowerCase() }]
    }).select('employeeId')
    const canonicalId = user?.employeeId || employeeId
    const requests = await KnowledgeBaseRequest.find({ employeeId: canonicalId }).sort({ createdAt: -1 }).lean()
    res.json({
      requests: requests.map(r => ({
        _id: r._id,
        id: r._id,
        title: r.title,
        description: r.description,
        status: r.status,
        documentTitle: r.documentTitle,
        fileName: r.fileName,
        createdAt: r.createdAt,
        respondedAt: r.respondedAt
      }))
    })
  } catch (error) {
    console.error('My knowledge requests error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Admin: Approve request and upload document
router.put('/knowledge-requests/:id/upload', authenticate, requireRole('admin', 'super_admin', 'hr'), notesUpload.single('file'), async (req, res) => {
  try {
    const request = await KnowledgeBaseRequest.findById(req.params.id)
    if (!request) return res.status(404).json({ message: 'Request not found' })
    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request is no longer pending' })
    }
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: 'Please upload a file (PDF, DOC, DOCX, or TXT)' })
    }
    const bucket = getKnowledgeRequestBucket()
    if (!bucket) return res.status(503).json({ message: 'File storage unavailable' })
    const docTitle = (req.body.title || '').trim() || req.file.originalname || 'Document'
    const filename = `kb-${request._id}-${Date.now()}-${(req.file.originalname || 'file').replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const uploadStream = bucket.openUploadStream(filename, {
      metadata: { requestId: String(request._id), employeeId: request.employeeId }
    })
    uploadStream.end(req.file.buffer)
    await new Promise((resolve, reject) => {
      uploadStream.on('finish', resolve)
      uploadStream.on('error', reject)
    })
    request.status = 'approved'
    request.gridFsFileId = uploadStream.id
    request.documentTitle = docTitle
    request.fileName = req.file.originalname || filename
    request.mimeType = req.file.mimetype || 'application/octet-stream'
    request.respondedAt = new Date()
    await request.save()
    res.json({
      message: 'Document uploaded. The requester can now view it (view-only, no download).',
      request: {
        _id: request._id,
        status: request.status,
        documentTitle: request.documentTitle,
        respondedAt: request.respondedAt
      }
    })
  } catch (error) {
    console.error('Knowledge request upload error:', error)
    res.status(500).json({ message: error.message || 'Server error' })
  }
})

// Admin: Reject request
router.put('/knowledge-requests/:id/reject', authenticate, requireRole('admin', 'super_admin', 'hr'), async (req, res) => {
  try {
    const request = await KnowledgeBaseRequest.findById(req.params.id)
    if (!request) return res.status(404).json({ message: 'Request not found' })
    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request is no longer pending' })
    }
    request.status = 'rejected'
    request.respondedAt = new Date()
    await request.save()
    res.json({ message: 'Request rejected', request: { _id: request._id, status: request.status } })
  } catch (error) {
    console.error('Reject knowledge request error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Helper: stream document from a KnowledgeBaseRequest (must be approved with gridFsFileId)
function streamKnowledgeRequestDocument(request, res) {
  const bucket = getKnowledgeRequestBucket()
  if (!bucket) {
    res.status(503).json({ message: 'File storage unavailable' })
    return
  }
  const fileId = request.gridFsFileId && (request.gridFsFileId._id || request.gridFsFileId)
  const oid = fileId instanceof ObjectId ? fileId : new ObjectId(String(fileId))
  res.setHeader('Content-Type', request.mimeType || 'application/octet-stream')
  res.setHeader('Content-Disposition', 'inline')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  res.setHeader('Pragma', 'no-cache')
  const downloadStream = bucket.openDownloadStream(oid)
  downloadStream.on('error', () => { try { res.status(500).end() } catch (_) {} })
  downloadStream.pipe(res)
}

// Secure view: stream document only to the requester. No download; inline display only.
router.get('/knowledge-requests/:id/view', async (req, res) => {
  try {
    const request = await KnowledgeBaseRequest.findById(req.params.id).lean()
    if (!request) return res.status(404).json({ message: 'Not found' })
    if (request.status !== 'approved' || !request.gridFsFileId) {
      return res.status(404).json({ message: 'Document not available' })
    }
    const employeeId = (req.query.employeeId && String(req.query.employeeId).trim()) || ''
    const user = await User.findOne({
      $or: [{ employeeId: employeeId }, { officialEmail: employeeId.toLowerCase() }]
    }).select('employeeId')
    const canonicalId = user?.employeeId || employeeId
    if (request.employeeId !== canonicalId) {
      return res.status(403).json({ message: 'You do not have access to this document.' })
    }
    streamKnowledgeRequestDocument(request, res)
  } catch (error) {
    console.error('Knowledge request view error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Admin: view any approved document (same stream, no download)
router.get('/knowledge-requests/:id/admin-view', authenticate, requireRole('admin', 'super_admin', 'hr'), async (req, res) => {
  try {
    const request = await KnowledgeBaseRequest.findById(req.params.id).lean()
    if (!request) return res.status(404).json({ message: 'Not found' })
    if (request.status !== 'approved' || !request.gridFsFileId) {
      return res.status(404).json({ message: 'Document not available' })
    }
    streamKnowledgeRequestDocument(request, res)
  } catch (error) {
    console.error('Knowledge request admin view error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Admin: Delete a knowledge request (and its file if approved)
router.delete('/knowledge-requests/:id', authenticate, requireRole('admin', 'super_admin', 'hr'), async (req, res) => {
  try {
    const request = await KnowledgeBaseRequest.findById(req.params.id)
    if (!request) return res.status(404).json({ message: 'Request not found' })
    if (request.gridFsFileId) {
      const bucket = getKnowledgeRequestBucket()
      if (bucket) {
        try {
          await bucket.delete(request.gridFsFileId)
        } catch (e) {
          console.warn('GridFS delete error:', e.message)
        }
      }
    }
    await KnowledgeBaseRequest.findByIdAndDelete(req.params.id)
    res.json({ message: 'Request deleted' })
  } catch (error) {
    console.error('Delete knowledge request error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

export default router
