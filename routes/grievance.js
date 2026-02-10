import express from 'express'
import Grievance from '../models/Grievance.js'
import GrievanceType from '../models/GrievanceType.js'

import ActivityLog from '../models/ActivityLog.js'
import { authenticate, requireRole } from '../middleware/auth.js'

const router = express.Router()

// --- Public / Employee Routes ---

// Get Issue Types (for dropdown)
router.get('/types', authenticate, async (req, res) => {
    try {
        const types = await GrievanceType.find({ isActive: true })
            .select('name _id')
        res.json({ types })
    } catch (error) {
        console.error('Error fetching grievance types:', error)
        res.status(500).json({ message: 'Server error fetching types' })
    }
})

// Check if current user is an assigned handler
router.get('/check-handler', authenticate, async (req, res) => {
    try {
        const isHandler = await GrievanceType.exists({ assignedHrs: req.user._id })
        res.json({ isHandler: !!isHandler })
    } catch (error) {
        console.error('Check handler error:', error)
        res.status(500).json({ message: 'Server error checking role' })
    }
})

// Create Grievance (Dynamic Routing)
router.post('/', authenticate, async (req, res) => {
    try {
        const { issueTypeId, subject, description } = req.body

        if (!issueTypeId || !subject || !description) {
            return res.status(400).json({ message: 'Issue Type, subject, and description are required' })
        }

        // 1. Find the Issue Type and its assigned HRs
        const issueType = await GrievanceType.findById(issueTypeId)
        if (!issueType) {
            return res.status(404).json({ message: 'Invalid Issue Type' })
        }

        if (!issueType.assignedHrs || issueType.assignedHrs.length === 0) {
            return res.status(400).json({ message: 'No HRs assigned to manage this issue type. Please contact Admin.' })
        }

        // 2. Create Grievance
        const grievance = new Grievance({
            sender: req.user._id,
            recipients: issueType.assignedHrs, // Send to ALL assigned HRs
            issueType: issueTypeId,
            subject,
            description
        })

        await grievance.save()

        // 3. Log Activity
        await ActivityLog.create({
            user: req.user._id,
            action: 'GRIEVANCE_RAISED',
            description: `Raised grievance (${issueType.name}): ${subject}`,
            target: grievance._id.toString()
        })

        // 4. Send Email Notifications (Async - don't block response)
        const populatedType = await GrievanceType.findById(issueTypeId).populate('assignedHrs', 'officialEmail fullName')

        if (populatedType && populatedType.assignedHrs && populatedType.assignedHrs.length > 0) {
            populatedType.assignedHrs.forEach(hr => {
                if (hr.officialEmail) {
                    import('../services/emailService.js').then(({ sendGrievanceNotificationEmail }) => {
                        sendGrievanceNotificationEmail({
                            recipientEmail: hr.officialEmail,
                            recipientName: hr.fullName,
                            senderName: req.user.fullName || req.user.username,
                            issueType: issueType.name,
                            subject: subject,
                            description: description,
                            grievanceId: grievance._id
                        }).catch(err => console.error('Email send failed async:', err))
                    })
                }
            })
        }

        res.status(201).json({ message: 'Grievance submitted successfully', grievance })
    } catch (error) {
        console.error('Create grievance error:', error)
        res.status(500).json({ message: 'Server error creating grievance' })
    }
})

// Get Sent Grievances
router.get('/sent', authenticate, async (req, res) => {
    try {
        const grievances = await Grievance.find({ sender: req.user._id })
            .populate('recipients', 'fullName username email role')
            .populate('issueType', 'name')
            .sort({ createdAt: -1 })
        res.json({ grievances })
    } catch (error) {
        console.error('Get sent grievances error:', error)
        res.status(500).json({ message: 'Server error fetching grievances' })
    }
})

// Get Received Grievances (Where current user is ONE of the recipients)
router.get('/received', authenticate, async (req, res) => {
    try {
        const grievances = await Grievance.find({ recipients: req.user._id })
            .populate('sender', 'fullName username email role')
            .populate('issueType', 'name')
            .sort({ createdAt: -1 })
        res.json({ grievances })
    } catch (error) {
        console.error('Get received grievances error:', error)
        res.status(500).json({ message: 'Server error fetching grievances' })
    }
})

