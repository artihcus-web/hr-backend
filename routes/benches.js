import express from 'express'
import Bench from '../models/Bench.js'
import Project from '../models/Project.js'
import User from '../models/User.js'
import { authenticate } from '../middleware/auth.js'

const router = express.Router()

// Get all benches
router.get('/', authenticate, async (req, res) => {
  try {
    // Only admin can view all benches
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' })
    }

    const benches = await Bench.find()
      .populate('hrManager', 'fullName email employeeId username')
      .populate('employees', 'fullName email employeeId username')
      .sort({ createdAt: -1 })

    res.json({ benches })
  } catch (error) {
    console.error('Get benches error:', error)
    res.status(500).json({ message: 'Server error while fetching benches' })
  }
})

// Get single bench
router.get('/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' })
    }

    const bench = await Bench.findById(req.params.id)
      .populate('hrManager', 'fullName email employeeId username')
      .populate('employees', 'fullName email employeeId username')

    if (!bench) {
      return res.status(404).json({ message: 'Bench not found' })
    }

    res.json({ bench })
  } catch (error) {
    console.error('Get bench error:', error)
    res.status(500).json({ message: 'Server error while fetching bench' })
  }
})

// Create bench (Add HR Manager)
router.post('/', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' })
    }

    const { name, description, hrManagerId } = req.body

    if (!name || !hrManagerId) {
      return res.status(400).json({ message: 'Name and HR Manager are required' })
    }

    // Verify HR Manager exists and has HR role
    const hrManager = await User.findById(hrManagerId)
    if (!hrManager) {
      return res.status(404).json({ message: 'HR Manager not found' })
    }
    if (hrManager.role !== 'hr') {
      return res.status(400).json({ message: 'Selected user must have HR role' })
    }

    // Check if HR Manager is already assigned to another bench
    const existingBench = await Bench.findOne({ hrManager: hrManagerId, status: 'active' })
    if (existingBench) {
      return res.status(400).json({ message: 'This HR Manager is already assigned to another bench' })
    }

    const bench = new Bench({
      name,
      description: description || '',
      hrManager: hrManagerId,
      employees: [],
      createdBy: req.user._id
    })

    await bench.save()
    const populatedBench = await Bench.findById(bench._id)
      .populate('hrManager', 'fullName email employeeId username')
      .populate('employees', 'fullName email employeeId username')

    res.status(201).json({ 
      message: 'Bench created successfully',
      bench: populatedBench
    })
  } catch (error) {
    console.error('Create bench error:', error)
    res.status(500).json({ message: 'Server error while creating bench' })
  }
})

// Update bench
router.put('/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' })
    }

    const { name, description, status } = req.body
    const bench = await Bench.findById(req.params.id)

    if (!bench) {
      return res.status(404).json({ message: 'Bench not found' })
    }

    if (name) bench.name = name
    if (description !== undefined) bench.description = description
    if (status) bench.status = status

    await bench.save()
    const populatedBench = await Bench.findById(bench._id)
      .populate('hrManager', 'fullName email employeeId username')
      .populate('employees', 'fullName email employeeId username')

    res.json({ 
      message: 'Bench updated successfully',
      bench: populatedBench
    })
  } catch (error) {
    console.error('Update bench error:', error)
    res.status(500).json({ message: 'Server error while updating bench' })
  }
})

