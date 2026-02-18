import express from 'express'
import AssessmentAccessRequest from '../models/AssessmentAccessRequest.js'
import User from '../models/User.js'
import { authenticate, requireRole } from '../middleware/auth.js'

const router = express.Router()

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

export default router
