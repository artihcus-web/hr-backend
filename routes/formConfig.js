import express from 'express'
import FormConfig from '../models/FormConfig.js'
import { authenticate, requireRole } from '../middleware/auth.js'
import ActivityLog from '../models/ActivityLog.js'

const router = express.Router()

// Get form configuration by type (accessible to all authenticated users)
router.get('/:formType', authenticate, async (req, res) => {
    try {
        const { formType } = req.params

        const config = await FormConfig.findOne({
            formType,
            isActive: true
        }).select('-__v')

        if (!config) {
            return res.status(404).json({
                message: `No active configuration found for ${formType} form`
            })
        }

        res.json({ config })
    } catch (error) {
        console.error('Get form config error:', error)
        res.status(500).json({ message: 'Server error fetching form configuration' })
    }
})

// Get all form configurations (admin only)
router.get('/', authenticate, requireRole('admin', 'super_admin', 'hr'), async (req, res) => {
    try {
        const configs = await FormConfig.find()
            .populate('createdBy', 'fullName email')
            .populate('updatedBy', 'fullName email')
            .sort({ formType: 1 })

        res.json({ configs })
    } catch (error) {
        console.error('Get all configs error:', error)
        res.status(500).json({ message: 'Server error fetching configurations' })
    }
})

// Get list of form types (admin only) - returns metadata for tiles
router.get('/types/list', authenticate, requireRole('admin', 'super_admin', 'hr'), async (req, res) => {
    try {
        const configs = await FormConfig.find({ isActive: true })
            .select('formType formName description')
            .sort({ formType: 1 })

        const types = configs.map(c => ({
            id: c.formType,
            name: c.formName,
            slug: c.formType,
            description: c.description || '',
            icon: c.formType === 'employee' ? 'FiUsers' : c.formType === 'timesheet' ? 'FiFileText' : 'FiGrid',
            color: c.formType === 'employee' ? 'bg-blue-500' : c.formType === 'timesheet' ? 'bg-green-500' : 'bg-indigo-500'
        }))

        res.json({ types })
    } catch (error) {
        console.error('Get form types error:', error)
        res.status(500).json({ message: 'Server error fetching form types' })
    }
})

// Create new form type (admin only)
router.post('/types', authenticate, requireRole('admin', 'super_admin', 'hr'), async (req, res) => {
    try {
        const { name, slug, description } = req.body

        if (!name || !slug) {
            return res.status(400).json({ message: 'Name and slug are required' })
        }

        const formType = slug.toLowerCase().replace(/\s+/g, '-')
        
        // Check if config already exists
        const existing = await FormConfig.findOne({ formType })
        if (existing) {
            return res.status(400).json({ message: 'Form type already exists' })
        }

        // Create empty config for this form type
        const config = new FormConfig({
            formType,
            formName: name,
            description: description || '',
            sections: [],
            createdBy: req.user._id,
            updatedBy: req.user._id
        })

        await config.save()

        res.status(201).json({
            message: 'Form type created successfully',
            type: {
                id: formType,
                name,
                slug: formType,
                description: description || ''
            }
        })
    } catch (error) {
        console.error('Create form type error:', error)
        res.status(500).json({ message: 'Server error creating form type' })
    }
})

// Delete form type (admin only) - only if not default
router.delete('/types/:formType', authenticate, requireRole('admin', 'super_admin', 'hr'), async (req, res) => {
    try {
        const { formType } = req.params

        // Prevent deleting default types
        if (formType === 'employee' || formType === 'timesheet') {
            return res.status(400).json({ message: 'Cannot delete default form types' })
        }

        const config = await FormConfig.findOne({ formType })
        if (!config) {
            return res.status(404).json({ message: 'Form type not found' })
        }

        await FormConfig.deleteOne({ formType })

        res.json({ message: 'Form type deleted successfully' })
    } catch (error) {
        console.error('Delete form type error:', error)
        res.status(500).json({ message: 'Server error deleting form type' })
    }
})

// Create new form configuration (admin or super admin)
router.post('/', authenticate, requireRole('admin', 'super_admin', 'hr'), async (req, res) => {
    try {
        const { formType, formName, description, sections } = req.body

        // Check if config already exists
        const existing = await FormConfig.findOne({ formType })
        if (existing) {
            return res.status(400).json({
                message: `Configuration for ${formType} already exists. Use update instead.`
            })
        }

        const config = new FormConfig({
            formType,
            formName,
            description,
            sections: sections || [],
            createdBy: req.user._id,
            updatedBy: req.user._id
        })

        await config.save()

        // Log activity
        await ActivityLog.create({
            user: req.user._id,
            action: 'FORM_CONFIG_CREATED',
            description: `Created form configuration for ${formType}`,
            target: config._id.toString()
        })

        res.status(201).json({
            message: 'Form configuration created successfully',
            config
        })
    } catch (error) {
        console.error('Create config error:', error)
        res.status(500).json({ message: 'Server error creating configuration' })
    }
})

