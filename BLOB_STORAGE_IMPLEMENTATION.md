# Blob Storage Implementation Guide

## Option 1: Base64 Storage (Like Policy Documents)

### Step 1: Update User Model

```javascript
// In models/User.js
profileImage: String, // Base64 encoded image data
profileImageOriginalName: String,
profileImageSize: Number, // Size in bytes
profileImageMimeType: String, // e.g., 'image/jpeg', 'image/png'
```

### Step 2: Update Upload Route

```javascript
// In routes/auth.js - Replace multer upload with base64 handler
router.put('/users/:id/avatar', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { imageData, fileName, fileSize, mimeType } = req.body
    
    if (!imageData || !fileName) {
      return res.status(400).json({ message: 'Image data and filename required' })
    }
    
    // Validate file size (max 1MB)
    if (fileSize > 1024 * 1024) {
      return res.status(400).json({ message: 'Image size must be less than 1MB' })
    }
    
    // Validate image type
    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(mimeType)) {
      return res.status(400).json({ message: 'Only JPEG and PNG images allowed' })
    }
    
    // Remove data:image/...;base64, prefix if present
    const base64Data = imageData.includes(',') ? imageData.split(',')[1] : imageData
    
    const user = await User.findById(req.params.id)
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }
    
    user.profileImage = base64Data
    user.profileImageOriginalName = fileName
    user.profileImageSize = fileSize
    user.profileImageMimeType = mimeType
    await user.save()
    
    res.json({ 
      message: 'Profile image updated',
      profileImage: base64Data,
      profileImageOriginalName: fileName
    })
  } catch (error) {
    console.error('Avatar upload error:', error)
    res.status(500).json({ message: 'Server error while uploading avatar', error: error.message })
  }
})
```

### Step 3: Add Image Serving Endpoint

```javascript
// In routes/auth.js - Add endpoint to serve images
router.get('/users/:id/avatar', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('profileImage profileImageMimeType')
    
    if (!user || !user.profileImage) {
      return res.status(404).json({ message: 'Profile image not found' })
    }
    
    // Convert base64 to buffer
    const imageBuffer = Buffer.from(user.profileImage, 'base64')
    
    // Set headers
    res.setHeader('Content-Type', user.profileImageMimeType || 'image/jpeg')
    res.setHeader('Content-Length', imageBuffer.length)
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    
    // Send image
    res.send(imageBuffer)
  } catch (error) {
    console.error('Error serving avatar:', error)
    res.status(500).json({ message: 'Server error while serving avatar' })
  }
})
```

### Step 4: Update Frontend

```javascript
// In UserManagement.jsx - Update image upload handler
const handleProfileImageChange = async (e) => {
  const file = e.target.files[0]
  if (!file) return
  
  // Validate file size
  if (file.size > 1024 * 1024) {
    toast.error('Image size must be less than 1MB')
    return
  }
  
  // Validate file type
  if (!file.type.match(/^image\/(jpeg|jpg|png)$/)) {
    toast.error('Only JPEG and PNG images allowed')
    return
  }
  
  // Convert to base64
  const reader = new FileReader()
  reader.onload = async () => {
    const base64Data = reader.result // Includes data:image/...;base64, prefix
    
    try {
      const res = await axiosInstance.put(`/api/auth/users/${editingEmployee}/avatar`, {
        imageData: base64Data,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type
      })
      
      setFormData(prev => ({
        ...prev,
        profileImage: base64Data, // Store base64 for preview
        profileImageOriginalName: res.data.profileImageOriginalName
      }))
      toast.success('Profile image uploaded')
    } catch (error) {
      toast.error('Failed to upload image')
    }
  }
  reader.readAsDataURL(file)
}
```

### Step 5: Update Image URL Helper

