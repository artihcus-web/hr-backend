/**
 * Migration script to seed initial menu configuration from menuConfig.js structure
 * Run with: node scripts/seedMenuConfig.js
 */

import mongoose from 'mongoose'
import dotenv from 'dotenv'
import MenuConfiguration from '../models/MenuConfiguration.js'

dotenv.config()

// Menu items structure matching menuConfig.js
const menuItemsData = [
  { id: 'admin-dashboard', label: 'Admin Dashboard', path: '/admin', roles: ['admin'] },
  { id: 'project-management', label: 'Project Management', path: '/admin/projects', roles: ['admin'] },
  { id: 'admin-controllers', label: 'Admin Controllers', path: '/admin/controllers', roles: ['admin'] },
  { id: 'conference-hall-admin', label: 'Conference Hall', path: '/conference-hall', roles: ['admin'] },
  { id: 'admin-policies', label: 'Policies', path: '/admin/policies', roles: ['admin', 'hr'] },
  { id: 'admin-assessments', label: 'Assessments', path: '/admin/assessments', roles: ['admin', 'hr'] },
  { id: 'grievance-portal-admin', label: 'Grievance Portal', path: '/grievance', roles: ['admin'] },
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard', roles: ['employee', 'manager', 'hr', 'c-suite', 'tl', 'supermanager'] },
  { id: 'projects', label: 'Projects', path: '/projects', roles: ['employee', 'manager', 'hr', 'tl'] },
  { id: 'timesheet', label: 'Timesheet', path: '/timesheet', roles: ['employee', 'manager', 'hr', 'tl'] },
  { id: 'holiday-calendar', label: 'Holiday Calendar', path: '/holiday-calendar', roles: ['employee', 'manager', 'hr', 'tl', 'c-suite', 'supermanager'] },
  { id: 'user-management', label: 'Employee Directory', path: '/admin/users', roles: ['admin', 'hr'] },
  { id: 'form-builder', label: 'Schema Configuration', path: '/admin/form-builder', roles: ['admin', 'hr'] },
  { id: 'know-your-employee', label: 'Know Your Employee', path: '/know-your-employee', roles: ['employee', 'manager', 'hr', 'tl', 'c-suite', 'supermanager'] },
  { id: 'conference-hall', label: 'Conference Hall', path: '/conference-hall', roles: ['employee', 'manager', 'hr', 'tl', 'c-suite', 'supermanager'] },
  { id: 'policies', label: 'Policies', path: '/policies', roles: ['employee', 'manager', 'hr', 'tl', 'c-suite', 'supermanager'] },
  { id: 'grievance', label: 'Grievance', path: '/grievance', roles: ['employee', 'manager', 'hr', 'tl'] },
  { id: 'assessments', label: 'Assessments', path: '/assessments', roles: ['employee', 'manager', 'hr', 'tl', 'c-suite', 'supermanager', 'client'] },
  { id: 'approvals', label: 'Approvals', path: '/approvals/timesheet', roles: ['manager', 'hr', 'supermanager'] },
  { id: 'project-view', label: 'Project View', path: '/project-view', roles: ['c-suite'] },
  { id: 'grievance-config', label: 'Ticket Configuration', path: '/admin/grievance-config', roles: ['admin'] }
]

const seedMenuConfig = async () => {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/myapp'
    await mongoose.connect(MONGODB_URI)
    console.log('✅ Connected to MongoDB')

    // Clear existing menu config (optional - comment out if you want to keep existing)
    // await MenuConfiguration.deleteMany({})
    // console.log('🗑️  Cleared existing menu config')

    let created = 0
    let updated = 0

    for (const item of menuItemsData) {
      // Set default order based on array index
      const defaultOrder = menuItemsData.indexOf(item) + 1
      
      // Create visibility map (all visible by default)
      const isVisible = new Map()
      const menuOrder = new Map()
      
      // Set default order and visibility for each role
      item.roles.forEach(role => {
        isVisible.set(role, true)
        menuOrder.set(role, defaultOrder)
      })

      const result = await MenuConfiguration.findOneAndUpdate(
        { menuItemId: item.id },
        {
          menuItemId: item.id,
          label: item.label,
          path: item.path,
          icon: '', // Icon will be handled by frontend
          roles: item.roles,
          users: [],
          isVisible: isVisible,
          menuOrder: menuOrder,
          parentId: null,
          hasChildren: false
        },
        { upsert: true, new: true }
      )

      if (result.isNew) {
        created++
        console.log(`✅ Created: ${item.label}`)
      } else {
        updated++
        console.log(`🔄 Updated: ${item.label}`)
      }
    }

    console.log(`\n✨ Migration complete!`)
    console.log(`   Created: ${created} items`)
    console.log(`   Updated: ${updated} items`)
    console.log(`   Total: ${menuItemsData.length} items`)

    await mongoose.disconnect()
    console.log('✅ Disconnected from MongoDB')
    process.exit(0)
  } catch (error) {
    console.error('❌ Error seeding menu config:', error)
    await mongoose.disconnect()
    process.exit(1)
  }
}

seedMenuConfig()
