import mongoose from 'mongoose'

const fieldSchema = new mongoose.Schema({
    name: { type: String, required: true }, // Database field name (e.g., 'firstName')
    label: { type: String, required: true }, // Display label (e.g., 'First Name')
    type: {
        type: String,
        required: true,
        enum: ['text', 'email', 'number', 'date', 'select', 'checkbox', 'radio', 'textarea', 'file', 'tel']
    },
    required: { type: Boolean, default: false },
    placeholder: String,
    helpText: String,
    defaultValue: mongoose.Schema.Types.Mixed,
    options: [String], // For select, radio types
    validation: {
        minLength: Number,
        maxLength: Number,
        min: Number, // For number type
        max: Number,
        pattern: String, // Regex pattern
        customMessage: String
    },
    order: { type: Number, default: 0 },
    width: { type: String, default: 'full', enum: ['full', 'half', 'third', 'quarter'] }, // Grid width
    isActive: { type: Boolean, default: true }
}, { _id: true })

const sectionSchema = new mongoose.Schema({
    id: { type: String, required: true }, // Unique section ID (e.g., 'basic-info')
    title: { type: String, required: true }, // Display title (e.g., 'Basic Information')
    description: String,
    icon: String, // Icon name for UI
    order: { type: Number, default: 0 },
    fields: [fieldSchema],
    isActive: { type: Boolean, default: true },
    isCollapsible: { type: Boolean, default: true }
}, { _id: true })

const formConfigSchema = new mongoose.Schema({
    formType: {
        type: String,
        required: true,
        enum: ['employee', 'project', 'timesheet', 'grievance'],
        unique: true
    },
    formName: { type: String, required: true }, // Display name
    description: String,
    sections: [sectionSchema],
    version: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
    timestamps: true
})

// Indexes
formConfigSchema.index({ formType: 1, isActive: 1 })

// Methods
formConfigSchema.methods.incrementVersion = function () {
    this.version += 1
    return this.save()
}

formConfigSchema.methods.addSection = function (sectionData) {
    this.sections.push(sectionData)
    return this.save()
}

formConfigSchema.methods.removeSection = function (sectionId) {
    this.sections = this.sections.filter(s => s.id !== sectionId)
    return this.save()
}

formConfigSchema.methods.updateSection = function (sectionId, updates) {
    const section = this.sections.find(s => s.id === sectionId)
    if (section) {
        Object.assign(section, updates)
        return this.save()
    }
    throw new Error('Section not found')
}

formConfigSchema.methods.addField = function (sectionId, fieldData) {
    const section = this.sections.find(s => s.id === sectionId)
    if (section) {
        section.fields.push(fieldData)
        return this.save()
    }
    throw new Error('Section not found')
}

formConfigSchema.methods.removeField = function (sectionId, fieldName) {
    const section = this.sections.find(s => s.id === sectionId)
    if (section) {
        section.fields = section.fields.filter(f => f.name !== fieldName)
        return this.save()
    }
    throw new Error('Section not found')
}

formConfigSchema.methods.updateField = function (sectionId, fieldName, updates) {
    const section = this.sections.find(s => s.id === sectionId)
    if (section) {
        const field = section.fields.find(f => f.name === fieldName)
        if (field) {
            Object.assign(field, updates)
            return this.save()
        }
        throw new Error('Field not found')
    }
    throw new Error('Section not found')
}

const FormConfig = mongoose.model('FormConfig', formConfigSchema)

export default FormConfig