// Update Status (for recipient)
router.put('/:id/status', authenticate, async (req, res) => {
    try {
        const { status } = req.body
        if (!['Open', 'In Progress', 'Resolved', 'Closed'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' })
        }

        const grievance = await Grievance.findById(req.params.id)
        if (!grievance) {
            return res.status(404).json({ message: 'Grievance not found' })
        }

        // Check if user is one of the recipients
        const isRecipient = grievance.recipients.some(r => r.toString() === req.user._id.toString())

        // Also allow admin to update status if needed, but let's stick to assigned HRs or Admin
        if (!isRecipient && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
            return res.status(403).json({ message: 'Not authorized to updates this grievance' })
        }

        grievance.status = status
        await grievance.save()

        res.json({ message: 'Status updated successfully', grievance })
    } catch (error) {
        console.error('Update grievance status error:', error)
        res.status(500).json({ message: 'Server error updating status' })
    }
})

// --- Admin Configuration Routes ---

// Get Grievance Stats (Admin Dashboard)
router.get('/admin/stats', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
    try {
        const total = await Grievance.countDocuments()
        const open = await Grievance.countDocuments({ status: 'Open' })
        const inProgress = await Grievance.countDocuments({ status: 'In Progress' })
        const resolved = await Grievance.countDocuments({ status: 'Resolved' })
        const closed = await Grievance.countDocuments({ status: 'Closed' })

        // Get last 7 days trend
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        const today = new Date()
        const trend = []

        for (let i = 6; i >= 0; i--) {
            const d = new Date(today)
            d.setDate(today.getDate() - i)
            d.setHours(0, 0, 0, 0)

            const nextDay = new Date(d)
            nextDay.setDate(d.getDate() + 1)

            const count = await Grievance.countDocuments({
                createdAt: { $gte: d, $lt: nextDay }
            })

            trend.push({
                day: days[d.getDay()],
                count
            })
        }

        res.json({
            stats: {
                total,
                open,
                inProgress,
                resolved,
                closed,
                trend
            }
        })
    } catch (error) {
        console.error('Admin stats error:', error)
        res.status(500).json({ message: 'Server error fetching stats' })
    }
})

// Get All Grievances (Admin Overview)
router.get('/admin/all', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
    try {
        const grievances = await Grievance.find()
            .populate('sender', 'fullName username email role')
            .populate('recipients', 'fullName username email role')
            .populate('issueType', 'name')
            .sort({ createdAt: -1 })
        res.json({ grievances })
    } catch (error) {
        console.error('Admin fetch all grievances error:', error)
        res.status(500).json({ message: 'Server error fetching all grievances' })
    }
})

// Get All Types (Admin Detail View)
router.get('/admin/types', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
    try {
        const types = await GrievanceType.find()
            .populate('assignedHrs', 'fullName email role')
            .sort({ name: 1 })
        res.json({ types })
    } catch (error) {
        console.error('Admin fetch types error:', error)
        res.status(500).json({ message: 'Server error fetching types' })
    }
})

// Create New Type
router.post('/admin/types', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
    try {
        const { name } = req.body
        if (!name) return res.status(400).json({ message: 'Name is required' })

        const existing = await GrievanceType.findOne({ name })
        if (existing) return res.status(400).json({ message: 'Type already exists' })

        const newType = new GrievanceType({ name })
        await newType.save()

        res.status(201).json({ message: 'Issue Type created', type: newType })
    } catch (error) {
        console.error('Create type error:', error)
        res.status(500).json({ message: 'Server error creating type' })
    }
})

// Assign HRs to Type
router.put('/admin/types/:id/assign', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
    try {
        const { assignedHrs } = req.body // Array of user IDs

        if (!Array.isArray(assignedHrs)) {
            return res.status(400).json({ message: 'assignedHrs must be an array of IDs' })
        }

        const type = await GrievanceType.findById(req.params.id)
        if (!type) return res.status(404).json({ message: 'Type not found' })

        type.assignedHrs = assignedHrs
        await type.save()

        const updatedType = await GrievanceType.findById(req.params.id).populate('assignedHrs', 'fullName email role')

        res.json({ message: 'HRs assigned successfully', type: updatedType })
    } catch (error) {
        console.error('Assign HRs error:', error)
        res.status(500).json({ message: 'Server error assigning HRs' })
    }
})

// Toggle Active Status
router.put('/admin/types/:id/toggle', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
    try {
        const type = await GrievanceType.findById(req.params.id)
        if (!type) return res.status(404).json({ message: 'Type not found' })

        type.isActive = !type.isActive
        await type.save()

        res.json({ message: `Type ${type.isActive ? 'activated' : 'deactivated'}`, type })
    } catch (error) {
        console.error('Toggle type error:', error)
        res.status(500).json({ message: 'Server error toggling type' })
    }
})

export default router
