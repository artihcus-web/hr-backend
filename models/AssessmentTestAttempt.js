import mongoose from 'mongoose'

const questionAttemptSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AssessmentQuestion' },
  section: { type: String, default: '' },
  type: { type: String, default: '' },
  text: { type: String, default: '' },
  answered: { type: Boolean, default: false },
  visited: { type: Boolean, default: false },
  userAnswer: { type: String, default: '' },
  correctAnswer: { type: String, default: '' },
  isCorrect: { type: Boolean, default: false }
}, { _id: false })

const assessmentTestAttemptSchema = new mongoose.Schema({
  // who
  employeeId: { type: String, required: true, index: true },

  // what
  testId: { type: mongoose.Schema.Types.ObjectId, ref: 'AssessmentTest', required: true, index: true },
  moduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'AssessmentModule', required: true, index: true },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'AssessmentDepartment' },

  // snapshot names (for stable reporting even if renamed later)
  testName: { type: String, required: true },
  moduleName: { type: String, required: true },
  departmentName: { type: String, default: '' },

  // timing
  startedAt: { type: Date, required: true },
  endedAt: { type: Date, required: true },
  durationSeconds: { type: Number, default: 0 },

  // how it ended
  endReasonCode: { type: String, enum: ['user_submitted', 'tab_switch', 'time_up', 'forced_exit', 'unknown'], default: 'unknown' },
  endReasonText: { type: String, default: '' },

  // analytics
  totalQuestionsServed: { type: Number, default: 0 },
  questionsVisitedCount: { type: Number, default: 0 },
  questionsAnsweredCount: { type: Number, default: 0 },
  correctCount: { type: Number, default: 0 },
  scorePercent: { type: Number, default: 0 },
  passed: { type: Boolean, default: false },

  // per-question breakdown (optional, but useful)
  questions: { type: [questionAttemptSchema], default: [] }
}, { timestamps: true })

assessmentTestAttemptSchema.index({ employeeId: 1, testId: 1, createdAt: -1 })
assessmentTestAttemptSchema.index({ moduleId: 1, createdAt: -1 })
assessmentTestAttemptSchema.index({ departmentId: 1, createdAt: -1 })

const AssessmentTestAttempt = mongoose.model('AssessmentTestAttempt', assessmentTestAttemptSchema)
export default AssessmentTestAttempt

