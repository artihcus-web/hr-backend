import express from 'express'
import Project from '../models/Project.js'
import User from '../models/User.js'
import ActivityLog from '../models/ActivityLog.js'
import { authenticate, requireRole } from '../middleware/auth.js'
import { transformUsers } from '../utils/transformUser.js'

const router = express.Router()

// Helper to transform populated users in projects
function transformProjectUsers(project) {
  const projectObj = project.toObject ? project.toObject() : { ...project }
  
  if (projectObj.employees) {
    projectObj.employees = transformUsers(projectObj.employees)
  }
  if (projectObj.projectManagers) {
    projectObj.projectManagers = transformUsers(projectObj.projectManagers)
  }
  if (projectObj.clients) {
    projectObj.clients = transformUsers(projectObj.clients)
  }
  if (projectObj.createdBy) {
    projectObj.createdBy = transformUsers([projectObj.createdBy])[0]
  }
  if (projectObj.managerAssignments) {
    projectObj.managerAssignments = projectObj.managerAssignments.map(assignment => ({
      ...assignment,
      employee: assignment.employee ? transformUsers([assignment.employee])[0] : assignment.employee,
      manager: assignment.manager ? transformUsers([assignment.manager])[0] : assignment.manager
    }))
  }
  
  return projectObj
}

// Get all projects (public access)
router.get('/', async (req, res) => {
  try {
    const projects = await Project.find()
      .sort({ createdAt: -1 })
      .populate('createdBy', 'username fullName profileImage')
      .populate('employees', 'username fullName email employeeId profileImage')
      .populate('projectManagers', 'username fullName email employeeId profileImage')
      .populate('clients', 'username fullName email employeeId profileImage')
      .populate({
        path: 'managerAssignments.employee',
        select: 'username fullName email employeeId profileImage'
      })
      .populate({
        path: 'managerAssignments.manager',
        select: 'username fullName email employeeId profileImage'
      })
    
    // Transform profileImage GridFS IDs to endpoint URLs
    const transformedProjects = projects.map(project => transformProjectUsers(project))
    
    res.json({ projects: transformedProjects })
  } catch (error) {
    console.error('Get projects error:', error)
    res.status(500).json({ message: 'Server error while fetching projects' })
  }
})

// Get user's projects (for employees/managers)
router.get('/my-projects', authenticate, async (req, res) => {
  try {
    const userId = req.user._id

    // Find projects where user is either an employee or project manager
    const projects = await Project.find({
      $or: [
        { employees: userId },
        { projectManagers: userId }
      ]
    })
      .sort({ createdAt: -1 })
      .populate('createdBy', 'username fullName profileImage')
      .populate('employees', 'username fullName email employeeId profileImage')
      .populate('projectManagers', 'username fullName email employeeId profileImage')
      .populate('clients', 'username fullName email employeeId profileImage')
      .populate({
        path: 'managerAssignments.employee',
        select: 'username fullName email employeeId profileImage'
      })
      .populate({
        path: 'managerAssignments.manager',
        select: 'username fullName email employeeId profileImage'
      })

    // Transform profileImage GridFS IDs to endpoint URLs
    const transformedProjects = projects.map(project => transformProjectUsers(project))

    res.json({ projects: transformedProjects })
  } catch (error) {
    console.error('Get user projects error:', error)
    res.status(500).json({ message: 'Server error while fetching projects' })
  }
})

// Get single project
router.get('/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('createdBy', 'username fullName profileImage')
      .populate('employees', 'username fullName email employeeId profileImage')
      .populate('projectManagers', 'username fullName email employeeId profileImage')
      .populate('clients', 'username fullName email employeeId profileImage')
      .populate({
        path: 'managerAssignments.employee',
        select: 'username fullName email employeeId profileImage'
      })
      .populate({
        path: 'managerAssignments.manager',
        select: 'username fullName email employeeId profileImage'
      })
    if (!project) {
      return res.status(404).json({ message: 'Project not found' })
    }
    
    // Transform profileImage GridFS IDs to endpoint URLs
    const transformedProject = transformProjectUsers(project)
    
    res.json({ project: transformedProject })
  } catch (error) {
    console.error('Get project error:', error)
    res.status(500).json({ message: 'Server error while fetching project' })
  }
})

