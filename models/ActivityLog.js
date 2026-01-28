import mongoose from 'mongoose'

const activityLogSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    action: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    target: {
        type: String // Optional: can be a project name, user name, etc.
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed // Flexible field for any extra data
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
})

// Index for faster queries
activityLogSchema.index({ timestamp: -1 })

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema)
export default ActivityLog
