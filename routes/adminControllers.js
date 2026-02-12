import express from 'express'
import AdminControllerPermission from '../models/AdminControllerPermission.js'
import { authenticate, requireRole } from '../middleware/auth.js'
import ActivityLog from '../models/ActivityLog.js'

const router = express.Router()

// Get all permissions (admin only)
router.get('/permissions', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const permissions = await AdminControllerPermission.find()
      .populate('users', 'fullName email employeeId')
      .populate('updatedBy', 'fullName email')

    // Default permissions if none exist
    const defaultPerms = {
      employeeDirectory: { roles: ['hr'], users: [] },
      ticketConfiguration: { roles: ['hr'], users: [] },
      schemaConfiguration: { roles: ['hr'], users: [] },
      grievancePortal: { roles: ['hr'], users: [] },
      policies: { roles: ['hr'], users: [] }
    }

    const permsMap = {}
    permissions.forEach(p => {
      permsMap[p.feature] = {
        roles: p.roles || [],
        users: p.users?.map(u => u._id.toString()) || []
      }
    })

    // Merge with defaults
    const result = {}
    Object.keys(defaultPerms).forEach(feature => {
      result[feature] = permsMap[feature] || defaultPerms[feature]
    })

    res.json({ permissions: result })
  } catch (error) {
    console.error('Get permissions error:', error)
    res.status(500).json({ message: 'Server error fetching permissions' })
  }
})

// Update permissions (admin only)
router.put('/permissions', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { permissions } = req.body

    if (!permissions || typeof permissions !== 'object') {
      return res.status(400).json({ message: 'Invalid permissions data' })
    }

    const features = ['employeeDirectory', 'ticketConfiguration', 'schemaConfiguration', 'grievancePortal', 'policies']
    
    for (const feature of features) {
      if (permissions[feature]) {
        const { roles, users } = permissions[feature]
        
        await AdminControllerPermission.findOneAndUpdate(
          { feature },
          {
            roles: roles || [],
            users: users || [],
            updatedBy: req.user._id
          },
          { upsert: true, new: true }
        )
      }
    }

    // Log activity
    await ActivityLog.create({
      user: req.user._id,
      action: 'ADMIN_CONTROLLERS_UPDATED',
      description: 'Updated admin controller permissions',
      target: 'admin-controllers'
    })

    res.json({ message: 'Permissions updated successfully' })
  } catch (error) {
    console.error('Update permissions error:', error)
    res.status(500).json({ message: 'Server error updating permissions' })
  }
})

export default router
