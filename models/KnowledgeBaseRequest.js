import mongoose from 'mongoose'

const knowledgeBaseRequestSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, trim: true },
  requesterName: { type: String, trim: true },
  title: { type: String, trim: true },
  description: { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  // When approved: document stored in GridFS
  gridFsFileId: { type: mongoose.Schema.Types.ObjectId },
  documentTitle: { type: String, trim: true },
  fileName: { type: String, trim: true },
  mimeType: { type: String, default: 'application/octet-stream' },
  respondedAt: { type: Date }
}, { timestamps: true })

knowledgeBaseRequestSchema.index({ employeeId: 1, status: 1 })
knowledgeBaseRequestSchema.index({ status: 1, createdAt: -1 })

const KnowledgeBaseRequest = mongoose.model('KnowledgeBaseRequest', knowledgeBaseRequestSchema)
export default KnowledgeBaseRequest
