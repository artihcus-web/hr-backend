import express from 'express'
import User from '../models/User.js'
import { authenticate } from '../middleware/auth.js'
import { transformUsers, transformProfileImage } from '../utils/transformUser.js'
 

const router = express.Router()
 
// Get all employees (authenticated access - for employee directory)
router.get('/', authenticate, async (req, res) => {
    try {
        // Fetch all users (everyone) excluding password
        // Sort by employeeId in ascending order
        const allUsers = await User.find()
            .select('-password -__v')
            .sort({ employeeId: 1 }) // Sort by employeeId ascending
        
        // Transform profileImage GridFS IDs to endpoint URLs
        const transformedUsers = transformUsers(allUsers)
 
        res.json({ employees: transformedUsers, users: transformedUsers }) // Support both 'employees' and 'users' for compatibility
    } catch (error) {
        console.error('Get employees error:', error)
        res.status(500).json({ message: 'Server error while fetching employees' })
    }
})
 
// Get employee by ID (full profile for Know Your Employee detail view)
router.get('/:id', async (req, res) => {
    try {
        const employee = await User.findById(req.params.id)
            .select('-password -__v')
            .populate('assignedProjects', 'projectName projectId status')
            .lean()
 
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' })
        }
        
        // Ensure designation is always present in response (from employee form field)
        if (!Object.prototype.hasOwnProperty.call(employee, 'designation')) {
            employee.designation = null
        }
        // Transform profileImage GridFS ID to endpoint URL
        const transformedEmployee = transformProfileImage(employee)
 
        res.json({ employee: transformedEmployee })
    } catch (error) {
        console.error('Get employee error:', error)
        res.status(500).json({ message: 'Server error while fetching employee' })
    }
})
 
// Update Employee Assigned HR (Direct Manager Assignment)
router.put('/:id/assign-hr', async (req, res) => {
    try {
        const { hrId } = req.body
 
        // Updates: Set managerId to the selected HR, and clear legacy businessUnitHR
        const updateData = {
            managerId: hrId,
            businessUnitHR: null
        }
 
        const employee = await User.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        ).select('fullName managerId businessUnitHR')
 
        if (!employee) return res.status(404).json({ message: 'Employee not found' })
 
        res.json({ message: 'HR (Manager) Assigned successfully', employee })
    } catch (error) {
        console.error('Update HR error:', error)
        res.status(500).json({ message: 'Server error while assigning HR' })
    }
})
 
export default router
 