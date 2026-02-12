import express from 'express'
import PolicyDocument from '../models/PolicyDocument.js'
import { authenticate, requireRole } from '../middleware/auth.js'

const router = express.Router()

// Get all policy documents (accessible to all authenticated users)
router.get('/', authenticate, async (req, res) => {
    try {
        const documents = await PolicyDocument.find()
            .populate('uploadedBy', 'fullName email')
            .sort({ createdAt: -1 })
        
        res.json({ documents })
    } catch (error) {
        console.error('Error fetching policy documents:', error)
        res.status(500).json({ message: 'Server error while fetching documents' })
    }
})

// Upload a new policy document (admin only)
router.post('/', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
    try {
        const { title, description, fileName, fileData, fileSize } = req.body

        // Validation
        if (!title || !description || !fileName || !fileData) {
            return res.status(400).json({ message: 'Title, description, fileName, and fileData are required' })
        }

        // Validate file type (must be PDF)
        if (!fileName.toLowerCase().endsWith('.pdf')) {
            return res.status(400).json({ message: 'Only PDF files are allowed' })
        }

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024 // 10MB
        if (fileSize > maxSize) {
            return res.status(400).json({ message: 'File size must be less than 10MB' })
        }

        // Create document
        const document = new PolicyDocument({
            title: title.trim(),
            description: description.trim(),
            fileName,
            fileData, // Base64 encoded PDF
            fileSize,
            uploadedBy: req.user._id
        })

        await document.save()
        
        // Populate uploadedBy for response
        await document.populate('uploadedBy', 'fullName email')

        res.status(201).json({ 
            message: 'Policy document uploaded successfully',
            document 
        })
    } catch (error) {
        console.error('Error uploading policy document:', error)
        res.status(500).json({ message: 'Server error while uploading document' })
    }
})

// Download a policy document (accessible to all authenticated users)
router.get('/:id/download', authenticate, async (req, res) => {
    try {
        const document = await PolicyDocument.findById(req.params.id)
        
        if (!document) {
            return res.status(404).json({ message: 'Document not found' })
        }

        // Return file data and metadata
        res.json({
            fileName: document.fileName,
            fileData: document.fileData, // Base64 encoded
            fileSize: document.fileSize
        })
    } catch (error) {
        console.error('Error downloading policy document:', error)
        res.status(500).json({ message: 'Server error while downloading document' })
    }
})

// Delete a policy document (admin only)
router.delete('/:id', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
    try {
        const document = await PolicyDocument.findById(req.params.id)
        
        if (!document) {
            return res.status(404).json({ message: 'Document not found' })
        }

        await PolicyDocument.findByIdAndDelete(req.params.id)
        
        res.json({ message: 'Policy document deleted successfully' })
    } catch (error) {
        console.error('Error deleting policy document:', error)
        res.status(500).json({ message: 'Server error while deleting document' })
    }
})

export default router