// Get available employees and managers for assignment
router.get('/:id/available-users', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { unassignedOnly } = req.query
    const project = await Project.findById(req.params.id)
    if (!project) {
      return res.status(404).json({ message: 'Project not found' })
    }

    // Build exclusion query: Exclude users who are already in the project (either as employee or manager)
    let excludedIds = [...project.employees, ...project.projectManagers]

    // If unassignedOnly is true, also exclude users assigned to OTHER active projects
    if (unassignedOnly === 'true') {
      const allProjects = await Project.find({ status: 'active' }, 'employees projectName')
      const allAssignedEmployeeIds = allProjects.reduce((acc, p) => {
        // Exclude current project employees from this reduction check (handled above)
        // Also exclude "Ready-to-deploy resources" from being considered an "active assignment" preventing other assignments
        if (p._id.toString() !== req.params.id && p.projectName !== 'Ready-to-deploy resources') {
          return [...acc, ...p.employees]
        }
        return acc
      }, [])

      excludedIds = [...excludedIds, ...allAssignedEmployeeIds]
    }

    // Get all potential users (everyone except admin)
    const users = await User.find({
      role: { $in: ['employee', 'tl', 'manager', 'hr', 'super_manager'] },
      _id: { $nin: excludedIds }
    }).select('username fullName email employeeId role')

    // Fetch all active projects to map valid current assignments
    const activeProjects = await Project.find({ status: { $in: ['active', 'In Progress'] } }).select('projectName employees projectManagers')

    const usersWithAssignments = users.map(user => {
      const u = user.toObject()
      u.currentAssignments = activeProjects.reduce((acc, p) => {
        // Check if user is in this project
        const isManager = p.projectManagers.some(id => id.toString() === user._id.toString())
        const isEmployee = p.employees.some(id => id.toString() === user._id.toString())

        if (isManager || isEmployee) {
          acc.push({
            projectName: p.projectName,
            role: isManager ? 'Manager' : 'Member'
          })
        }
        return acc
      }, [])
      return u
    })

    res.json({ users: usersWithAssignments })
  } catch (error) {
    console.error('Get available users error:', error)
    res.status(500).json({ message: 'Server error while fetching available users' })
  }
})

// Create project (admin only)
router.post('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { projectName, projectId, description, status, shiftTiming } = req.body

    if (!projectName || !projectId) {
      return res.status(400).json({ message: 'Project name and project ID are required' })
    }

    // Check if project ID already exists
    const existingProject = await Project.findOne({ projectId })
    if (existingProject) {
      return res.status(400).json({ message: 'Project ID already exists' })
    }

    const project = new Project({
      projectName,
      projectId,
      description: description || '',
      status: status || 'active',
      shiftTiming: shiftTiming || 'Mon - Fri',
      createdBy: req.user._id
    })

    // Handle Client Creation/Linking
    if (req.body.clientsData && Array.isArray(req.body.clientsData)) {
      const clientIds = []

      for (const clientData of req.body.clientsData) {
        if (!clientData.email || !clientData.password) continue

        let user = await User.findOne({ email: clientData.email.toLowerCase() })

        if (!user) {
          // Create new client user
          user = new User({
            username: clientData.email.split('@')[0],
            email: clientData.email.toLowerCase(),
            password: clientData.password,
            fullName: clientData.name || clientData.email.split('@')[0],
            role: 'client',
            firstName: (clientData.name || '').split(' ')[0] || 'Client',
            employeeId: 'CL-' + Math.floor(1000 + Math.random() * 9000) // Temp ID generation
          })
          await user.save()
        } else {
          // Ensure role is client if linking existing user? 
          // Maybe safe to just use existing user ID.
        }
        clientIds.push(user._id)
      }
      project.clients = clientIds
    }

    await project.save()

    // Log Activity
    await ActivityLog.create({
      user: req.user._id,
      action: 'PROJECT_CREATED',
      description: `Project ${project.projectName} created.`,
      target: project.projectName
    })

    res.status(201).json({
      message: 'Project created successfully',
      project
    })
  } catch (error) {
    console.error('Create project error:', error)
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Project ID already exists' })
    }
    res.status(500).json({ message: 'Server error while creating project' })
  }
})