// Assign employees to bench
router.post('/:id/assign-employees', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' })
    }

    const { employeeIds } = req.body
    if (!Array.isArray(employeeIds)) {
      return res.status(400).json({ message: 'employeeIds must be an array' })
    }

    const bench = await Bench.findById(req.params.id)
    if (!bench) {
      return res.status(404).json({ message: 'Bench not found' })
    }

    // Verify all employees exist
    const employees = await User.find({ _id: { $in: employeeIds } })
    if (employees.length !== employeeIds.length) {
      return res.status(400).json({ message: 'One or more employees not found' })
    }

    // Check if any employees are already assigned to projects
    const projects = await Project.find({ 
      status: 'active',
      employees: { $in: employeeIds }
    }).select('projectName employees')
    
    const employeesInProjects = []
    projects.forEach(project => {
      project.employees.forEach(empId => {
        if (employeeIds.some(id => id.toString() === empId.toString()) && 
            !employeesInProjects.find(e => e.id === empId.toString())) {
          const employee = employees.find(e => e._id.toString() === empId.toString())
          employeesInProjects.push({
            id: empId.toString(),
            name: employee?.fullName || employee?.username || 'Unknown',
            projectName: project.projectName
          })
        }
      })
    })

    if (employeesInProjects.length > 0) {
      const employeeNames = employeesInProjects.map(e => `${e.name} (${e.projectName})`).join(', ')
      return res.status(400).json({ 
        message: `Cannot assign employees who are already assigned to projects: ${employeeNames}` 
      })
    }

    // Add employees (avoid duplicates)
    const newEmployeeIds = employeeIds.filter(id => !bench.employees.includes(id))
    bench.employees.push(...newEmployeeIds)

    await bench.save()
    const populatedBench = await Bench.findById(bench._id)
      .populate('hrManager', 'fullName email employeeId username')
      .populate('employees', 'fullName email employeeId username')

    res.json({ 
      message: 'Employees assigned successfully',
      bench: populatedBench
    })
  } catch (error) {
    console.error('Assign employees error:', error)
    res.status(500).json({ message: 'Server error while assigning employees' })
  }
})

// Remove employee from bench
router.delete('/:id/employees/:employeeId', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' })
    }

    const bench = await Bench.findById(req.params.id)
    if (!bench) {
      return res.status(404).json({ message: 'Bench not found' })
    }

    bench.employees = bench.employees.filter(
      empId => empId.toString() !== req.params.employeeId
    )

    await bench.save()
    const populatedBench = await Bench.findById(bench._id)
      .populate('hrManager', 'fullName email employeeId username')
      .populate('employees', 'fullName email employeeId username')

    res.json({ 
      message: 'Employee removed successfully',
      bench: populatedBench
    })
  } catch (error) {
    console.error('Remove employee error:', error)
    res.status(500).json({ message: 'Server error while removing employee' })
  }
})

// Delete bench
router.delete('/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' })
    }

    const bench = await Bench.findById(req.params.id)
    if (!bench) {
      return res.status(404).json({ message: 'Bench not found' })
    }

    await Bench.findByIdAndDelete(req.params.id)
    res.json({ message: 'Bench deleted successfully' })
  } catch (error) {
    console.error('Delete bench error:', error)
    res.status(500).json({ message: 'Server error while deleting bench' })
  }
})

// Get available HR managers (not assigned to any active bench)
router.get('/available/hr-managers', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' })
    }

    // Get all HR managers
    const allHRManagers = await User.find({ role: 'hr' })
      .select('fullName email employeeId username')

    // Get HR managers already assigned to active benches
    const assignedBenches = await Bench.find({ status: 'active' })
      .select('hrManager')
    const assignedHRIds = assignedBenches.map(b => b.hrManager.toString())

    // Filter out assigned HR managers
    const availableHRManagers = allHRManagers.filter(
      hr => !assignedHRIds.includes(hr._id.toString())
    )

    res.json({ hrManagers: availableHRManagers })
  } catch (error) {
    console.error('Get available HR managers error:', error)
    res.status(500).json({ message: 'Server error while fetching HR managers' })
  }
})

// Get available employees (not assigned to any bench or project)
router.get('/available/employees', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' })
    }

    // Get all employees
    const allEmployees = await User.find({ role: 'employee' })
      .select('fullName email employeeId username')

    // Get employees already assigned to benches
    const assignedBenches = await Bench.find({ status: 'active' })
      .select('employees')
    const assignedToBenchIds = new Set()
    assignedBenches.forEach(bench => {
      bench.employees.forEach(empId => {
        assignedToBenchIds.add(empId.toString())
      })
    })

    // Get employees already assigned to projects
    const assignedProjects = await Project.find({ status: 'active' })
      .select('employees')
    const assignedToProjectIds = new Set()
    assignedProjects.forEach(project => {
      project.employees.forEach(empId => {
        assignedToProjectIds.add(empId.toString())
      })
    })

    // Filter out employees assigned to benches OR projects
    const availableEmployees = allEmployees.filter(
      emp => {
        const empId = emp._id.toString()
        return !assignedToBenchIds.has(empId) && !assignedToProjectIds.has(empId)
      }
    )

    res.json({ employees: availableEmployees })
  } catch (error) {
    console.error('Get available employees error:', error)
    res.status(500).json({ message: 'Server error while fetching employees' })
  }
})

export default router

