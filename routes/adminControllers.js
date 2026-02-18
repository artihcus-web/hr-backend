import express from 'express'
import AdminControllerPermission from '../models/AdminControllerPermission.js'
import MenuConfiguration from '../models/MenuConfiguration.js'
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

// Get menu configuration for a specific role (or all if admin)
router.get('/menu-config/:role?', authenticate, async (req, res) => {
  try {
    const { role } = req.params
    const userRole = req.user.role

    // If no role specified and user is admin, return all configs
    // Otherwise, return config for user's role
    const targetRole = role || (userRole === 'admin' ? null : userRole)

    let menuConfigs
    if (targetRole === null) {
      // Admin requesting all configs
      menuConfigs = await MenuConfiguration.find().populate('users', 'fullName email employeeId').populate('updatedBy', 'fullName email')
    } else {
      // Get menu items visible for this role
      menuConfigs = await MenuConfiguration.find({
        $or: [
          { roles: targetRole },
          { users: req.user._id }
        ]
      }).populate('users', 'fullName email employeeId').populate('updatedBy', 'fullName email')
    }

    // Transform to frontend format
    const menuItems = menuConfigs.map(item => {
      // Convert Map to object for JSON serialization
      const isVisibleObj = {}
      const menuOrderObj = {}
      
      if (item.isVisible instanceof Map) {
        item.isVisible.forEach((value, key) => {
          isVisibleObj[key] = value
        })
      }
      
      if (item.menuOrder instanceof Map) {
        item.menuOrder.forEach((value, key) => {
          menuOrderObj[key] = value
        })
      }

      const isVisible = targetRole ? (isVisibleObj[targetRole] ?? true) : undefined
      const order = targetRole ? (menuOrderObj[targetRole] ?? 999) : undefined

      return {
        id: item.menuItemId,
        label: item.label,
        path: item.path,
        icon: item.icon,
        roles: item.roles,
        users: item.users?.map(u => u._id.toString()) || [],
        isVisible: isVisible,
        menuOrder: order,
        parentId: item.parentId,
        hasChildren: item.hasChildren
      }
    })

    // If specific role requested, filter and sort
    if (targetRole) {
      const filtered = menuItems
        .filter(item => {
          const hasRoleAccess = item.roles.includes(targetRole) || item.users.includes(req.user._id.toString())
          const visible = item.isVisible !== false
          return hasRoleAccess && visible
        })
        .sort((a, b) => (a.menuOrder || 999) - (b.menuOrder || 999))

      return res.json({ menuItems: filtered, role: targetRole })
    }

    // Return all configs for admin
    res.json({ menuItems, allRoles: true })
  } catch (error) {
    console.error('Get menu config error:', error)
    res.status(500).json({ message: 'Server error fetching menu configuration' })
  }
})

// Update menu configuration (admin only)
router.put('/menu-config', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { menuItems } = req.body

    if (!menuItems || !Array.isArray(menuItems)) {
      return res.status(400).json({ message: 'Invalid menu items data' })
    }

    const updates = []
    for (const item of menuItems) {
      const { id, label, path, icon, roles, users, isVisible, menuOrder, parentId, hasChildren } = item

      if (!id || !label || !path) {
        continue // Skip invalid items
      }

      // Build update object
      const updateData = {
        menuItemId: id,
        label,
        path,
        icon: icon || '',
        roles: roles || [],
        users: users || [],
        parentId: parentId || null,
        hasChildren: hasChildren || false,
        updatedBy: req.user._id
      }

      // Handle isVisible and menuOrder per role
      if (isVisible && typeof isVisible === 'object' && !Array.isArray(isVisible)) {
        updateData.isVisible = new Map(Object.entries(isVisible))
      }
      if (menuOrder && typeof menuOrder === 'object' && !Array.isArray(menuOrder)) {
        updateData.menuOrder = new Map(Object.entries(menuOrder))
      }

      updates.push(
        MenuConfiguration.findOneAndUpdate(
          { menuItemId: id },
          updateData,
          { upsert: true, new: true }
        )
      )
    }

    await Promise.all(updates)

    // Log activity
    await ActivityLog.create({
      user: req.user._id,
      action: 'MENU_CONFIG_UPDATED',
      description: 'Updated menu configuration',
      target: 'menu-configuration'
    })

    res.json({ message: 'Menu configuration updated successfully' })
  } catch (error) {
    console.error('Update menu config error:', error)
    res.status(500).json({ message: 'Server error updating menu configuration' })
  }
})

export default router
