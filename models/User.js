import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const userSchema = new mongoose.Schema({
  // Authentication fields (required)
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  fullName: {
    type: String,
    trim: true
  },
  role: {
    type: String,
    enum: ['admin', 'c-suite', 'hr', 'manager', 'supermanager', 'tl', 'employee', 'client'],
    default: 'employee'
  },
  isActive: {
    type: Boolean,
    default: true
  },

  // Basic Information
  profileImage: String, // Base64 encoded image string (max 300KB recommended)
  firstName: String,
  middleName: String,
  lastName: String,
  phone: String,
  employeeId: String,
  dateOfBirth: Date,
  gender: String,
  maritalStatus: String,
  bloodGroup: String,
  emergencyContact: String,
  presentAddress: String,
  nickName: String,
  personalEmail: String,
  officeEmail: String, // Added
  secondaryContact: String, // Added
  extensionNumber: String,
  employeeRefNumber: String,
  birthdayDate: Date,
  marriageDate: Date,
  fathersName: String,
  spouseName: String,
  loginUsername: String,
  ipAddress: String,
  permanentAddress: String,
  emergencyContactName: String,
  emergencyContactNumber: String,
  isPhysicallyChallenged: { type: Boolean, default: false },
  isInternationalEmployee: { type: Boolean, default: false },
  countryOfOrigin: String,
  cityLocation: String,
  mobileNumber: String,
  spouseDob: Date,
  numberOfChildren: { type: Number, default: 0 },
  childrenDobs: [Date],

  // Employment Information
  department: String,
  designation: String,
  assignedProjects: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  }],

  employeeStatus: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  joiningDate: Date,
  exitDate: Date,
  cid: String,
  managerId: String,
  superManagerId: String,
  confirmDate: Date,
  probationPeriod: Number,
  noticePeriod: Number,
  division: String,
  costCenter: String,
  grade: String,
  location: String,
  employeeNumberSeries: String,

  // Professional Information
  education: [{
    institute: String,
    fromDate: Date,
    toDate: Date
  }],
  experience: [{
    organization: String,
    fromDate: Date,
    toDate: Date
  }],
  skills: [String],
  salary: Number,

  // Bank Details
  accountNumber: String,
  bankName: String,
  ifscCode: String,
  accountType: String,
  branchName: String,
  bankBranch: String,
  salaryPaymentMode: String,
  ddPayableAt: String,
  nameAsPerBankRecords: String,
  iban: String,

  // Documents
  aadharNumber: String,
  panNumber: String,
  passportNumber: String,
  drivingLicense: String,
  aadhaarCardEnrolmentNo: String,
  nameAsOnAadhaarCard: String,
  universalAccountNumber: String,

  // Background Verification
  verificationStatus: String,
  verificationIndication: String,
  completedOn: Date,
  agencyName: String,
  remarks: String,

  // PF Details
  isEligibleForPF: { type: Boolean, default: false },
  pfNumber: String,
  pfScheme: String,
  pfJoiningDate: Date,
  eligibleForExcessEPFContribution: { type: Boolean, default: false },
  isEligibleForExcessEPSContribution: { type: Boolean, default: false },
  isExistingMemberOfPF: { type: Boolean, default: false },

  // ESI Details
  isEligibleForESI: { type: Boolean, default: false },
  esiNumber: String,
  isCoveredUnderLWF: { type: Boolean, default: false },

  // Password Reset
  resetPasswordToken: String,
  resetPasswordExpires: Date
}, {
  timestamps: true
})

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()

  try {
    const salt = await bcrypt.genSalt(10)
    this.password = await bcrypt.hash(this.password, salt)
    next()
  } catch (error) {
    next(error)
  }
})

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password)
}

const User = mongoose.model('User', userSchema)

export default User

