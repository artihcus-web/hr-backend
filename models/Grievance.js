import mongoose from 'mongoose'

const grievanceSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    recipients: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }],
    issueType: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GrievanceType',
        required: true
    },
    subject: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['Open', 'In Progress', 'Resolved', 'Closed'],
        default: 'Open'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
})

// Index for fetching sent/received easily
grievanceSchema.index({ sender: 1, createdAt: -1 })
grievanceSchema.index({ recipients: 1, createdAt: -1 })

const Grievance = mongoose.model('Grievance', grievanceSchema)
export default Grievance
