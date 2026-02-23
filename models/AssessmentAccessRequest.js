import mongoose from 'mongoose'

const assessmentAccessRequestSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, trim: true },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'AssessmentDepartment' },
  departmentName: { type: String, trim: true }, // denormalized for display
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,
  rejectedAt: Date,
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true })

// Prevent duplicate pending requests for same employee
assessmentAccessRequestSchema.index({ employeeId: 1, status: 1 })

const AssessmentAccessRequest = mongoose.model('AssessmentAccessRequest', assessmentAccessRequestSchema)
export default AssessmentAccessRequest
