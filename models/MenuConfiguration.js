import mongoose from 'mongoose'

const menuConfigurationSchema = new mongoose.Schema({
  menuItemId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  label: {
    type: String,
    required: true
  },
  path: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    default: ''
  },
  // Visibility per role (default: true if not specified)
  isVisible: {
    type: Map,
    of: Boolean,
    default: new Map()
  },
  // Order per role (lower number = higher in menu)
  menuOrder: {
    type: Map,
    of: Number,
    default: new Map()
  },
  // Roles that have access (array of role strings)
  roles: [{
    type: String,
    enum: ['admin', 'c-suite', 'hr', 'manager', 'supermanager', 'tl', 'employee', 'client']
  }],
  // Individual user overrides (user IDs)
  users: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // Parent menu item ID (for nested menus)
  parentId: {
    type: String,
    default: null
  },
  // Whether this is a child menu item
  hasChildren: {
    type: Boolean,
    default: false
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
})

// Index for faster queries by role
menuConfigurationSchema.index({ roles: 1 })

const MenuConfiguration = mongoose.model('MenuConfiguration', menuConfigurationSchema)

export default MenuConfiguration