// Update entire form configuration by ID (admin or super admin)
router.put('/id/:id', authenticate, requireRole('admin', 'super_admin', 'hr'), async (req, res) => {
    try {
        const { id } = req.params
        const { formName, description, sections, isActive } = req.body

        const config = await FormConfig.findById(id)
        if (!config) {
            return res.status(404).json({ message: 'Configuration not found' })
        }

        // Update fields
        if (formName !== undefined) config.formName = formName
        if (description !== undefined) config.description = description
        if (sections !== undefined) config.sections = sections
        if (isActive !== undefined) config.isActive = isActive

        config.updatedBy = req.user._id
        config.version += 1

        await config.save()

        // Log activity
        await ActivityLog.create({
            user: req.user._id,
            action: 'FORM_CONFIG_UPDATED',
            description: `Updated form configuration for ${config.formType}`,
            target: config._id.toString()
        })

        res.json({
            message: 'Form configuration updated successfully',
            config
        })
    } catch (error) {
        console.error('Update config error:', error)
        res.status(500).json({ message: 'Server error updating configuration' })
    }
})

// Add section to form (admin or super admin)
router.post('/:id/section', authenticate, requireRole('admin', 'super_admin', 'hr'), async (req, res) => {
    try {
        const { id } = req.params
        const sectionData = req.body

        const config = await FormConfig.findById(id)
        if (!config) {
            return res.status(404).json({ message: 'Configuration not found' })
        }

        // Check for duplicate section ID
        if (config.sections.some(s => s.id === sectionData.id)) {
            return res.status(400).json({ message: 'Section ID already exists' })
        }

        config.sections.push(sectionData)
        config.updatedBy = req.user._id
        config.version += 1
        await config.save()

        res.json({
            message: 'Section added successfully',
            config
        })
    } catch (error) {
        console.error('Add section error:', error)
        res.status(500).json({ message: 'Server error adding section' })
    }
})

// Update section (admin or super admin)
router.put('/:id/section/:sectionId', authenticate, requireRole('admin', 'super_admin', 'hr'), async (req, res) => {
    try {
        const { id, sectionId } = req.params
        const updates = req.body

        const config = await FormConfig.findById(id)
        if (!config) {
            return res.status(404).json({ message: 'Configuration not found' })
        }

        const section = config.sections.find(s => s.id === sectionId)
        if (!section) {
            return res.status(404).json({ message: 'Section not found' })
        }

        Object.assign(section, updates)
        config.updatedBy = req.user._id
        config.version += 1
        await config.save()

        res.json({
            message: 'Section updated successfully',
            config
        })
    } catch (error) {
        console.error('Update section error:', error)
        res.status(500).json({ message: 'Server error updating section' })
    }
})

// Delete section (admin or super admin)
router.delete('/:id/section/:sectionId', authenticate, requireRole('admin', 'super_admin', 'hr'), async (req, res) => {
    try {
        const { id, sectionId } = req.params

        const config = await FormConfig.findById(id)
        if (!config) {
            return res.status(404).json({ message: 'Configuration not found' })
        }

        config.sections = config.sections.filter(s => s.id !== sectionId)
        config.updatedBy = req.user._id
        config.version += 1
        await config.save()

        res.json({
            message: 'Section deleted successfully',
            config
        })
    } catch (error) {
        console.error('Delete section error:', error)
        res.status(500).json({ message: 'Server error deleting section' })
    }
})

// Add field to section (admin or super admin)
router.post('/:id/section/:sectionId/field', authenticate, requireRole('admin', 'super_admin', 'hr'), async (req, res) => {
    try {
        const { id, sectionId } = req.params
        const fieldData = req.body

        const config = await FormConfig.findById(id)
        if (!config) {
            return res.status(404).json({ message: 'Configuration not found' })
        }

        const section = config.sections.find(s => s.id === sectionId)
        if (!section) {
            return res.status(404).json({ message: 'Section not found' })
        }

        // Check for duplicate field name
        if (section.fields.some(f => f.name === fieldData.name)) {
            return res.status(400).json({ message: 'Field name already exists in this section' })
        }

        section.fields.push(fieldData)
        config.updatedBy = req.user._id
        config.version += 1
        await config.save()

        res.json({
            message: 'Field added successfully',
            config
        })
    } catch (error) {
        console.error('Add field error:', error)
        res.status(500).json({ message: 'Server error adding field' })
    }
})

