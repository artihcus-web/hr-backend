import mongoose from 'mongoose'

const benchSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  hrManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  employees: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
})

const Bench = mongoose.model('Bench', benchSchema)

export default Bench

