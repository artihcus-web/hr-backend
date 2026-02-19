import mongoose from 'mongoose'

const holidaySchema = new mongoose.Schema({
  year: { type: Number, required: true, index: true },
  month: { type: Number, required: true, min: 0, max: 11 },
  day: { type: Number, required: true, min: 1, max: 31 },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true })

holidaySchema.index({ year: 1, month: 1, day: 1 })

const Holiday = mongoose.model('Holiday', holidaySchema)
export default Holiday
