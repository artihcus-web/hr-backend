import express from 'express'
import multer from 'multer'
import { ObjectId } from 'mongodb'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import Project from '../models/Project.js'
import ActivityLog from '../models/ActivityLog.js'
import { authenticate, requireRole } from '../middleware/auth.js'
import crypto from 'crypto'
import { sendPasswordResetEmail } from '../services/emailService.js'
import { gfsBucket } from '../server.js'
import { transformProfileImage } from '../utils/transformUser.js'

// Use memory storage for GridFS (files stored in MongoDB, not filesystem)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 }, // 1MB limit
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/jpg'].includes(file.mimetype)) {
      return cb(null, true)
    }
    cb(new Error('Only JPEG and PNG images are allowed'))
  }
})

const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production'

// Forgot Password Route
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ message: 'Email is required' })

    const user = await User.findOne({ officialEmail: email.toLowerCase() })
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

    // Send email to official email
    const emailSent = await sendPasswordResetEmail(user.officialEmail, resetUrl)

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
    const identifierLower = identifier.toLowerCase()

    // Login with official email or employee ID only
    const user = await User.findOne({
      $or: [
        { employeeId: identifier },
        { officialEmail: identifierLower }
      ]
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

    // Return full user (same as /me) - refetch by id to match /me exactly (includes profileImage)
    const freshUser = await User.findById(user._id).select('-password')
    if (!freshUser) {
      return res.status(500).json({ message: 'User not found after login' })
    }
    const userObj = freshUser.toObject ? freshUser.toObject() : { ...freshUser }
    const uid = String(freshUser._id || user._id)
    const base = { ...userObj, _id: uid, id: uid }
    if (freshUser.managerId) {
      const manager = await User.findById(freshUser.managerId).select('fullName')
      if (manager) base.managerName = manager.fullName
    }
    const transformedUser = transformProfileImage(base)
    // Force _id, id, and profileImage so header gets avatar immediately after login
    const responseUser = {
      ...transformedUser,
      _id: uid,
      id: uid
    }
    if (freshUser.profileImage) {
      responseUser.profileImage = (typeof transformedUser.profileImage === 'string' && transformedUser.profileImage.includes('/avatar'))
        ? transformedUser.profileImage
        : `/api/auth/users/${uid}/avatar`
    }

    res.json({
      message: 'Login successful',
      token,
      user: responseUser
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

    // Transform GridFS ID to endpoint URL
    const transformedUser = transformProfileImage({ ...user, _id: user._id })
    res.json({ user: transformedUser })
  } catch (error) {
    console.error('Error fetching me:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Check uniqueness of employee fields
router.post('/users/check-uniqueness', authenticate, requireRole('admin', 'hr'), async (req, res) => {
  try {
    const { field, value, excludeUserId } = req.body
    
    if (!field || value === undefined || value === null || value === '') {
      return res.json({ isUnique: true })
    }

    // Fields that should be unique
    const uniqueFields = [
      'employeeId',
      'phone',
      'secondaryContact',
      'email',
      'alternativeEmail',
      'officialEmail',
      'accountNumber',
      'aadharNumber',
      'panNumber',
      'passportNumber',
      'drivingLicense',
      'voterId',
      'pfNumber',
      'universalAccountNumber',
      'esiNumber'
    ]

    if (!uniqueFields.includes(field)) {
      return res.json({ isUnique: true })
    }

    const query = { [field]: value }
    if (excludeUserId) {
      query._id = { $ne: excludeUserId }
    }

    const existingUser = await User.findOne(query)
    
    res.json({ 
      isUnique: !existingUser,
      message: existingUser ? `${field} already exists` : null
    })
  } catch (error) {
    console.error('Check uniqueness error:', error)
    res.status(500).json({ message: 'Server error while checking uniqueness' })
  }
})

// Admin: create users with specific roles (supports draft creation for section-by-section save)
router.post('/users', authenticate, requireRole('admin', 'hr'), async (req, res) => {
  try {
    const { firstName, email, phone, employeeId, officialEmail, role = 'employee', password, username, loginUsername, fullName, lastName, assignedProjects, draft, ...otherFields } = req.body

    const isDraft = draft === true || draft === 'true'

    // Helper to safely trim values that might be numbers/other types (e.g. from Excel import)
    const safeTrim = (value) => {
      if (value === undefined || value === null) return ''
      return String(value).trim()
    }

    if (isDraft) {
      // Draft creation: only require firstName so user can save Basic Info first, then other sections
      if (!firstName || !firstName.trim()) {
        return res.status(400).json({ message: 'First Name is required' })
      }
    } else {
      // Full creation: require all fields
      if (!firstName || !phone || !employeeId || !role || !officialEmail) {
        return res.status(400).json({
          message: 'firstName, phone, employeeId, officialEmail, and role are required'
        })
      }
    }

    const trimmedPhone = safeTrim(phone)
    const trimmedEmployeeId = safeTrim(employeeId)
    const trimmedOfficialEmail = safeTrim(officialEmail)

    const finalPhone = trimmedPhone ? trimmedPhone : (isDraft ? `0000000000` : null)
    const finalEmployeeId = trimmedEmployeeId ? trimmedEmployeeId : (isDraft ? `DRAFT-${Date.now()}` : null)
    const finalOfficialEmail = trimmedOfficialEmail
      ? trimmedOfficialEmail.toLowerCase()
      : (isDraft ? `draft-${Date.now()}-${Math.random().toString(36).slice(2, 10)}@temp.local` : null)
    const finalRole = role || 'employee'

    if (!isDraft && (!finalPhone || !finalEmployeeId || !finalOfficialEmail)) {
      return res.status(400).json({
        message: 'firstName, phone, employeeId, officialEmail, and role are required'
      })
    }

    const finalPassword = password || (finalEmployeeId && finalEmployeeId.startsWith('DRAFT-') ? `Temp@${Date.now().toString().slice(-4)}` : finalEmployeeId)

    // Accept any non-empty role (supports dynamic roles from schema config)
    const normalizedRole = String(finalRole).trim().toLowerCase()
    if (!normalizedRole) {
      return res.status(400).json({ message: 'Role is required' })
    }

    // Generate username if not provided (draft needs unique username)
    const baseUsername = username || loginUsername || (finalEmployeeId && !finalEmployeeId.startsWith('DRAFT-') ? finalEmployeeId : null) || (finalOfficialEmail && !finalOfficialEmail.includes('@temp.local') ? finalOfficialEmail.split('@')[0] : null)
    const finalUsername = baseUsername || (isDraft ? `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` : '')

    // Generate fullName if not provided
    const finalFullName = fullName || `${firstName} ${lastName || ''}`.trim()

    // Check for existing user (skip for draft placeholders that we generate)
    const existingUser = await User.findOne({
      $or: [
        { username: finalUsername },
        ...(finalOfficialEmail && !finalOfficialEmail.includes('@temp.local') ? [{ officialEmail: finalOfficialEmail }] : []),
        ...(finalEmployeeId && !finalEmployeeId.startsWith('DRAFT-') ? [{ employeeId: finalEmployeeId }] : [])
      ].filter(Boolean)
    })

    if (existingUser) {
      let message = 'User already exists'
      if (existingUser.username === finalUsername) message = 'Username already exists'
      else if (finalOfficialEmail && existingUser.officialEmail === finalOfficialEmail) message = 'Official Email already exists'
      else if (finalEmployeeId && existingUser.employeeId === finalEmployeeId) message = 'Employee ID already exists'
      return res.status(400).json({ message })
    }

    // Check uniqueness for other critical fields
    const uniqueFields = [
      { field: 'phone', value: finalPhone },
      { field: 'secondaryContact', value: req.body.secondaryContact },
      { field: 'email', value: req.body.email },
      { field: 'alternativeEmail', value: req.body.alternativeEmail },
      { field: 'accountNumber', value: req.body.accountNumber },
      { field: 'aadharNumber', value: req.body.aadharNumber },
      { field: 'panNumber', value: req.body.panNumber },
      { field: 'passportNumber', value: req.body.passportNumber },
      { field: 'drivingLicense', value: req.body.drivingLicense },
      { field: 'voterId', value: req.body.voterId },
      { field: 'pfNumber', value: req.body.pfNumber },
      { field: 'universalAccountNumber', value: req.body.universalAccountNumber },
      { field: 'esiNumber', value: req.body.esiNumber }
    ]

    for (const { field, value } of uniqueFields) {
      if (value && String(value).trim() && !(field === 'phone' && finalPhone === '0000000000') && !(field === 'employeeId' && finalEmployeeId?.startsWith('DRAFT-'))) {
        const existing = await User.findOne({ [field]: String(value).trim() })
        if (existing) {
          const fieldLabel = field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
          return res.status(400).json({ message: `${fieldLabel} already exists` })
        }
      }
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

    // Helper to convert string "Yes"/"No"/"true"/"false" to boolean (form/schema often send strings)
    const parseBoolean = (value) => {
      if (value === true || value === false) return value
      if (value === undefined || value === null) return undefined
      const s = String(value).trim().toLowerCase()
      if (s === 'true' || s === 'yes' || s === '1' || s === 'on') return true
      if (s === 'false' || s === 'no' || s === '0' || s === 'off' || s === '') return false
      return undefined
    }

    // Date fields that need conversion
    const dateFields = ['dateOfBirth', 'birthdayDate', 'marriageDate', 'joiningDate', 'confirmDate', 'completedOn', 'pfJoiningDate']

    // Number fields that need conversion
    const numberFields = ['probationPeriod', 'noticePeriod', 'salary', 'numberOfChildren']

    // Boolean fields (form may send "Yes"/"No" or string "true"/"false")
    const booleanFields = ['isPhysicallyChallenged', 'isInternationalEmployee', 'isEligibleForPF', 'eligibleForExcessEPFContribution', 'isEligibleForExcessEPSContribution', 'isExistingMemberOfPF', 'isEligibleForESI', 'isCoveredUnderLWF', 'isActive']

    // Build user data object (avoid email: null to prevent E11000 duplicate key on email index)
    const finalEmail = email && String(email).trim()
      ? email.toLowerCase()
      : (isDraft ? `draft-email-${Date.now()}-${Math.random().toString(36).slice(2, 10)}@temp.local` : undefined)
    const userData = {
      username: finalUsername,
      officialEmail: finalOfficialEmail,
      email: finalEmail,
      password: finalPassword,
      role: normalizedRole,
      fullName: finalFullName,
      firstName,
      lastName,
      phone: finalPhone,
      employeeId: finalEmployeeId,
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

    // Convert boolean fields (accept "Yes"/"No", "true"/"false", 1/0)
    booleanFields.forEach(field => {
      if (userData[field] !== undefined && userData[field] !== null) {
        const parsed = parseBoolean(userData[field])
        if (parsed !== undefined) userData[field] = parsed
      }
    })

    // Validate PDF attachments (Education and Documents)
    if (userData.education && Array.isArray(userData.education)) {
      for (const edu of userData.education) {
        if (edu.fileName && !edu.fileName.toLowerCase().endsWith('.pdf')) {
          return res.status(400).json({ message: 'Education attachments must be PDF files only. Invalid file: ' + edu.fileName })
        }
      }
    }
    if (userData.documents && Array.isArray(userData.documents)) {
      for (const doc of userData.documents) {
        if (doc.fileName && !doc.fileName.toLowerCase().endsWith('.pdf')) {
          return res.status(400).json({ message: 'Document attachments must be PDF files only. Invalid file: ' + doc.fileName })
        }
      }
    }
    if (userData.experience && Array.isArray(userData.experience)) {
      for (const exp of userData.experience) {
        if (exp.attachments && Array.isArray(exp.attachments)) {
          for (const att of exp.attachments) {
            if (att.fileName && !String(att.fileName).toLowerCase().endsWith('.pdf')) {
              return res.status(400).json({ message: 'Experience attachments must be PDF only. Invalid file: ' + att.fileName })
            }
          }
        }
      }
    }

    // Remove empty strings (keep false/0 values for booleans/numbers)
    Object.keys(userData).forEach(key => {
      if (userData[key] === '' || userData[key] === null) {
        delete userData[key]
      }
    })

    // Never store profile image as base64; use avatar upload endpoint and store URL only
    if (userData.profileImage && String(userData.profileImage).startsWith('data:image')) {
      delete userData.profileImage
    }

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

    try {
      if (req.user && req.user._id) {
        await ActivityLog.create({
          user: req.user._id,
          action: 'CREATE_USER',
          description: `Created new employee: ${user.fullName || user.username} (${user.role})`,
          target: user._id.toString()
        })
      }
    } catch (logErr) {
      console.error('ActivityLog create failed:', logErr)
    }

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
    const isDev = process.env.NODE_ENV === 'development'
    if (error.name === 'ValidationError') {
      const msg = error.message || 'Validation failed'
      return res.status(400).json({ message: msg })
    }
    if (error.code === 11000) {
      const field = error.keyPattern ? Object.keys(error.keyPattern)[0] : 'field'
      return res.status(400).json({ message: `Duplicate value for ${field}` })
    }
    res.status(500).json({
      message: 'Server error while creating user',
      ...(isDev && { error: error.message })
    })
  }
})

// Admin: list users (basic)
router.get('/users', authenticate, requireRole('admin', 'c-suite', 'hr'), async (_req, res) => {
  try {
    const users = await User.find().select('-password').lean()
    const activeProjects = await Project.find({ status: { $in: ['active', 'In Progress'] } }).select('projectName employees projectManagers').lean()
    const userList = Array.isArray(users) ? users : []
    const projectList = Array.isArray(activeProjects) ? activeProjects : []

    const usersWithAssignments = userList.map(user => {
      try {
        const u = { ...user }
        const userIdStr = u._id ? u._id.toString() : ''
        if (!userIdStr) return transformProfileImage(u)

        if (u.role === 'admin') {
          return transformProfileImage(u)
        }

        u.currentAssignments = projectList.reduce((acc, p) => {
          try {
            const managers = p.projectManagers || []
            const employees = p.employees || []
            const isManager = managers.some(id => id && id.toString() === userIdStr)
            const isEmployee = employees.some(id => id && id.toString() === userIdStr)
            if (isManager || isEmployee) {
              acc.push({
                projectName: p.projectName || '',
                role: isManager ? 'Manager' : 'Member'
              })
            }
          } catch { /* skip bad project */ }
          return acc
        }, [])

        return transformProfileImage(u)
      } catch (err) {
        console.error('List users: transform error for user', user?._id, err.message)
        return transformProfileImage(user ? { ...user } : {})
      }
    })

    res.json({ users: usersWithAssignments })
  } catch (error) {
    console.error('List users error:', error)
    res.status(500).json({
      message: 'Server error while listing users',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Admin/HR: get single user by ID
router.get('/users/:id', authenticate, requireRole('admin', 'hr'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password')
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }
    const transformedUser = transformProfileImage(user)
    res.json({ user: transformedUser })
  } catch (error) {
    console.error('Get user error:', error)
    res.status(500).json({ message: 'Server error while fetching user' })
  }
})

// GET: Serve profile image from GridFS
router.get('/users/:id/avatar', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    if (!user.profileImage) {
      return res.status(404).json({ message: 'Profile image not found' })
    }

    if (!gfsBucket) {
      console.error('GridFS bucket not initialized')
      return res.status(500).json({ message: 'Image storage not available' })
    }

    // Get the raw profileImage value from database
    let fileId

    // Handle different formats:
    // 1. GridFS ObjectId (24 char hex string) - stored in database
    if (ObjectId.isValid(user.profileImage)) {
      fileId = new ObjectId(user.profileImage)
    }
    // 2. Path format (/api/auth/users/:id/avatar) - find by metadata.userId
    else if (typeof user.profileImage === 'string' && user.profileImage.includes('/avatar')) {
      const filesByMetadata = await gfsBucket.find({ 'metadata.userId': req.params.id })
        .sort({ uploadDate: -1 })
        .limit(1)
        .toArray()
      if (filesByMetadata.length === 0) {
        return res.status(404).json({ message: 'Image file not found in storage' })
      }
      fileId = filesByMetadata[0]._id
    }
    else {
      return res.status(404).json({ message: 'Invalid image format. Please re-upload.' })
    }

    // Check if file exists in GridFS
    const files = await gfsBucket.find({ _id: fileId }).toArray()
    if (!files || files.length === 0) {
      console.error(`GridFS file not found: fileId=${fileId}, userId=${req.params.id}`)
      return res.status(404).json({ message: 'Image file not found in storage' })
    }

    const file = files[0]
    
    // Set cache headers
    res.setHeader('Content-Type', file.contentType || 'image/jpeg')
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.setHeader('Content-Length', file.length)

    // Stream file from GridFS
    const downloadStream = gfsBucket.openDownloadStream(fileId)
    downloadStream.pipe(res)
    
    downloadStream.on('error', (error) => {
      console.error('GridFS stream error:', error)
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error streaming image' })
      }
    })
  } catch (error) {
    console.error('Avatar serve error:', error)
    res.status(500).json({ message: 'Server error while serving avatar', error: error.message })
  }
})

// Admin/HR: upload profile image to GridFS. Must be before PUT /users/:id
router.put('/users/:id/avatar', authenticate, requireRole('admin', 'hr'), upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided. Use field name "avatar".' })
    }

    const user = await User.findById(req.params.id)
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    // Delete old image from GridFS if exists
    if (user.profileImage && ObjectId.isValid(user.profileImage)) {
      try {
        await gfsBucket.delete(new ObjectId(user.profileImage))
      } catch (err) {
        console.warn('Could not delete old image:', err.message)
      }
    }

    // Generate unique filename
    const filename = `${req.params.id}-${Date.now()}-${req.file.originalname || 'avatar.jpg'}`

    // Create upload stream to GridFS
    const uploadStream = gfsBucket.openUploadStream(filename, {
      contentType: req.file.mimetype,
      metadata: {
        userId: req.params.id,
        originalName: req.file.originalname,
        uploadedAt: new Date()
      }
    })

    // Write buffer to GridFS
    uploadStream.end(req.file.buffer)

    // Wait for upload to complete
    uploadStream.on('finish', async () => {
      try {
        // Store GridFS file ID in user document
        user.profileImage = uploadStream.id.toString()
        user.profileImageOriginalName = req.file.originalname || user.profileImageOriginalName
        await user.save()

        // Return API endpoint URL (not GridFS ID)
        const imageUrl = `/api/auth/users/${user._id}/avatar`
        res.json({ 
          profileImage: imageUrl,
          profileImageOriginalName: user.profileImageOriginalName 
        })
      } catch (error) {
        console.error('Error saving user after upload:', error)
        res.status(500).json({ message: 'Error saving user data', error: error.message })
      }
    })

    uploadStream.on('error', (error) => {
      console.error('GridFS upload error:', error)
      res.status(500).json({ message: 'Error uploading image to storage', error: error.message })
    })
  } catch (error) {
    console.error('Avatar upload error:', error)
    res.status(500).json({ message: 'Server error while uploading avatar', error: error.message })
  }
})

// Admin/HR: update user
router.put('/users/:id', authenticate, requireRole('admin', 'hr'), async (req, res) => {
  try {
    const { firstName, email, phone, employeeId, officialEmail, role, password, username, loginUsername, fullName, lastName, middleName, isActive, assignedProjects, ...otherFields } = req.body

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

    const parseBoolean = (value) => {
      if (value === true || value === false) return value
      if (value === undefined || value === null) return undefined
      const s = String(value).trim().toLowerCase()
      if (s === 'true' || s === 'yes' || s === '1' || s === 'on') return true
      if (s === 'false' || s === 'no' || s === '0' || s === 'off' || s === '') return false
      return undefined
    }

    // Date fields that need conversion
    const dateFields = ['dateOfBirth', 'birthdayDate', 'marriageDate', 'joiningDate', 'confirmDate', 'completedOn', 'pfJoiningDate']

    // Number fields that need conversion
    const numberFields = ['probationPeriod', 'noticePeriod', 'salary']

    const booleanFields = ['isPhysicallyChallenged', 'isInternationalEmployee', 'isEligibleForPF', 'eligibleForExcessEPFContribution', 'isEligibleForExcessEPSContribution', 'isExistingMemberOfPF', 'isEligibleForESI', 'isCoveredUnderLWF', 'isActive']

    // Build update object
    const updateData = {}

    if (firstName) updateData.firstName = firstName
    if (lastName !== undefined) updateData.lastName = lastName
    if (middleName !== undefined) updateData.middleName = middleName
    // Only set email when it has a value - empty/null causes MongoDB E11000 duplicate key on email index
    if (email !== undefined && email !== null && String(email).trim()) {
      updateData.email = String(email).trim().toLowerCase()
    }
    if (officialEmail) updateData.officialEmail = officialEmail.toLowerCase()
    if (phone) updateData.phone = phone
    if (employeeId) updateData.employeeId = employeeId
    if (role) updateData.role = String(role).trim().toLowerCase()
    if (fullName) updateData.fullName = fullName
    if (username || loginUsername) updateData.username = username || loginUsername || employeeId || officialEmail?.split('@')[0]
    if (password) updateData.password = password // Will be hashed by pre-save hook
    if (isActive !== undefined) {
      const parsed = parseBoolean(isActive)
      if (parsed !== undefined) updateData.isActive = parsed
    }
    if (assignedProjects !== undefined) updateData.assignedProjects = assignedProjects

    // Check uniqueness for critical fields before updating
    const uniqueFields = [
      'employeeId',
      'phone',
      'secondaryContact',
      'email',
      'alternativeEmail',
      'officialEmail',
      'accountNumber',
      'aadharNumber',
      'panNumber',
      'passportNumber',
      'drivingLicense',
      'voterId',
      'pfNumber',
      'universalAccountNumber',
      'esiNumber'
    ]

    for (const field of uniqueFields) {
      const value = updateData[field] || otherFields[field]
      if (value && String(value).trim()) {
        const existingUser = await User.findOne({
          [field]: String(value).trim(),
          _id: { $ne: req.params.id }
        })
        if (existingUser) {
          const fieldLabel = field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
          return res.status(400).json({ message: `${fieldLabel} already exists` })
        }
      }
    }

    // Add other fields
    Object.keys(otherFields).forEach(key => {
      if (otherFields[key] !== undefined && otherFields[key] !== '' && otherFields[key] !== null) {
        updateData[key] = otherFields[key]
      }
    })

    // Never store profile image as base64; use avatar upload endpoint
    if (updateData.profileImage && String(updateData.profileImage).startsWith('data:image')) {
      delete updateData.profileImage
    }

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

    // Convert boolean fields (form may send "Yes"/"No" or string "true"/"false")
    booleanFields.forEach(field => {
      if (updateData[field] !== undefined && updateData[field] !== null) {
        const parsed = parseBoolean(updateData[field])
        if (parsed !== undefined) updateData[field] = parsed
      }
    })

    // Validate PDF attachments (Education and Documents)
    if (updateData.education && Array.isArray(updateData.education)) {
      for (const edu of updateData.education) {
        if (edu.fileName && !edu.fileName.toLowerCase().endsWith('.pdf')) {
          return res.status(400).json({ message: 'Education attachments must be PDF files only. Invalid file: ' + edu.fileName })
        }
      }
    }
    if (updateData.documents && Array.isArray(updateData.documents)) {
      for (const doc of updateData.documents) {
        if (doc.fileName && !doc.fileName.toLowerCase().endsWith('.pdf')) {
          return res.status(400).json({ message: 'Document attachments must be PDF files only. Invalid file: ' + doc.fileName })
        }
      }
    }
    if (updateData.experience && Array.isArray(updateData.experience)) {
      for (const exp of updateData.experience) {
        if (exp.attachments && Array.isArray(exp.attachments)) {
          for (const att of exp.attachments) {
            if (att.fileName && !String(att.fileName).toLowerCase().endsWith('.pdf')) {
              return res.status(400).json({ message: 'Experience attachments must be PDF only. Invalid file: ' + att.fileName })
            }
          }
        }
      }
    }

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

    // MongoDB duplicate key (E11000) - return user-friendly message
    if (error.code === 11000 || error.name === 'MongoServerError') {
      const keyMatch = error.message?.match(/dup key: \{ ([^}]+) \}/)
      const keyValue = keyMatch ? keyMatch[1] : 'field'
      let fieldName = keyValue.split(':')[0]?.trim() || 'field'
      fieldName = fieldName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
      const value = keyValue.includes(':') ? keyValue.split(':')[1]?.trim() : ''
      if (value === 'null' || value === '""') {
        return res.status(400).json({
          message: `${fieldName} cannot be empty when another user already has no value. Please enter a unique ${fieldName.toLowerCase()}.`
        })
      }
      return res.status(400).json({
        message: `${fieldName} already exists. Please use a different value.`
      })
    }

    // Mongoose validation error
    if (error.name === 'ValidationError') {
      const firstErr = Object.values(error.errors || {})[0]
      const msg = firstErr?.message || error.message
      return res.status(400).json({ message: msg })
    }

    // Return actual error message for client to display
    const userMessage = error.message || 'Server error while updating user'
    res.status(500).json({ message: userMessage })
  }
})

// Admin/HR: delete user
router.delete('/users/:id', authenticate, requireRole('admin', 'hr'), async (req, res) => {
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

