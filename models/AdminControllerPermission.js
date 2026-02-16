import mongoose from 'mongoose'

const adminControllerPermissionSchema = new mongoose.Schema({
  feature: {
    type: String,
    required: true,
    enum: ['employeeDirectory', 'ticketConfiguration', 'schemaConfiguration', 'grievancePortal'],
    unique: true
  },
  roles: [{
    type: String,
    enum: ['admin', 'c-suite', 'hr', 'manager', 'supermanager', 'tl', 'employee', 'client']
  }],
  users: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
})

// Index already created by unique: true on feature; no need for duplicate schema.index()

const AdminControllerPermission = mongoose.model('AdminControllerPermission', adminControllerPermissionSchema)

export default AdminControllerPermission