```javascript
// In config/apiConfig.js
export function getProfileImageUrl(user) {
  if (!user) return ''
  
  // If base64 stored directly
  if (user.profileImage && user.profileImage.startsWith('data:image')) {
    return user.profileImage
  }
  
  // If base64 without prefix
  if (user.profileImage && !user.profileImage.startsWith('/') && !user.profileImage.startsWith('http')) {
    const mimeType = user.profileImageMimeType || 'image/jpeg'
    return `data:${mimeType};base64,${user.profileImage}`
  }
  
  // If file path (legacy)
  if (user.profileImage && user.profileImage.startsWith('/')) {
    const base = getApiBaseUrl()
    return `${base}${user.profileImage}`
  }
  
  // If using API endpoint
  if (user._id) {
    const base = getApiBaseUrl()
    return `${base}/api/auth/users/${user._id}/avatar`
  }
  
  return ''
}
```

## Option 2: MongoDB GridFS (For Large Files)

### Step 1: Install GridFS

```bash
npm install mongodb-gridfs
```

### Step 2: GridFS Implementation

```javascript
import Grid from 'gridfs-stream'
import mongoose from 'mongoose'

// Setup GridFS
let gfs
mongoose.connection.once('open', () => {
  gfs = Grid(mongoose.connection.db, mongoose.mongo)
  gfs.collection('uploads')
})

// Upload route
router.put('/users/:id/avatar', authenticate, requireRole('admin'), upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' })
    }
    
    const user = await User.findById(req.params.id)
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }
    
    // Delete old image if exists
    if (user.profileImage) {
      gfs.remove({ _id: user.profileImage, root: 'uploads' })
    }
    
    user.profileImage = req.file.id
    user.profileImageOriginalName = req.file.originalname
    await user.save()
    
    res.json({ 
      profileImage: `/api/auth/users/${user._id}/avatar`,
      profileImageOriginalName: user.profileImageOriginalName
    })
  } catch (error) {
    console.error('Avatar upload error:', error)
    res.status(500).json({ message: 'Server error', error: error.message })
  }
})

// Serve image route
router.get('/users/:id/avatar', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user || !user.profileImage) {
      return res.status(404).json({ message: 'Image not found' })
    }
    
    gfs.files.findOne({ _id: user.profileImage }, (err, file) => {
      if (!file || file.length === 0) {
        return res.status(404).json({ message: 'Image not found' })
      }
      
      res.setHeader('Content-Type', file.contentType)
      res.setHeader('Cache-Control', 'public, max-age=31536000')
      
      const readstream = gfs.createReadStream({ _id: user.profileImage })
      readstream.pipe(res)
    })
  } catch (error) {
    res.status(500).json({ message: 'Server error' })
  }
})
```

## Recommendation

**For your use case, I recommend:**

1. **Keep File System for Profile Images** ✅
   - Already working
   - Better performance
   - Browser caching
   - Just fix nginx config (already done)

2. **Use Blob Storage for Documents** ✅
   - Already implemented for policies
   - Extend to education/experience/documents
   - No file sync needed
   - Easier deployment

3. **Consider Cloud Storage (Future)**
   - If you need global CDN
   - If you have many large files
   - If you need automatic backups

## Migration Script (If Switching)

If you want to migrate existing file system images to blob storage:

```javascript
// migration-script.js
import mongoose from 'mongoose'
import fs from 'fs'
import path from 'path'
import User from './models/User.js'

const migrateImagesToBlob = async () => {
  const users = await User.find({ profileImage: { $exists: true, $ne: '' } })
  
  for (const user of users) {
    if (user.profileImage && user.profileImage.startsWith('/uploads')) {
      const filePath = path.join(__dirname, '..', user.profileImage)
      
      if (fs.existsSync(filePath)) {
        const fileBuffer = fs.readFileSync(filePath)
        const base64Data = fileBuffer.toString('base64')
        const mimeType = path.extname(filePath) === '.png' ? 'image/png' : 'image/jpeg'
        
        user.profileImage = base64Data
        user.profileImageMimeType = mimeType
        user.profileImageSize = fileBuffer.length
        await user.save()
        
        console.log(`Migrated image for user ${user._id}`)
      }
    }
  }
  
  console.log('Migration complete')
  process.exit(0)
}
```