// Update project (admin only)
router.put('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { projectName, projectId, description, status, shiftTiming } = req.body

    const project = await Project.findById(req.params.id)
    if (!project) {
      return res.status(404).json({ message: 'Project not found' })
    }

    // Check if project ID is being changed and if it already exists
    if (projectId && projectId !== project.projectId) {
      const existingProject = await Project.findOne({ projectId })
      if (existingProject) {
        return res.status(400).json({ message: 'Project ID already exists' })
      }
      project.projectId = projectId
    }

    if (projectName) project.projectName = projectName
    if (description !== undefined) project.description = description
    if (status) project.status = status
    if (shiftTiming) project.shiftTiming = shiftTiming

    // Handle Client Updates
    if (req.body.clientsData && Array.isArray(req.body.clientsData)) {
      // If clientsData is provided, we process it. 
      // Note: This logic REPLACES the client list with the valid ones from this list.
      // If you want to Append, you'd need to fetch existing and concat.
      // Current Assumption: Form sends FULL list of desired clients.

      const clientIds = []

      for (const clientData of req.body.clientsData) {
        // If it has an _id, it's an existing linked user
        if (clientData._id) {
          clientIds.push(clientData._id)
          continue
        }

        // New or Existing by Email
        if (!clientData.email) continue

        let user = await User.findOne({ email: clientData.email.toLowerCase() })

        if (!user) {
          if (!clientData.password) continue // Can't create without password

          // Create new client user
          user = new User({
            username: clientData.email.split('@')[0],
            email: clientData.email.toLowerCase(),
            password: clientData.password,
            fullName: clientData.name || clientData.email.split('@')[0],
            role: 'client',
            firstName: (clientData.name || '').split(' ')[0] || 'Client',
            employeeId: 'CL-' + Math.floor(1000 + Math.random() * 9000)
          })
          await user.save()
        }
        clientIds.push(user._id)
      }
      project.clients = clientIds
    }

    // Update Team if provided
    // Note: This replaces the existing lists. 
    if (req.body.employees && Array.isArray(req.body.employees)) {
      project.employees = req.body.employees
    }

    if (req.body.projectManagers && Array.isArray(req.body.projectManagers)) {
      project.projectManagers = req.body.projectManagers
    }

    await project.save()

    // Log Activity
    await ActivityLog.create({
      user: req.user._id,
      action: 'UPDATE_PROJECT',
      description: `Updated project: ${project.projectName}`,
      target: project.projectName
    })

    res.json({
      message: 'Project updated successfully',
      project
    })
  } catch (error) {
    console.error('Update project error:', error)
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Project ID already exists' })
    }
    res.status(500).json({ message: 'Server error while updating project' })
  }
})

