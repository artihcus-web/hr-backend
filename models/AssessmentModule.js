import mongoose from 'mongoose'

const moduleSettingsSchema = new mongoose.Schema({
  durationMinutes: { type: Number, default: 60, min: 1 },
  totalQuestions: { type: Number, default: 20, min: 1 },
  passingScore: { type: Number, default: 70, min: 0, max: 100 },
  shuffleQuestions: { type: Boolean, default: true },
  shuffleOptions: { type: Boolean, default: true },
  showResults: { type: Boolean, default: true },
  allowRetake: { type: Boolean, default: false },
  rules: { type: String, default: '' }
}, { _id: false })

const assessmentModuleSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  settings: { type: moduleSettingsSchema, default: () => ({}) }
}, { timestamps: true })

assessmentModuleSchema.index({ name: 1 })

const AssessmentModule = mongoose.model('AssessmentModule', assessmentModuleSchema)
export default AssessmentModule
