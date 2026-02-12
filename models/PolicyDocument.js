import mongoose from 'mongoose'

const policyDocumentSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    fileName: {
        type: String,
        required: true
    },
    fileData: {
        type: String, // Base64 encoded PDF
        required: true
    },
    fileSize: {
        type: Number, // Size in bytes
        required: true
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
})

// Index for sorting
policyDocumentSchema.index({ createdAt: -1 })

const PolicyDocument = mongoose.model('PolicyDocument', policyDocumentSchema)
export default PolicyDocument
