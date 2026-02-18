/**
 * One-time patch: add the "Attachments" field to Experience Details section
 * in the employee form config if it's missing. Safe to run multiple times.
 * Does not replace other sections or fields.
 */
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import FormConfig from '../models/FormConfig.js'

dotenv.config()

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/myapp'

const EXPERIENCE_ATTACHMENTS_FIELD = {
  name: 'attachments',
  label: 'Attachments',
  type: 'file',
  required: false,
  order: 4,
  width: 'full',
  helpText: 'PDF only. You can add multiple attachments (e.g. experience letter, payslips).',
  isActive: true
}

async function patch() {
  try {
    await mongoose.connect(MONGODB_URI)
    const config = await FormConfig.findOne({ formType: 'employee' })
    if (!config) {
      console.log('No employee form config found. Run migrateEmployeeForm.js first.')
      await mongoose.connection.close()
      process.exit(0)
      return
    }

    const section = config.sections?.find(s => s.id === 'experience-details')
    if (!section || !section.fields) {
      console.log('Experience Details section not found.')
      await mongoose.connection.close()
      process.exit(1)
    }

    const hasAttachments = section.fields.some(f => f.name === 'attachments')
    if (hasAttachments) {
      console.log('Experience Details already has "Attachments" field. Nothing to do.')
      await mongoose.connection.close()
      process.exit(0)
      return
    }

    section.fields.push(EXPERIENCE_ATTACHMENTS_FIELD)
    section.fields.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    config.version = (config.version || 1) + 1
    await config.save()

    console.log('Added "Attachments" field to Experience Details in schema.')
    console.log('Refresh Schema Configuration page to see it (Fields (5)).')
    await mongoose.connection.close()
  } catch (err) {
    console.error(err)
    await mongoose.connection.close()
    process.exit(1)
  }
}

patch()
