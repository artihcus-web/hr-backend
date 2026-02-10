import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/auth.js'
import projectRoutes from './routes/projects.js'
import timesheetRoutes from './routes/timesheet.js'
import benchRoutes from './routes/benches.js'
import employeeRoutes from './routes/employees.js'
import activityRoutes from './routes/activity.js'
import grievanceRoutes from './routes/grievance.js'
import formConfigRoutes from './routes/formConfig.js'
import User from './models/User.js'

// CI/CD auto-deployment: Builds Docker image, pushes to Docker Hub, deploys to server
// Last auto-deployed: SUCCESS! Heredoc with EOF - Auto-deployment fully working!
dotenv.config()

const app = express()

// Use FRONTEND_URL env in production, fall back to common local/dev origins
const defaultOrigins = [
  'https://hr.artihcus.com',
  'https://ticket.artihcus.com',
  'https://fer-henna-omega.vercel.app',
  'http://localhost:5175',
  'http://localhost:5173',
  'http://localhost:3000'
]

const envOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
  : []

const allowedOrigins = [...new Set([...envOrigins, ...defaultOrigins])]

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true)
    }

    // Allow all localhost/127.0.0.1 origins for development
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return callback(null, origin)
    }

    // Normalize origin (remove trailing slash)
    const normalizedOrigin = origin.replace(/\/$/, '')
    const normalizedAllowedOrigins = allowedOrigins.map(o => o.replace(/\/$/, ''))

    if (normalizedAllowedOrigins.includes(normalizedOrigin) || normalizedAllowedOrigins.includes('*')) {
      console.log(`✅ CORS allowed: ${origin}`)
      callback(null, origin)
    } else {
      console.log(`❌ CORS blocked origin: ${origin}`)
      console.log(`✅ Allowed origins:`, normalizedAllowedOrigins)
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}))

// Explicitly handle preflight for all routes
app.options('*', cors())

app.use(express.json())

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api/timesheet', timesheetRoutes)
app.use('/api/benches', benchRoutes)
app.use('/api/employees', employeeRoutes)
app.use('/api/activity', activityRoutes)
app.use('/api/grievance', grievanceRoutes)
app.use('/api/form-config', formConfigRoutes)

// Health check route
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'OK',
    message: 'CI/CD Pipeline - Fresh Build - Deployment Successful!',
    timestamp: new Date().toISOString(),
    version: 'v1.0.5',
    repo: 'artihcus-web/hr-backend',
    deployedBy: 'CI/CD Pipeline (GitHub Actions)',
    dockerImage: 'harshava123/hr-backend:latest',
    lastUpdated: '2026-01-09',
    buildTrigger: 'Force fresh build - no cache'
  })
})

// Root route for base URL check
app.get('/', (_req, res) => {
  res.send('API is running...')
})

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/myapp'
const PORT = process.env.PORT || 5000

// Try to connect to MongoDB, but allow server to run without it for local dev
const ensureDefaultAdmin = async () => {
  try {
    const adminExists = await User.findOne({ role: 'admin' })
    if (adminExists) return

    const username = process.env.ADMIN_USERNAME || 'admin'
    const email = process.env.ADMIN_EMAIL || 'admin@example.com'
    const password = process.env.ADMIN_PASSWORD || 'Admin@123'

    const user = new User({ username, email, password, role: 'admin', fullName: 'Super Admin' })
    await user.save()
    console.log('✅ Default admin created:', { username, email })
  } catch (err) {
    console.error('Failed to create default admin:', err.message)
  }
}

mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB')
    await ensureDefaultAdmin()
  })
  .catch((error) => {
    console.warn('⚠️  MongoDB connection failed:', error.message)
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ Exiting in production mode')
      process.exit(1)
    } else {
      console.log('💡 Running in development mode without MongoDB')
    }
  })

// Start server regardless of MongoDB connection (for local dev)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📍 Access at http://localhost:${PORT}`)
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`)
})

export default app