// Assign employees to project
router.post('/:id/assign-employees', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { employeeIds } = req.body
    if (!Array.isArray(employeeIds)) {
      return res.status(400).json({ message: 'employeeIds must be an array' })
    }

    const project = await Project.findById(req.params.id)
    if (!project) {
      return res.status(404).json({ message: 'Project not found' })
    }

    // Verify all employee IDs exist and are employees
    const employees = await User.find({
      _id: { $in: employeeIds },
      role: { $in: ['employee', 'tl'] }
    })

    if (employees.length !== employeeIds.length) {
      return res.status(400).json({ message: 'Some employee IDs are invalid or not employees' })
    }

    // Add employees (avoid duplicates)
    employeeIds.forEach(id => {
      if (!project.employees.includes(id)) {
        project.employees.push(id)
      }
    })

    await project.save()
    await project.save()
    await project.populate('employees', 'username fullName email employeeId')
    await project.populate('projectManagers', 'username fullName email employeeId')

    // 1. AUTO-REMOVE from "Ready-to-deploy resources" if applicable
    if (project.projectName !== 'Ready-to-deploy resources') {
      try {
        const readyProject = await Project.findOne({ projectName: 'Ready-to-deploy resources' })
        if (readyProject) {
          let modified = false
          employeeIds.forEach(id => {
            const idStr = id.toString()
            // Remove from employees list
            const empIndex = readyProject.employees.findIndex(e => e.toString() === idStr)
            if (empIndex !== -1) {
              readyProject.employees.splice(empIndex, 1)
              modified = true
            }
            // Remove from manager assignments
            const assignIndex = readyProject.managerAssignments.findIndex(a => a.employee.toString() === idStr)
            if (assignIndex !== -1) {
              readyProject.managerAssignments.splice(assignIndex, 1)
              modified = true
            }
          })
          if (modified) {
            await readyProject.save()
            console.log(`✅ [PROJECT] Removed ${employeeIds.length} employees from Ready-to-deploy resources`)
          }
        }
      } catch (err) {
        console.error('❌ [PROJECT] Error auto-removing from Ready-to-deploy:', err)
      }
    }

    // 2. SYNC MANAGER ID TO USER MODEL (New Requirement)
    // If project has managers, assign the first one as the user's managerId
    if (project.projectManagers && project.projectManagers.length > 0) {
      const primaryManagerId = project.projectManagers[0]._id || project.projectManagers[0]
      try {
        await User.updateMany(
          { _id: { $in: employeeIds } },
          { $set: { managerId: primaryManagerId } }
        )
        console.log(`✅ [PROJECT] Synced managerId to ${primaryManagerId} for assigned employees`)
      } catch (err) {
        console.error('❌ [PROJECT] Error syncing managerId to users:', err)
      }
    }

    // Log Activity
    await ActivityLog.create({
      user: req.user._id,
      action: 'ASSIGN_EMPLOYEES',
      description: `Assigned ${employeeIds.length} employees to project ${project.projectName}`,
      target: project.projectName
    })

    res.json({
      message: 'Employees assigned successfully',
      project
    })
  } catch (error) {
    console.error('Assign employees error:', error)
    res.status(500).json({ message: 'Server error while assigning employees' })
  }
})

// Assign project managers to project
router.post('/:id/assign-managers', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { managerIds } = req.body
    if (!Array.isArray(managerIds)) {
      return res.status(400).json({ message: 'managerIds must be an array' })
    }

    const project = await Project.findById(req.params.id)
    if (!project) {
      return res.status(404).json({ message: 'Project not found' })
    }

    // Verify all manager IDs exist and are managers (or HRs)
    // Note: We're relaxing the check slightly to allow HRs if they were fetched by the frontend
    // Ideally we should check the project type here too, but checking existence + any valid "management" role is safe enough
    const managers = await User.find({
      _id: { $in: managerIds },
      role: { $in: ['manager', 'hr'] }
    })

    if (managers.length !== managerIds.length) {
      return res.status(400).json({ message: 'Some IDs are invalid or not management roles' })
    }

    // Add managers (avoid duplicates)
    managerIds.forEach(id => {
      if (!project.projectManagers.includes(id)) {
        project.projectManagers.push(id)
      }
    })

    await project.save()
    await project.populate('projectManagers', 'username fullName email employeeId')

    // Log Activity
    await ActivityLog.create({
      user: req.user._id,
      action: 'ASSIGN_MANAGERS',
      description: `Assigned ${managerIds.length} managers to project ${project.projectName}`,
      target: project.projectName
    })

    res.json({
      message: 'Project managers assigned successfully',
      project
    })
  } catch (error) {
    console.error('Assign managers error:', error)
    res.status(500).json({ message: 'Server error while assigning managers' })
  }
})