// Update field (admin or super admin)
router.put('/:id/section/:sectionId/field/:fieldName', authenticate, requireRole('admin', 'super_admin', 'hr'), async (req, res) => {
    try {
        const { id, sectionId, fieldName } = req.params
        const updates = req.body

        const config = await FormConfig.findById(id)
        if (!config) {
            return res.status(404).json({ message: 'Configuration not found' })
        }

        const section = config.sections.find(s => s.id === sectionId)
        if (!section) {
            return res.status(404).json({ message: 'Section not found' })
        }

        const field = section.fields.find(f => f.name === fieldName)
        if (!field) {
            return res.status(404).json({ message: 'Field not found' })
        }

        Object.assign(field, updates)
        config.updatedBy = req.user._id
        config.version += 1
        await config.save()

        res.json({
            message: 'Field updated successfully',
            config
        })
    } catch (error) {
        console.error('Update field error:', error)
        res.status(500).json({ message: 'Server error updating field' })
    }
})

// Delete field (admin or super admin)
router.delete('/:id/section/:sectionId/field/:fieldName', authenticate, requireRole('admin', 'super_admin', 'hr'), async (req, res) => {
    try {
        const { id, sectionId, fieldName } = req.params

        const config = await FormConfig.findById(id)
        if (!config) {
            return res.status(404).json({ message: 'Configuration not found' })
        }

        const section = config.sections.find(s => s.id === sectionId)
        if (!section) {
            return res.status(404).json({ message: 'Section not found' })
        }

        section.fields = section.fields.filter(f => f.name !== fieldName)
        config.updatedBy = req.user._id
        config.version += 1
        await config.save()

        res.json({
            message: 'Field deleted successfully',
            config
        })
    } catch (error) {
        console.error('Delete field error:', error)
        res.status(500).json({ message: 'Server error deleting field' })
    }
})

// Reorder sections (admin or super admin)
router.put('/:id/sections/reorder', authenticate, requireRole('admin', 'super_admin', 'hr'), async (req, res) => {
    try {
        const { id } = req.params
        const { sectionOrder } = req.body // Array of section IDs in new order

        const config = await FormConfig.findById(id)
        if (!config) {
            return res.status(404).json({ message: 'Configuration not found' })
        }

        // Reorder sections based on provided order
        const reorderedSections = sectionOrder.map((sectionId, index) => {
            const section = config.sections.find(s => s.id === sectionId)
            if (section) {
                section.order = index
                return section
            }
        }).filter(Boolean)

        config.sections = reorderedSections
        config.updatedBy = req.user._id
        config.version += 1
        await config.save()

        res.json({
            message: 'Sections reordered successfully',
            config
        })
    } catch (error) {
        console.error('Reorder sections error:', error)
        res.status(500).json({ message: 'Server error reordering sections' })
    }
})

// Update form configuration by formType (admin or super admin) - must come AFTER /:id routes
router.put('/type/:formType', authenticate, requireRole('admin', 'super_admin', 'hr'), async (req, res) => {
    try {
        const { formType } = req.params
        const { formName, description, sections, isActive } = req.body

        const config = await FormConfig.findOne({ formType })
        if (!config) {
            // Create if doesn't exist
            const newConfig = new FormConfig({
                formType,
                formName: formName || formType,
                description: description || '',
                sections: sections || [],
                createdBy: req.user._id,
                updatedBy: req.user._id
            })
            await newConfig.save()
            return res.json({
                message: 'Form configuration created successfully',
                config: newConfig
            })
        }

        // Update fields - use findOneAndUpdate to handle version conflicts atomically
        const updateData = {
            updatedBy: req.user._id,
            $inc: { version: 1 }
        }
        
        if (formName !== undefined) updateData.formName = formName
        if (description !== undefined) updateData.description = description
        if (sections !== undefined) updateData.sections = sections
        if (isActive !== undefined) updateData.isActive = isActive

        const latestConfig = await FormConfig.findByIdAndUpdate(
            config._id,
            updateData,
            { new: true, runValidators: true }
        )

        if (!latestConfig) {
            return res.status(404).json({ error: 'Form configuration not found' })
        }

        // Log activity
        await ActivityLog.create({
            user: req.user._id,
            action: 'FORM_CONFIG_UPDATED',
            description: `Updated form configuration for ${latestConfig.formType}`,
            target: latestConfig._id.toString()
        })

        res.json({
            message: 'Form configuration updated successfully',
            config: latestConfig
        })
    } catch (error) {
        console.error('Update config error:', error)
        res.status(500).json({ message: 'Server error updating configuration' })
    }
})

export default router
