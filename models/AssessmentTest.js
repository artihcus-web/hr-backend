import mongoose from 'mongoose'

const testSettingsSchema = new mongoose.Schema({
  durationMinutes: { type: Number, default: 60, min: 1 },
  totalQuestions: { type: Number, default: 20, min: 1 },
  passingScore: { type: Number, default: 70, min: 0, max: 100 },
  shuffleQuestions: { type: Boolean, default: true },
  shuffleOptions: { type: Boolean, default: true },
  showResults: { type: Boolean, default: true },
  allowRetake: { type: Boolean, default: false },
  rules: { type: String, default: '' }
}, { _id: false })

const assessmentTestSchema = new mongoose.Schema({
  moduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'AssessmentModule', required: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  settings: { type: testSettingsSchema, default: () => ({}) },
  order: { type: Number, default: 0 }
}, { timestamps: true })

assessmentTestSchema.index({ moduleId: 1, order: 1 })

const AssessmentTest = mongoose.model('AssessmentTest', assessmentTestSchema)
export default AssessmentTest
