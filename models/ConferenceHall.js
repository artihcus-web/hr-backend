import mongoose from 'mongoose'

const conferenceHallSchema = new mongoose.Schema({
  bookedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  teamName: {
    type: String,
    required: true,
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  date: {
    type: String,
    required: true
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
})

// Index for fetching bookings by date
conferenceHallSchema.index({ date: 1, startTime: 1 })
conferenceHallSchema.index({ bookedBy: 1, createdAt: -1 })

const ConferenceHall = mongoose.model('ConferenceHall', conferenceHallSchema)
export default ConferenceHall
