import jwt from 'jsonwebtoken'
import User from '../models/User.js'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production'

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ [AUTH] Missing or invalid Authorization header:', authHeader)
      return res.status(401).json({ message: 'Authentication required' })
    }

    const token = authHeader.split(' ')[1]
    // console.log('Checking Token:', token) // Optional: heavy noise

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET)
    } catch (err) {
      console.log('❌ [AUTH] Token verification failed:', err.message)
      return res.status(401).json({ message: 'Invalid or expired token' })
    }

    const user = await User.findById(decoded.userId).select('-password')
    if (!user) {
      console.log('❌ [AUTH] User not found for ID:', decoded.userId)
      return res.status(401).json({ message: 'User not found' })
    }

    req.user = user
    next()
  } catch (error) {
    console.error('❌ [AUTH] Unexpected Auth error:', error.message)
    return res.status(401).json({ message: 'Invalid or expired token' })
  }
}

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' })
  }

  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Forbidden: insufficient permissions' })
  }

  next()
}

