import mongoose from 'mongoose'

const siteSettingsSchema = new mongoose.Schema({
  // Branding
  sidebarLogoUrl: { type: String, default: '' },
  appName: { type: String, default: 'Artihcus' },
  faviconUrl: { type: String, default: '' },
  // Holiday Calendar page
  holidayCalendarTitle: { type: String, default: 'Holiday Calendar' },
  holidayCalendarSubtitle: { type: String, default: 'Organization holidays' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true })

// Single document for app-wide settings (id: 'default')
siteSettingsSchema.index({ _id: 1 }, { unique: true })

const SiteSettings = mongoose.model('SiteSettings', siteSettingsSchema)
export default SiteSettings
