import mongoose from 'mongoose'

const assessmentKnowledgeNoteSchema = new mongoose.Schema({
  moduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'AssessmentModule', required: true },
  title: { type: String, trim: true, default: '' },
  fileName: { type: String, required: true, trim: true },
  mimeType: { type: String, default: 'application/octet-stream' },
  gridFsFileId: { type: mongoose.Schema.Types.ObjectId, required: true }
}, { timestamps: true })

assessmentKnowledgeNoteSchema.index({ moduleId: 1 })

const AssessmentKnowledgeNote = mongoose.model('AssessmentKnowledgeNote', assessmentKnowledgeNoteSchema)
export default AssessmentKnowledgeNote