// Update Manager Assignment Map
router.post('/:id/assign-managers-map', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { assignments } = req.body // [{ employeeId, managerId }]

    const project = await Project.findById(req.params.id)
    if (!project) {
      return res.status(404).json({ message: 'Project not found' })
    }

    // Update or Add assignments
    if (assignments && Array.isArray(assignments)) {
      assignments.forEach(({ employeeId, managerId }) => {
        // Ensure employee is in the project's employee list
        if (!project.employees.includes(employeeId)) {
          project.employees.push(employeeId)
        }

        // Remove existing assignment for this employee if exists
        const existingIndex = project.managerAssignments.findIndex(
          a => a.employee.toString() === employeeId
        )

        if (existingIndex >= 0) {
          project.managerAssignments.splice(existingIndex, 1) // Remove
        }

        // Add new assignment if managerId is provided
        if (managerId) {
          project.managerAssignments.push({ employee: employeeId, manager: managerId })
        }
      })
    }

    await project.save()

    // SYNC TO USER MODEL (Ensure managerId is updated for the employees)
    if (assignments && Array.isArray(assignments)) {
      try {
        const updatePromises = assignments.map(async ({ employeeId, managerId }) => {
          if (!managerId) return;

          // Only sync if this is "Ready-to-deploy resources" (HR Mapping)
          if (project.projectName === 'Ready-to-deploy resources') {
            await User.findByIdAndUpdate(employeeId, { managerId: managerId })
            console.log(`✅ [PROJECT] Synced managerId for user ${employeeId} to ${managerId}`)
          }
        })
        await Promise.all(updatePromises)
      } catch (err) {
        console.error('❌ [PROJECT] Error syncing managerId to users:', err)
      }
    }

    // SYNC TO USER MODEL (Ensure managerId is updated for the employees)
    if (assignments && Array.isArray(assignments)) {
      try {
        const updatePromises = assignments.map(async ({ employeeId, managerId }) => {
          if (!managerId) return;

          // Only sync if this is "Ready-to-deploy resources" (HR Mapping)
          if (project.projectName === 'Ready-to-deploy resources') {
            await User.findByIdAndUpdate(employeeId, { managerId: managerId })
            console.log(`✅ [PROJECT] Synced managerId for user ${employeeId} to ${managerId}`)
          }
        })
        await Promise.all(updatePromises)
      } catch (err) {
        console.error('❌ [PROJECT] Error syncing managerId to users:', err)
      }
    }

    // Populate for return
    await project.populate({
      path: 'managerAssignments.employee',
      select: 'username fullName email employeeId'
    })
    await project.populate({
      path: 'managerAssignments.manager',
      select: 'username fullName email employeeId'
    })

    res.json({
      message: 'Resource allocation updated successfully',
      project
    })
  } catch (error) {
    console.error('Manager map assignment error:', error)
    res.status(500).json({ message: 'Server error while updating resource allocation' })
  }
})

// Remove employee from project
router.delete('/:id/employees/:employeeId', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
    if (!project) {
      return res.status(404).json({ message: 'Project not found' })
    }

    project.employees = project.employees.filter(
      id => id.toString() !== req.params.employeeId
    )

    await project.save()
    res.json({ message: 'Employee removed successfully', project })
  } catch (error) {
    console.error('Remove employee error:', error)
    res.status(500).json({ message: 'Server error while removing employee' })
  }
})

// Remove project manager from project
router.delete('/:id/managers/:managerId', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
    if (!project) {
      return res.status(404).json({ message: 'Project not found' })
    }

    project.projectManagers = project.projectManagers.filter(
      id => id.toString() !== req.params.managerId
    )

    await project.save()
    res.json({ message: 'Project manager removed successfully', project })
  } catch (error) {
    console.error('Remove manager error:', error)
    res.status(500).json({ message: 'Server error while removing manager' })
  }
})

// Delete project (admin only)
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id)
    if (!project) {
      return res.status(404).json({ message: 'Project not found' })
    }

    // Log Activity
    await ActivityLog.create({
      user: req.user._id,
      action: 'DELETE_PROJECT',
      description: `Deleted project: ${project.projectName}`,
      target: project.projectName
    })

    res.json({ message: 'Project deleted successfully' })
  } catch (error) {
    console.error('Delete project error:', error)
    res.status(500).json({ message: 'Server error while deleting project' })
  }
})

export default router

