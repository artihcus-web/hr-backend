import mongoose from 'mongoose'

const timesheetSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  employeeName: {
    type: String,
    required: true
  },
  month: {
    type: String,
    required: true
  },
  weekStartDate: {
    type: Date,
    required: true
  },
  manager: {
    type: String
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  },
  projectName: {
    type: String
  },
  chargeCode: {
    type: String
  },
  // For daily grid entries
  dailyHours: [{
    type: String // e.g. "08h 00m" or "WO"
  }],
  // Array of project IDs included in this timesheet (for visibility)
  projectIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  }],
  // Keep legacy entries for backward compatibility if needed, or deprecate
  entries: [{
    date: String,
    day: String,

    // Enhanced entry details
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project'
    },
    chargeCode: String,
    shift: String,
    comment: String,

    hoursCompleted: String,
    totalDailyHours: String
  }],
  status: {
    type: String,
    enum: ['Saved', 'Submitted', 'Approved', 'Rejected', 'On-hold', 'Draft', 'saved', 'submitted', 'approved', 'rejected', 'on-hold', 'rejected-edit'],
    default: 'Saved'
  },
  rejectionReason: {
    type: String,
    trim: true
  },
  submittedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
})

const Timesheet = mongoose.model('Timesheet', timesheetSchema)

export default Timesheet

