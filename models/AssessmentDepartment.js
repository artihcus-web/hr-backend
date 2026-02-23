import mongoose from 'mongoose'

const assessmentDepartmentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true }
}, { timestamps: true })

assessmentDepartmentSchema.index({ name: 1 })

const AssessmentDepartment = mongoose.model('AssessmentDepartment', assessmentDepartmentSchema)
export default AssessmentDepartment
