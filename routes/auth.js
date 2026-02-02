import express from 'express'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import Project from '../models/Project.js'
import ActivityLog from '../models/ActivityLog.js'
import { authenticate, requireRole } from '../middleware/auth.js'
import crypto from 'crypto'
import { sendPasswordResetEmail } from '../services/emailService.js'

const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production'

// Forgot Password Route
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ message: 'Email is required' })

    const user = await User.findOne({ email: email.toLowerCase() })
    if (!user) {
      // Security: Don't reveal if user exists
      return res.status(200).json({ message: 'If an account exists, a reset email has been sent.' })
    }

    // Generate token
    const token = crypto.randomBytes(20).toString('hex')

    // Set token and expiration (1 hour)
    user.resetPasswordToken = token
    user.resetPasswordExpires = Date.now() + 3600000 // 1 hour
    await user.save()

    // Create reset URL
    // Check if origin is from localhost or production
    // Prioritize FRONTEND_URL env var if set (for production)
    const frontendUrl = process.env.FRONTEND_URL || req.headers.origin || 'http://localhost:5173'
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`

    // Send email
    const emailSent = await sendPasswordResetEmail(user.email, resetUrl)

    if (emailSent) {
      res.json({ message: 'If an account exists, a reset email has been sent.' })
    } else {
      res.status(500).json({ message: 'Error sending email' })
    }
  } catch (error) {
    console.error('Forgot Password Error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Reset Password Route
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body

    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and new password are required' })
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    })

    if (!user) {
      return res.status(400).json({ message: 'Password reset token is invalid or has expired' })
    }

    // Update password (pre-save hook will hash it)
    user.password = newPassword
    user.resetPasswordToken = undefined
    user.resetPasswordExpires = undefined

    await user.save()

    res.json({ message: 'Password has been reset successfully' })
  } catch (error) {
    console.error('Reset Password Error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Public signup route (defaults to employee role)
router.post('/signup', async (req, res) => {
  try {
    const { username, email, password, fullName } = req.body

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' })
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' })
    }

    const existingUser = await User.findOne({ $or: [{ username }, { email }] })
    if (existingUser) {
      return res.status(400).json({
        message: existingUser.username === username
          ? 'Username already exists'
          : 'Email already exists'
      })
    }

    const user = new User({ username, email, password, fullName, role: 'employee' })
    await user.save()

    const token = jwt.sign(
      { userId: user._id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        fullName: user.fullName
      }
    })
  } catch (error) {
    console.error('Signup error:', error)
    res.status(500).json({ message: 'Server error during signup' })
  }
})

// Login route
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' })
    }

    const identifier = username.trim()

    // Allow login with either employeeId or email, using the same input field
    const user = await User.findOne({
      $or: [{ employeeId: identifier }, { email: identifier.toLowerCase() }]
    })
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const isPasswordValid = await user.comparePassword(password)
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    // Restriction: Clients must use the Ticket Portal
    if (user.role === 'client') {
      const origin = req.headers.origin || ''


      // If the origin is the HR Portal (Production OR Localhost for testing), block them
      if (origin.includes('hr.artihcus.com') || origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return res.status(403).json({
          message: 'Access Denied: Please login via the Client Portal.'
        })
      }
    }

    const token = jwt.sign(
      { userId: user._id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    // Log Activity (Disabled to avoid clutter)
    /*
    await ActivityLog.create({
      user: user._id,
      action: 'LOGIN',
      description: `User ${user.fullName} logged in.`,
      target: 'Auth'
    })
    */

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        fullName: user.fullName
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ message: 'Server error during login' })
  }
})

// Get current user
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = req.user.toObject()

    if (user.managerId) {
      const manager = await User.findById(user.managerId).select('fullName')
      if (manager) {
        user.managerName = manager.fullName
      }
    }

    res.json({ user })
  } catch (error) {
    console.error('Error fetching me:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Admin: create users with specific roles
router.post('/users', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { firstName, email, phone, employeeId, role = 'employee', password, username, loginUsername, fullName, lastName, assignedProjects, ...otherFields } = req.body

    // Validate required fields (password is optional, defaults to employeeId)
    if (!firstName || !email || !phone || !employeeId || !role) {
      return res.status(400).json({
        message: 'firstName, email, phone, employeeId, and role are required'
      })
    }

    const finalPassword = password || employeeId

    if (!['admin', 'c-suite', 'hr', 'manager', 'supermanager', 'tl', 'employee', 'client'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' })
    }

    // Generate username if not provided
    const finalUsername = username || loginUsername || employeeId || email.split('@')[0]

    // Generate fullName if not provided
    const finalFullName = fullName || `${firstName} ${lastName || ''}`.trim()

    // Check for existing user
    const existingUser = await User.findOne({
      $or: [
        { username: finalUsername },
        { email: email.toLowerCase() },
        { employeeId: employeeId }
      ]
    })

    if (existingUser) {
      let message = 'User already exists'
      if (existingUser.username === finalUsername) message = 'Username already exists'
      else if (existingUser.email === email.toLowerCase()) message = 'Email already exists'
      else if (existingUser.employeeId === employeeId) message = 'Employee ID already exists'

      return res.status(400).json({ message })
    }

    // Helper function to convert date strings to Date objects
    const parseDate = (value) => {
      if (!value) return undefined
      const date = new Date(value)
      return isNaN(date.getTime()) ? undefined : date
    }

    // Helper function to convert to number
    const parseNumber = (value) => {
      if (!value) return undefined
      const num = Number(value)
      return isNaN(num) ? undefined : num
    }

    // Date fields that need conversion
    const dateFields = ['dateOfBirth', 'birthdayDate', 'marriageDate', 'joiningDate', 'confirmDate', 'completedOn', 'pfJoiningDate']

    // Number fields that need conversion
    const numberFields = ['probationPeriod', 'noticePeriod', 'salary', 'numberOfChildren']

    // Build user data object
    const userData = {
      username: finalUsername,
      email: email.toLowerCase(),
      password: finalPassword,
      role,
      fullName: finalFullName,
      firstName,
      lastName, // Added explicitly
      phone,
      employeeId,
      assignedProjects,
      ...otherFields
    }

    // Convert date fields
    dateFields.forEach(field => {
      if (userData[field]) {
        const parsed = parseDate(userData[field])
        if (parsed) userData[field] = parsed
        else delete userData[field]
      }
    })

    // Convert number fields
    numberFields.forEach(field => {
      if (userData[field]) {
        const parsed = parseNumber(userData[field])
        if (parsed !== undefined) userData[field] = parsed
        else delete userData[field]
      }
    })

    // Remove empty strings (keep false/0 values for booleans/numbers)
    Object.keys(userData).forEach(key => {
      if (userData[key] === '' || userData[key] === null) {
        delete userData[key]
      }
    })

    const user = new User(userData)
    await user.save()

    // Sync with Projects
    if (assignedProjects && Array.isArray(assignedProjects) && assignedProjects.length > 0) {
      const fieldToUpdate = ['manager', 'supermanager'].includes(role) ? 'projectManagers' : 'employees'
      await Project.updateMany(
        { _id: { $in: assignedProjects } },
        { $addToSet: { [fieldToUpdate]: user._id } }
      )
    }

    // Log Activity
    await ActivityLog.create({
      user: req.user._id, // Admin who performed the action
      action: 'CREATE_USER',
      description: `Created new employee: ${user.fullName} (${user.role})`,
      target: user._id.toString()
    })

    res.status(201).json({
      message: 'Employee created successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        employeeId: user.employeeId
      }
    })
  } catch (error) {
    console.error('Create user error:', error)
    res.status(500).json({ message: 'Server error while creating user', error: error.message })
  }
})

// Admin: list users (basic)
router.get('/users', authenticate, requireRole('admin', 'c-suite'), async (_req, res) => {
  try {
    const users = await User.find().select('-password')

    // Fetch all active projects to map valid current assignments
    const activeProjects = await Project.find({ status: { $in: ['active', 'In Progress'] } }).select('projectName employees projectManagers')

    const usersWithAssignments = users.map(user => {
      const u = user.toObject()
      // Skip for admins to check efficiently
      if (u.role === 'admin') return u

      u.currentAssignments = activeProjects.reduce((acc, p) => {
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
    console.error('List users error:', error)
    res.status(500).json({ message: 'Server error while listing users' })
  }
})

// Admin: get single user by ID
router.get('/users/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password')
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }
    res.json({ user })
  } catch (error) {
    console.error('Get user error:', error)
    res.status(500).json({ message: 'Server error while fetching user' })
  }
})

// Admin: update user
router.put('/users/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { firstName, email, phone, employeeId, role, password, username, loginUsername, fullName, lastName, middleName, isActive, assignedProjects, ...otherFields } = req.body

    const user = await User.findById(req.params.id)
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    // Helper function to convert date strings to Date objects
    const parseDate = (value) => {
      if (!value) return undefined
      const date = new Date(value)
      return isNaN(date.getTime()) ? undefined : date
    }

    // Helper function to convert to number
    const parseNumber = (value) => {
      if (!value) return undefined
      const num = Number(value)
      return isNaN(num) ? undefined : num
    }

    // Date fields that need conversion
    const dateFields = ['dateOfBirth', 'birthdayDate', 'marriageDate', 'joiningDate', 'confirmDate', 'completedOn', 'pfJoiningDate']

    // Number fields that need conversion
    const numberFields = ['probationPeriod', 'noticePeriod', 'salary']

    // Build update object
    const updateData = {}

    if (firstName) updateData.firstName = firstName
    if (lastName !== undefined) updateData.lastName = lastName
    if (middleName !== undefined) updateData.middleName = middleName
    if (email) updateData.email = email.toLowerCase()
    if (phone) updateData.phone = phone
    if (employeeId) updateData.employeeId = employeeId
    if (role) updateData.role = role
    if (fullName) updateData.fullName = fullName
    if (username || loginUsername) updateData.username = username || loginUsername || employeeId || email?.split('@')[0]
    if (password) updateData.password = password // Will be hashed by pre-save hook
    if (isActive !== undefined) updateData.isActive = isActive
    if (assignedProjects !== undefined) updateData.assignedProjects = assignedProjects

    // Add other fields
    Object.keys(otherFields).forEach(key => {
      if (otherFields[key] !== undefined && otherFields[key] !== '' && otherFields[key] !== null) {
        updateData[key] = otherFields[key]
      }
    })

    // Convert date fields
    dateFields.forEach(field => {
      if (updateData[field]) {
        const parsed = parseDate(updateData[field])
        if (parsed) updateData[field] = parsed
        else delete updateData[field]
      }
    })

    // Convert number fields
    numberFields.forEach(field => {
      if (updateData[field]) {
        const parsed = parseNumber(updateData[field])
        if (parsed !== undefined) updateData[field] = parsed
        else delete updateData[field]
      }
    })

    // Update user
    Object.assign(user, updateData)
    await user.save()

    // Sync with Projects if assignedProjects or role changed
    if (assignedProjects !== undefined || role) {
      // 1. Clean up: Remove user from all lists in all projects to ensure consistency
      // (Especially important if role changed from Employee -> Manager)
      await Project.updateMany({ employees: user._id }, { $pull: { employees: user._id } })
      await Project.updateMany({ projectManagers: user._id }, { $pull: { projectManagers: user._id } })

      // 2. Add to assigned projects based on current role
      // Use the projects list from update if provided, else keep existing (but we just wiped them from Projects, so we must rely on user.assignedProjects)
      const projectsToSync = assignedProjects !== undefined ? assignedProjects : user.assignedProjects

      if (projectsToSync && projectsToSync.length > 0) {
        const currentRole = user.role
        const fieldToUpdate = ['manager', 'supermanager'].includes(currentRole) ? 'projectManagers' : 'employees'

        await Project.updateMany(
          { _id: { $in: projectsToSync } },
          { $addToSet: { [fieldToUpdate]: user._id } }
        )
      }
    }

    // Log Activity
    await ActivityLog.create({
      user: req.user._id,
      action: 'UPDATE_USER',
      description: `Updated employee: ${user.fullName}`,
      target: user._id.toString()
    })

    res.json({
      message: 'Employee updated successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        employeeId: user.employeeId
      }
    })
  } catch (error) {
    console.error('Update user error:', error)
    res.status(500).json({ message: 'Server error while updating user', error: error.message })
  }
})

// Admin: delete user
router.delete('/users/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    // Prevent deleting yourself
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot delete your own account' })
    }

    await User.findByIdAndDelete(req.params.id)

    // Log Activity
    await ActivityLog.create({
      user: req.user._id,
      action: 'DELETE_USER',
      description: `Deleted employee: ${user.fullName}`,
      target: user._id.toString()
    })

    res.json({ message: 'Employee deleted successfully' })
  } catch (error) {
    console.error('Delete user error:', error)
    res.status(500).json({ message: 'Server error while deleting user' })
  }
})

export default router

