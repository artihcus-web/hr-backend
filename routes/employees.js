import express from 'express'
import User from '../models/User.js'


const router = express.Router()

// Get all employees (public access)
router.get('/', async (req, res) => {
    try {
        // Filter by role to get only employees/team members if needed, 
        // or just return all non-admin users. 
        // For "All Employees", we typically want everyone except maybe the super admins.
        // Or specifically roles: 'employee', 'tl', 'manager'

        // Based on the user request "fetching employees", we'll fetch all users 
        // but exclude sensitive fields like password.

        const employees = await User.find({
            role: { $in: ['employee', 'tl', 'manager', 'hr'] } // Adjust roles as per business logic
        })
            .select('-password -__v')
            .sort({ createdAt: -1 })

        res.json({ employees })
    } catch (error) {
        console.error('Get employees error:', error)
        res.status(500).json({ message: 'Server error while fetching employees' })
    }
})

// Get employee by ID
router.get('/:id', async (req, res) => {
    try {
        const employee = await User.findById(req.params.id)
            .select('-password -__v')
            .populate('assignedProjects', 'projectName projectId status')

        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' })
        }

        res.json({ employee })
    } catch (error) {
        console.error('Get employee error:', error)
        res.status(500).json({ message: 'Server error while fetching employee' })
    }
})

export default router
