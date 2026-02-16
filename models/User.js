import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'


const addressSchema = new mongoose.Schema({
  line1: { type: String, default: '' },
  line2: { type: String, default: '' },
  pincode: { type: String, default: '' },
  district: { type: String, default: '' },
  state: { type: String, default: '' },
  country: { type: String, default: '' }
}, { _id: false });

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
  officialEmail: {
    type: String,
    lowercase: true,
    trim: true,
    unique: true,
    sparse: true, // Allows multiple null values, important for migration
    validate: {
      validator: function (value) {
        // For new documents (no _id yet), officialEmail is required
        if (this.isNew) {
          return !!value;
        }
        // For existing documents being updated, it's optional (allows migration)
        return true;
      },
      message: 'Official Email is required for new users'
    }
  },
  email: { type: String, lowercase: true, trim: true }, // Personal email (optional)
  alternativeEmail: { type: String, lowercase: true, trim: true }, // Alternative email (optional)
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
    default: 'employee',
    trim: true
    // No enum - allows dynamic roles from schema config (admin creates roles in form config)
  },
  isActive: {
    type: Boolean,
    default: true
  },

  // Basic Information
  profileImage: String, // URL path to uploaded image (e.g. /uploads/profiles/xxx.jpg), max 1MB
  profileImageOriginalName: String, // Original filename (for display only)
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
  emergencyCountryCode: { type: String, default: '+91' },

  // Addresses (Structured)
  presentAddress: { type: addressSchema, default: () => ({}) },
  permanentAddress: { type: addressSchema, default: () => ({}) },
  aadhaarAddress: { type: addressSchema, default: () => ({}) },

  nickName: String,
  personalEmail: String,
  secondaryContact: String, // Added
  primaryCountryCode: { type: String, default: '+91' },
  secondaryCountryCode: { type: String, default: '+91' },
  extensionNumber: String,
  employeeRefNumber: String,
  birthdayDate: Date,
  marriageDate: Date,
  fathersName: String,
  spouseName: String,
  loginUsername: String,
  ipAddress: String,

  emergencyContactName: String,
  emergencyContactNumber: String,
  isPhysicallyChallenged: { type: Boolean, default: false },
  physicallyChallengedDetails: String,
  isInternationalEmployee: { type: Boolean, default: false },
  countryOfOrigin: String,
  cityLocation: String,
  mobileNumber: String,
  spouseDob: Date,
  numberOfChildren: { type: Number, default: 0 },
  childrenDobs: [Date],

  // Family Details (Dynamic)
  familyDetails: [{
    name: String,
    relation: String,
    dob: Date
  }],

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
  businessUnitHR: {
    type: String,
    enum: ['BU1', 'BU2', 'BU3'],
    default: null
  },

  // Professional Information
  education: [{
    institute: String,
    degree: String,
    percentage: String,
    fromDate: Date,
    toDate: Date,
    fileName: String,
    fileUrl: String
  }],
  languages: [{
    name: String,
    read: { type: Boolean, default: false },
    write: { type: Boolean, default: false },
    speak: { type: Boolean, default: false }
  }],
  experience: [{
    organization: String,
    designation: String,
    fromDate: Date,
    toDate: Date,
    // Flexible attachments: user gives each a name (e.g. "Experience letter", "Payslips")
    attachments: [{
      name: String,      // User-defined label (e.g. "Experience Details", "Payslips Jan-Mar")
      fileName: String,
      fileUrl: String
    }]
  }],
  salary: Number,

  // Bank Details
  accountNumber: String,
  bankName: String,
  ifscCode: String,
  accountType: String,
  branchName: String,
  bankBranch: String,
  salaryPaymentMode: String,
  nameAsPerBankRecords: String,
  iban: String,
  swiftCode: String,

  // Documents
  documents: [{
    documentType: String,
    documentNumber: String,
    fileName: String,
    fileUrl: String // If storing URL or path
  }],

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

