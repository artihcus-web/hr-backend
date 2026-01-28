import express from 'express'
import ActivityLog from '../models/ActivityLog.js'
import { authenticate, requireRole } from '../middleware/auth.js'

const router = express.Router()

// GET /api/activity - Get recent activities (Admin only)
router.get('/', authenticate, requireRole('admin'), async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10
        const logs = await ActivityLog.find()
            .populate('user', 'firstName lastName email role')
            .sort({ timestamp: -1 })
            .limit(limit)

        res.json({ logs })
    } catch (error) {
        console.error('Error fetching activity logs:', error)
        res.status(500).json({ message: 'Server error fetching activity logs' })
    }
})

export default router
