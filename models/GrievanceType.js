import mongoose from 'mongoose'

const grievanceTypeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    assignedHrs: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
})

const GrievanceType = mongoose.model('GrievanceType', grievanceTypeSchema)
export default GrievanceType
