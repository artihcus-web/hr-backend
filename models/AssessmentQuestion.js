import mongoose from 'mongoose'

const assessmentQuestionSchema = new mongoose.Schema({
  testId: { type: mongoose.Schema.Types.ObjectId, ref: 'AssessmentTest', required: true },
  section: { type: String, required: true, trim: true },
  type: {
    type: String,
    required: true,
    enum: ['mcq', 'yes_no', 'fill_blanks', 'short_answer', 'long_answer'],
    trim: true
  },
  text: { type: String, required: true },
  options: [{
    label: { type: String }, // A, B, C, D or "Yes", "No"
    text: { type: String }
  }],
  correctAnswer: { type: String, required: true }, // A/B/C/D, Yes/No, or exact text(s) separated by |
  order: { type: Number, default: 0 }
}, { timestamps: true })

assessmentQuestionSchema.index({ testId: 1, order: 1 })
assessmentQuestionSchema.index({ testId: 1, section: 1 })

const AssessmentQuestion = mongoose.model('AssessmentQuestion', assessmentQuestionSchema)
export default AssessmentQuestion
