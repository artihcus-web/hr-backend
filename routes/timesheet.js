import express from 'express'
import Timesheet from '../models/Timesheet.js'
import User from '../models/User.js'
import Project from '../models/Project.js'
import Bench from '../models/Bench.js'
import { authenticate } from '../middleware/auth.js'
import { sendTimesheetNotificationEmail } from '../services/emailService.js'

const router = express.Router()

// Save timesheet as draft
// Save timesheet as draft
router.post('/save', authenticate, async (req, res) => {
  try {
    const { weekStartDate, entries, status, month, name, manager } = req.body
    const employeeId = req.user._id

    console.log(`📋 [TIMESHEET] Saving draft for ${req.user.email} - Week: ${weekStartDate}`)

    if (!entries || !Array.isArray(entries)) {
      return res.status(400).json({ message: 'Invalid entries provided' })
    }

    // consolidated logic similar to submit but just save to DB
    const projectIds = [...new Set(entries.map(e => e.projectId).filter(Boolean))]

    // Determine main project/charge code for the top-level document
    let mainProjectId = null
    let mainProjectName = 'Multiple Projects'
    let mainChargeCode = 'Consolidated'

    if (projectIds.length === 1) {
      mainProjectId = projectIds[0]
      // Try to find project name from first entry if available or query DB (skipping DB query for draft speed if possible, or keep it simple)
      mainChargeCode = entries[0].chargeCode
      mainProjectName = entries[0].chargeCode // Fallback
    }

    const timesheetData = {
      employeeId,
      employeeName: name || req.user.fullName || req.user.username,
      manager: manager, // Direct report manager
      month: month,
      weekStartDate: new Date(weekStartDate),
      status: status || 'Saved',
      entries: entries,
      projectIds: projectIds,
      projectId: mainProjectId,
      projectName: mainProjectName,
      chargeCode: mainChargeCode,
      submittedAt: new Date()
    }

    // Upsert the SINGLE consolidated document for this week
    const savedTimesheet = await Timesheet.findOneAndUpdate(
      {
        employeeId,
        weekStartDate: new Date(weekStartDate)
      },
      timesheetData,
      { new: true, upsert: true }
    )

    console.log(`✅ [TIMESHEET] Draft saved. ID: ${savedTimesheet._id}`)
    res.status(200).json({ message: 'Timesheet saved successfully', timesheet: savedTimesheet })

  } catch (error) {
    console.error('❌ [TIMESHEET] Save draft error:', error)
    res.status(500).json({ message: 'Server error while saving draft' })
  }
})

// Submit timesheet
router.post('/submit', authenticate, async (req, res) => {
  console.log('📋 [TIMESHEET] ==========================================')
  console.log('📋 [TIMESHEET] New timesheet submission received')
  console.log('📋 [TIMESHEET] User ID:', req.user._id)
  console.log('📋 [TIMESHEET] User Name:', req.user.fullName || req.user.username)
  console.log('📋 [TIMESHEET] Request body:', {
    month: req.body.month,
    empId: req.body.empId,
    name: req.body.name,
    manager: req.body.manager,
    entriesCount: req.body.entries?.length || 0
  })

  // Check environment variables
  console.log('📋 [TIMESHEET] Environment check:')
  console.log('📋 [TIMESHEET]   EMAIL_USER:', process.env.EMAIL_USER ? `${process.env.EMAIL_USER.substring(0, 5)}***` : 'NOT SET')
  console.log('📋 [TIMESHEET]   EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? '***SET***' : 'NOT SET')

  try {
    const { month, entries, empId, name } = req.body
    const employeeId = req.user._id

    if (!month || !entries || !Array.isArray(entries) || entries.length === 0) {
      console.error('❌ [TIMESHEET] Validation failed: Missing month or entries')
      return res.status(400).json({ message: 'Month and at least one timesheet entry are required' })
    }

    // Check for duplicate dates in entries FOR THE SAME PROJECT/CHARGECODE
    const entriesUniqueKeys = entries.map(entry => {
      // Use chargeCode or projectId + date as unique key
      // entry.chargeCode is usually available from frontend
      const key = entry.date + (entry.chargeCode || entry.projectId || 'unknown')
      return key
    })
    const uniqueKeysSet = new Set(entriesUniqueKeys)

    if (entriesUniqueKeys.length !== uniqueKeysSet.size) {
      console.error('❌ [TIMESHEET] Validation failed: Duplicate entries for same project/date found in current submission')
      return res.status(400).json({ message: 'Duplicate entries for the same project on the same day are not allowed.' })
    }

    // Check for duplicate dates in previously submitted timesheets FOR THE SAME PROJECT
    // Excluding "rejected-edit" timesheets so they can be resubmitted
    const existingTimesheets = await Timesheet.find({
      employeeId,
      status: { $nin: ['rejected-edit', 'Rejected-Edit'] }
    })
    const existingEntryKeys = new Set()

    existingTimesheets.forEach(timesheet => {
      if (timesheet.entries && Array.isArray(timesheet.entries) && timesheet.projectId) {
        timesheet.entries.forEach(entry => {
          if (entry.date) {
            // Normalize date format
            const dateStr = entry.date.toString().split('T')[0]
            existingEntryKeys.add(`${dateStr}|${timesheet.projectId.toString()}`)
          }
        })
      }
    })

    // Check if any dates in current submission already exist for the SAME project
    const duplicateDates = entries.filter(entry => {
      if (!entry.date) return false
      const dateStr = entry.date.toString().split('T')[0]
      const pid = entry.projectId || req.body.projectId // Fallback if needed

      // If we have a project ID, check specific overlap
      if (pid) {
        return existingEntryKeys.has(`${dateStr}|${pid.toString()}`)
      }

      // If no project ID available in entry, we can't reliably check overlap against specific projects
      // But standard frontend sends it.
      return false
    })

    if (duplicateDates.length > 0) {
      console.error('❌ [TIMESHEET] Validation failed: Duplicate entries for same project')
      const dateList = duplicateDates.map(d => {
        const dateObj = new Date(d.date)
        return dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      }).join(', ')
      return res.status(400).json({
        message: `It looks like you've already submitted time for ${dateList} for this project. Please update the existing submission or remove these dates.`
      })
    }

    console.log('✅ [TIMESHEET] Validation passed - no duplicate dates found')

    // Find projects where this employee is assigned
    const projects = await Project.find({
      $or: [
        { employees: employeeId },
        { projectManagers: employeeId }
      ]
    }).populate('projectManagers', 'email fullName username')

    // if (projects.length === 0) {
    //   return res.status(400).json({ message: 'You are not assigned to any projects' })
    // }

    // Get unique project managers from all assigned projects
    console.log('📋 [TIMESHEET] Finding project managers...')
    console.log('📋 [TIMESHEET] Found', projects.length, 'projects for employee')

    const projectManagers = []
    projects.forEach(project => {
      console.log('📋 [TIMESHEET] Processing project:', project.projectName)
      console.log('📋 [TIMESHEET] Project managers count:', project.projectManagers?.length || 0)

      if (project.projectManagers && project.projectManagers.length > 0) {
        project.projectManagers.forEach(mgr => {
          console.log('📋 [TIMESHEET] Checking manager:', mgr.fullName || mgr.username, 'Email:', mgr.email)
          if (mgr.email && !projectManagers.find(pm => pm.email === mgr.email)) {
            projectManagers.push({
              email: mgr.email,
              name: mgr.fullName || mgr.username,
              projectId: project._id,
              projectName: project.projectName
            })
            console.log('✅ [TIMESHEET] Added manager:', mgr.email)
          }
        })
      }
    })

    console.log('📋 [TIMESHEET] Total unique project managers found:', projectManagers.length)

    // Find HR managers assigned to this employee via "Ready-to-deploy resources" project
    console.log('📋 [TIMESHEET] Finding HR managers from Ready-to-deploy resources...')

    const readyProject = await Project.findOne({ projectName: 'Ready-to-deploy resources' })
      .populate('managerAssignments.manager', 'email fullName username')

    const hrManagers = []

    if (readyProject && readyProject.employees.includes(employeeId)) {
      console.log('📋 [TIMESHEET] Employee is in Ready-to-deploy resources')
      // Check for specific manager assignment
      const assignment = readyProject.managerAssignments.find(
        a => a.employee.toString() === employeeId.toString()
      )

      if (assignment && assignment.manager && assignment.manager.email) {
        hrManagers.push({
          email: assignment.manager.email,
          name: assignment.manager.fullName || assignment.manager.username,
          benchId: readyProject._id, // Using project ID as bench ID context
          benchName: readyProject.projectName
        })
        console.log('✅ [TIMESHEET] Found mapped HR manager:', assignment.manager.email)
      } else {
        console.log('ℹ️ [TIMESHEET] No specific HR mapped for this employee in Ready-to-deploy')
      }
    } else {
      // Fallback to legacy Bench model if no Ready-to-deploy project logic matched (optional, can keep for backward compat)
      const benches = await Bench.find({
        employees: employeeId,
        status: 'active'
      }).populate('hrManager', 'email fullName username')

      benches.forEach(bench => {
        if (bench.hrManager && bench.hrManager.email) {
          const hrEmail = bench.hrManager.email
          if (!hrManagers.find(hr => hr.email === hrEmail)) {
            hrManagers.push({
              email: bench.hrManager.email,
              name: bench.hrManager.fullName || bench.hrManager.username,
              benchId: bench._id,
              benchName: bench.name
            })
            console.log('✅ [TIMESHEET] Added HR manager from Bench:', bench.hrManager.email, `- Bench: ${bench.name}`)
          }
        }
      })
    }

    // 3. Check for specific Business Unit HR assignment (from User Profile)
    // This handles cases where an employee is on the bench but assigned to a specific BU HR
    if (req.user.businessUnitHR) {
      console.log(`📋 [TIMESHEET] Finding HR for Business Unit: ${req.user.businessUnitHR}`)
      // Find HR/Admins tagged with this BU
      const buHrs = await User.find({
        role: { $in: ['hr', 'admin', 'supermanager', 'manager'] },
        businessUnitHR: req.user.businessUnitHR,
        _id: { $ne: employeeId } // Don't send to self
      }).select('email fullName username')

      buHrs.forEach(hr => {
        if (hr.email && !hrManagers.find(existing => existing.email === hr.email)) {
          hrManagers.push({
            email: hr.email,
            name: hr.fullName || hr.username,
            benchId: null,
            benchName: `BU: ${req.user.businessUnitHR}`
          })
          console.log(`✅ [TIMESHEET] Added BU HR: ${hr.email} for ${req.user.businessUnitHR}`)
        }
      })
    }

    console.log('📋 [TIMESHEET] Total HR managers found:', hrManagers.length)

    // Find Direct Manager (Superior)
    let directManager = null;
    if (req.user.managerId) {
      console.log('📋 [TIMESHEET] Checking for direct manager (superior)...');
      try {
        const managerUser = await User.findById(req.user.managerId).select('email fullName username');
        if (managerUser && managerUser.email) {
          directManager = {
            email: managerUser.email,
            name: managerUser.fullName || managerUser.username,
            isDirectManager: true
          };
          console.log('✅ [TIMESHEET] Found direct manager:', directManager.name, `(${directManager.email})`);
        }
      } catch (err) {
        console.error('❌ [TIMESHEET] Error fetching direct manager:', err);
      }
    }

    // Combine project managers, HR managers, and direct manager
    let allManagers = [...projectManagers, ...hrManagers]

    // Add direct manager if found and not already in the list
    if (directManager) {
      const alreadyExists = allManagers.some(m => m.email === directManager.email);
      if (!alreadyExists) {
        allManagers.push(directManager);
        console.log('✅ [TIMESHEET] Added direct manager to notification list');
      } else {
        console.log('ℹ️  [TIMESHEET] Direct manager already in list (as PM/HR)');
      }
    }

    if (allManagers.length === 0) {
      console.log('⚠️ [TIMESHEET] No managers found. Defaulting to Admin.')
      const admins = await User.find({ role: 'admin' }).select('email fullName username')

      if (admins.length > 0) {
        admins.forEach(admin => {
          // Avoid duplicates if admin happens to be in the list already (unlikely if list is 0, but good practice)
          if (!allManagers.some(m => m.email === admin.email)) {
            allManagers.push({
              email: admin.email,
              name: admin.fullName || admin.username,
              role: 'Admin (Fallback)'
            })
            console.log('✅ [TIMESHEET] Added Admin to notification list:', admin.email)
          }
        })
      } else {
        console.error('❌ [TIMESHEET] No managers AND No Admins found!')
        return res.status(400).json({ message: 'No managers or admins found to notify.' })
      }
    }

    console.log('📋 [TIMESHEET] All managers to notify:', allManagers.length)
    projectManagers.forEach(pm => {
      console.log('📋 [TIMESHEET]   Project Manager:', pm.name, `(${pm.email}) - Project: ${pm.projectName}`)
    })
    hrManagers.forEach(hr => {
      console.log('📋 [TIMESHEET]   HR Manager:', hr.name, `(${hr.email}) - Bench: ${hr.benchName}`)
    })

    // ---------------------------------------------------------
    // CONSOLIDATED SUBMISSION LOGIC
    // ---------------------------------------------------------

    // 1. Identify all projects involved in this timesheet from entries
    const involvedProjectIds = new Set()
    entries.forEach(e => {
      if (e.projectId) involvedProjectIds.add(e.projectId.toString())
    })

    // Also include projects from chargeCodes if projectId missing (legacy/fallback)
    // (Assuming chargeCode format 'projectId-projectName')
    entries.forEach(e => {
      if (!e.projectId && e.chargeCode) {
        e.chargeCode.split('-')
        // This is risky if projectId is not the ID but a code. 
        // Best to rely on frontend sending projectId.
        // If your system uses short codes, you might need a lookup map here.
      }
    })

    const uniqueProjectIds = Array.from(involvedProjectIds)

    // 2. Determine Primary Manager (Reporting Manager)
    let primaryManager = req.body.manager || ''; // Frontend might send it

    // Explicitly check User's managerId if not provided or to verify
    if (req.user.managerId) {
      // We could fetch it to be sure, or rely on frontend 'manager' name string
      // Ideally we store the ID. For now schema has simple String 'manager'.
      // Let's keep existing logic for 'manager' string but we know routing depends on pending check.
    }

    // 3. Construct the Single Timesheet Document Data
    // We use a generic chargeCode or "Multiple"

    // Upsert the single consolidated document
    const savedTimesheet = await Timesheet.findOneAndUpdate(
      {
        employeeId: employeeId,
        weekStartDate: new Date(req.body.weekStartDate),
        // We no longer split by chargeCode/Project. One sheet per week.
        // BUT successful 'Save Draft' might have created multiple docs if user saved rows individually?
        // If we switch to One-Doc, we should probably delete old draft docs or merge them.
        // For simplicity/safety: We assume clarity. 
        // Let's key by 'Consolidated' or simply find ONE doc for this week.
        // If we remove 'chargeCode' from filter, we might merge all into one.
      },
      {
        employeeName: name || req.user.fullName || req.user.username,
        month: month,
        manager: primaryManager, // Reporting Manager Name
        projectName: uniqueProjectIds.length > 1 ? "Multiple Projects" : (entries[0]?.chargeCode || "Generic"), // Visual Label
        // Reset singular projectId to null or first one
        projectId: uniqueProjectIds.length === 1 ? uniqueProjectIds[0] : null,
        projectIds: uniqueProjectIds, // NEW FIELD: All involved projects
        chargeCode: "Consolidated",
        entries: entries, // Full details
        // dailyHours: ... // Optional if we move away from top-level grid
        status: 'Submitted',
        submittedAt: new Date()
      },
      { new: true, upsert: true }
    );

    const savedTimesheets = [savedTimesheet]; // Keep array format for compatibility

    // 4. Notifications (Send to ALL relevant managers)
    // Re-use aggregation logic but now we notify all unique managers associated with 'uniqueProjectIds' + Reporting Manager

    console.log('📧 [TIMESHEET] Consolidated: Identifying managers for notification...');

    // Find projects details to get managers
    const involvedProjects = await Project.find({ _id: { $in: uniqueProjectIds } })
      .populate('projectManagers', 'email fullName username');

    const finalNotifyList = [];

    // Add Project Managers and Assigned Managers for this Employee
    involvedProjects.forEach(p => {
      // 1. Top-level Project Managers
      if (p.projectManagers) {
        p.projectManagers.forEach(pm => {
          if (pm.email && !finalNotifyList.some(x => x.email === pm.email)) {
            finalNotifyList.push({
              email: pm.email,
              name: pm.fullName || pm.username,
              role: 'Project Manager',
              project: p.projectName
            });
          }
        });
      }

      // 2. Assigned Manager for this specific employee in this project
      if (p.managerAssignments && p.managerAssignments.length > 0) {
        // Need to populate managerAssignments to look up emails? 
        // The project query above only populated 'projectManagers'.
        // We should probably rely on User lookup or re-query.
        // Or simpler: Iterate assignments, find if employee matches, then look up that manager.
        // Since we didn't populate managerAssignments.manager in previous query, let's just log or fetch.
        // Optimization: We can just use the 'managerAssignments' ID and fetch user details separately or add population above.
        // Let's assume we modify query above to populate default. But wait, `p` comes from above query.
      }
    });

    // FETCH MISSING DETAILS for Assigned Managers
    // We need a secondary pass because the initial query didn't populate managerAssignments.manager
    const projectsWithAssignments = await Project.find({
      _id: { $in: uniqueProjectIds },
      'managerAssignments.employee': employeeId
    }).populate('managerAssignments.manager', 'email fullName username');

    projectsWithAssignments.forEach(p => {
      const assignment = p.managerAssignments.find(a => a.employee.toString() === employeeId.toString());
      if (assignment && assignment.manager && assignment.manager.email) {
        const mgr = assignment.manager;
        if (!finalNotifyList.some(x => x.email === mgr.email)) {
          finalNotifyList.push({
            email: mgr.email,
            name: mgr.fullName || mgr.username,
            role: 'Assigned Manager',
            project: p.projectName
          });
        }
      }
    });

    // Add Direct Manager
    if (directManager && !finalNotifyList.some(x => x.email === directManager.officialEmail)) {
      finalNotifyList.push({ ...directManager, email: directManager.officialEmail, role: 'Reporting Manager' });
    }

    // Add HR Managers (Logic remains similar: from Ready-to-deploy or specific assignment)
    // Reuse existing 'hrManagers' from previous code block (lines 198-241 logic needs to be preserved or moved)
    // ... [assuming hrManagers array is populated as before] ...
    hrManagers.forEach(hr => {
      if (hr.officialEmail && !finalNotifyList.some(x => x.email === hr.officialEmail)) {
        finalNotifyList.push({
          email: hr.officialEmail,
          name: hr.name,
          role: 'HR Manager',
          project: hr.benchName
        });
      }
    });

    // Sending Emails
    const emailPromises = finalNotifyList.map(async (mgr) => {
      // ... (reuse email sending logic)
      try {
        console.log(`📧 [TIMESHEET] Sending email to ${mgr.email} (${mgr.role})...`)
        const emailData = {
          managerEmail: mgr.email,
          employeeName: name || req.user.fullName || req.user.username,
          employeeId: empId || req.user.employeeId || req.user._id.toString(),
          projectName: mgr.project || "Multiple Projects",
          month,
          entries,
          weekStartDate: req.body.weekStartDate
        }
        // ... send ...
        const emailSent = await sendTimesheetNotificationEmail(emailData)
        return { email: mgr.email, success: emailSent }
      } catch (error) {
        return { email: mgr.email, success: false, error: error.message }
      }
    });

    // Don't wait for emails - send them in background for faster response
    console.log('📧 [TIMESHEET] Sending emails in background (non-blocking)...')
    Promise.allSettled(emailPromises).then(emailResults => {

      console.log('📧 [TIMESHEET] Email results received:', emailResults.length)
      const emailStatus = emailResults.map((result, index) => {
        if (result.status === 'fulfilled') {
          console.log(`📧 [TIMESHEET] Email ${index + 1} result:`, result.value)
          return result.value
        } else {
          console.error(`❌ [TIMESHEET] Email promise rejected for ${allManagers[index].email}:`)
          console.error(`❌ [TIMESHEET] Reason:`, result.reason)
          return { email: allManagers[index].email, success: false, error: result.reason?.message || result.reason?.toString() }
        }
      })

      const successCount = emailStatus.filter(s => s.success).length
      const failureCount = emailStatus.filter(s => !s.success).length
      console.log('📧 [TIMESHEET] Email summary:')
      console.log('📧 [TIMESHEET]   Success:', successCount)
      console.log('📧 [TIMESHEET]   Failed:', failureCount)
      console.log('📧 [TIMESHEET] ==========================================')

      const successfulEmails = emailStatus.filter(s => s.success).map(s => s.email)
      const failedEmails = emailStatus.filter(s => !s.success)

      if (failedEmails.length > 0) {
        console.error('❌ Failed to send emails to:', failedEmails.map(f => `${f.email}: ${f.error}`).join(', '))
      }

      console.log(`📧 Email summary: ${successfulEmails.length} sent, ${failedEmails.length} failed`)
    })

    const notifiedEmails = allManagers.map(m => m.email)
    console.log('📋 [TIMESHEET] Timesheet submission completed successfully')
    console.log('📋 [TIMESHEET] Saved timesheets:', savedTimesheets.length)
    console.log('📋 [TIMESHEET] Emails will be sent in background to:', notifiedEmails)
    console.log('📋 [TIMESHEET] ==========================================')

    // Return response immediately without waiting for emails (emails sent in background)
    res.status(201).json({
      message: 'Timesheet submitted successfully. Notifications will be sent to project managers and HR managers.',
      timesheets: savedTimesheets,
      notifiedManagers: notifiedEmails
    })
  } catch (error) {
    console.error('❌ [TIMESHEET] ==========================================')
    console.error('❌ [TIMESHEET] Error in timesheet submission!')
    console.error('❌ [TIMESHEET] Error type:', error.constructor.name)
    console.error('❌ [TIMESHEET] Error message:', error.message)
    console.error('❌ [TIMESHEET] Error stack:', error.stack)
    console.error('❌ [TIMESHEET] ==========================================')
    res.status(500).json({ message: 'Server error while submitting timesheet' })
  }
})

// Get user's timesheets
router.get('/my-timesheets', authenticate, async (req, res) => {
  try {
    const timesheets = await Timesheet.find({ employeeId: req.user._id })
      .populate('projectId', 'projectName projectId')
      .sort({ submittedAt: -1 })

    res.json({ timesheets })
  } catch (error) {
    console.error('Get timesheets error:', error)
    res.status(500).json({ message: 'Server error while fetching timesheets' })
  }
})

// Get timesheets for a project (for project managers)
router.get('/project/:projectId', authenticate, async (req, res) => {
  try {
    const { projectId } = req.params

    // Check if user is a project manager for this project
    const project = await Project.findById(projectId)
    if (!project) {
      return res.status(404).json({ message: 'Project not found' })
    }

    const isManager = project.projectManagers.some(
      mgrId => mgrId.toString() === req.user._id.toString()
    )

    if (!isManager) {
      return res.status(403).json({ message: 'You are not authorized to view timesheets for this project' })
    }

    // Updated query to check if the timesheet includes this project in its projectIds list
    const timesheets = await Timesheet.find({ projectIds: projectId })
      .populate('employeeId', 'fullName username email employeeId')
      .sort({ submittedAt: -1 })

    res.json({ timesheets })
  } catch (error) {
    console.error('Get project timesheets error:', error)
    res.status(500).json({ message: 'Server error while fetching timesheets' })
  }
})


// Get ALL timesheets (Super Manager view)
router.get('/all', authenticate, async (req, res) => {
  try {
    const userRole = req.user.role

    if (userRole !== 'supermanager' && userRole !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to view all timesheets' })
    }

    console.log('📋 [TIMESHEET] Super Manager fetching ALL timesheets')

    const timesheets = await Timesheet.find({})
      .populate('employeeId', 'fullName username email employeeId')
      .populate('projectId', 'projectName')
      .sort({ submittedAt: -1 })

    res.json({ timesheets })
  } catch (error) {
    console.error('Get all timesheets error:', error)
    res.status(500).json({ message: 'Server error while fetching all timesheets' })
  }
})

// GET /pending - Get all timesheets for manager approval (Submitted, Approved, Rejected)
// Note: Route name is "pending" but we now use it for "manager view" of all history
router.get('/pending', authenticate, async (req, res) => {
  try {
    const userId = req.user._id
    const userRole = req.user.role
    const userEmail = req.user.email

    let query = {}

    // If supermanager, they can see ALL pending timesheets
    if (userRole === 'supermanager') {
      console.log('📋 [TIMESHEET] User is supermanager - fetching ALL submitted timesheets')
      // query remains just status: 'submitted' (or empty if we want everything) but logic matches existing
    } else {
      // 1. Find projects where user is a Project Manager
      // Ensure userId is treated as ObjectId for the query
      // Also check for String version of ID just in case data is inconsistent
      const projectsManaged = await Project.find({
        projectManagers: { $in: [userId, userId.toString()] }
      }).select('_id')

      const projectIds = projectsManaged.map(p => p._id)
      console.log(`📋 [TIMESHEET] Managed Project IDs count: ${projectIds.length}`)
      console.log('🔍 [DEBUG] Managed Project IDs:', projectIds)


      // 2. Find benches where user is an HR Manager
      const benchesManaged = await Bench.find({
        hrManager: userId
      }).select('employees')

      // Get all employee IDs from managed benches
      let benchEmployeeIds = []
      benchesManaged.forEach(bench => {
        if (bench.employees && bench.employees.length > 0) {
          benchEmployeeIds = [...benchEmployeeIds, ...bench.employees]
        }
      })
      console.log(`📋 [TIMESHEET] Managed Bench Employees count: ${benchEmployeeIds.length}`)

      // 3. Find employees mapped to this user in ANY project (Generalizing from just 'Ready-to-deploy')
      // This allows managers assigned via 'managerAssignments' in regular projects to see their assignees' sheets
      const assignmentProjects = await Project.find({
        'managerAssignments.manager': userId
      }).select('managerAssignments')

      let mappedEmployeeIds = []

      if (assignmentProjects.length > 0) {
        console.log(`🔍 [DEBUG] Found ${assignmentProjects.length} projects with assignments for user ${userId}`)

        assignmentProjects.forEach(proj => {
          const myAssignments = proj.managerAssignments.filter(
            a => a.manager.toString() === userId.toString()
          )
          const empIds = myAssignments.map(a => a.employee)
          mappedEmployeeIds = [...mappedEmployeeIds, ...empIds]
        })
        console.log(`📋 [TIMESHEET] Mapped Employees (Assignments) count: ${mappedEmployeeIds.length}`)
      }


      // 4. Find employees who have this user set as their managerId (Direct Report / Synced Report)
      console.log(`🔍 [DEBUG] Looking for direct reports with managerId: "${userId.toString()}"`)
      const directReportEmployees = await User.find({ managerId: userId.toString() }).select('_id username managerId')
      console.log(`🔍 [DEBUG] found direct reports:`, directReportEmployees.map(u => ({ id: u._id, name: u.username, mgr: u.managerId })))

      const directReportIds = directReportEmployees.map(u => u._id)
      console.log(`📋 [TIMESHEET] Direct Report Employees (User.managerId) count: ${directReportIds.length}`)

      // 5. Find employees belonging to the same Business Unit HR (if user is a BU HR)
      let buEmployeeIds = [];
      if (req.user.businessUnitHR) {
        console.log(`📋 [TIMESHEET] Fetching employees for Business Unit: ${req.user.businessUnitHR}`)
        const buEmployees = await User.find({ businessUnitHR: req.user.businessUnitHR }).select('_id');
        buEmployeeIds = buEmployees.map(u => u._id);
        console.log(`📋 [TIMESHEET] BU Employees count: ${buEmployeeIds.length}`)
        console.log(`🔍 [DEBUG] BU Employee IDs:`, buEmployeeIds)
      }

      console.log('🔍 [DEBUG] Construction Checks:')
      console.log(' - User:', req.user.email, req.user.role)
      console.log(' - BU:', req.user.businessUnitHR)
      console.log(' - Projects:', projectIds.length)
      console.log(' - Benches:', benchEmployeeIds.length)
      console.log(' - Mapped:', mappedEmployeeIds.length)
      console.log(' - Direct:', directReportIds.length)
      console.log(' - BU Emps:', buEmployeeIds.length)

      if (projectIds.length === 0 && benchEmployeeIds.length === 0 && mappedEmployeeIds.length === 0 && directReportIds.length === 0 && buEmployeeIds.length === 0) {
        console.log('📋 [TIMESHEET] User manages no projects, benches, mapped employees, direct reports, or BU employees. Returning empty list.')
        console.log(`   - Projects: ${projectIds.length}`)
        console.log(`   - Benches: ${benchEmployeeIds.length}`)
        console.log(`   - Mapped: ${mappedEmployeeIds.length}`)
        console.log(`   - Direct: ${directReportIds.length}`)
        console.log(`   - BU HR: ${buEmployeeIds.length}`)
        return res.json({ timesheets: [] })
      }

      // 3. Construct query
      query.$or = []
      if (projectIds.length > 0) {
        // Query if ANY of the manager's projects are in the timesheet's 'projectIds' list
        query.$or.push({ projectIds: { $in: projectIds } })

        // Keep backward compatibility for old records with single projectId
        query.$or.push({ projectId: { $in: projectIds } })
      }
      if (benchEmployeeIds.length > 0) {
        query.$or.push({ employeeId: { $in: benchEmployeeIds } })
      }
      if (mappedEmployeeIds.length > 0) {
        query.$or.push({ employeeId: { $in: mappedEmployeeIds } })
      }
      if (directReportIds.length > 0) {
        query.$or.push({ employeeId: { $in: directReportIds } })
      }
      if (buEmployeeIds.length > 0) {
        query.$or.push({ employeeId: { $in: buEmployeeIds } })
      }

      console.log('🔍 [DEBUG] Final Query $or condition:', JSON.stringify(query.$or, null, 2))
    }

    const pendingTimesheets = await Timesheet.find(query)
      .populate('employeeId', 'fullName username email employeeId')
      .populate('projectId', 'projectName')
      .sort({ submittedAt: 1 }) // Oldest first

    console.log(`✅ [TIMESHEET] Found ${pendingTimesheets.length} pending timesheets for ${userEmail}`)
    res.json({ timesheets: pendingTimesheets })

  } catch (error) {
    console.error('❌ [TIMESHEET] Error fetching pending timesheets:', error)
    res.status(500).json({ message: 'Server error while fetching pending approvals' })
  }
})


// Update timesheet status (Approve/Reject)
router.put('/:id/status', authenticate, async (req, res) => {
  try {
    const { id } = req.params
    const { status, rejectionReason } = req.body
    const userId = req.user._id

    // Normalize legacy "rejected" into "rejected-edit" so employees can edit/resubmit
    let normalizedStatus = status === 'rejected' ? 'rejected-edit' : status
    if (normalizedStatus === 'approved') normalizedStatus = 'Approved'

    if (!['approved', 'Approved', 'on-hold', 'rejected-edit'].includes(normalizedStatus)) {
      return res.status(400).json({ message: 'Invalid status. Must be approved, rejected-edit, or on-hold.' })
    }

    const timesheet = await Timesheet.findById(id)
      .populate('employeeId', 'fullName email username')
      .populate('projectId', 'projectName')

    if (!timesheet) {
      return res.status(404).json({ message: 'Timesheet not found' })
    }

    // Verify authority (must be project manager or bench HR)
    // 1. Check if user is PM for the project
    // -------------------------------------------------------------------------
    // AUTHORIZATION CHECK (for Non-Admins)
    // -------------------------------------------------------------------------
    if (req.user.role !== 'admin') {
      // timesheet and userId are already defined above
      // const timesheet = await Timesheet.findById(req.params.id); // Redundant, already fetched
      // if (!timesheet) return res.status(404).json({ message: "Timesheet not found" }); // Redundant

      // const userId = req.user._id; // Redundant, already fetched

      // 1. Check if user is the direct manager (Reporting Manger)
      // Note: `timesheet.manager` is currently a string name, which is unreliable.
      // Better to check User model mapping: Does this user manage the timesheet owner?
      const employee = await User.findOne({ _id: timesheet.employeeId });
      const isDirectManager = employee && employee.managerId && employee.managerId.toString() === userId.toString();

      // 2. Check if user managers ANY project in the timesheet
      // Get all projects managed by this user
      const managedProjects = await Project.find({
        $or: [
          { projectManagers: userId },
          { 'managerAssignments.manager': userId }
        ]
      }).select('_id');

      const managedProjectIds = managedProjects.map(p => p._id.toString());

      // Get all projects IN the timesheet
      const sheetProjectIds = (timesheet.projectIds || []).map(id => id.toString());
      if (timesheet.projectId) sheetProjectIds.push(timesheet.projectId.toString()); // legacy support

      // Check overlap
      const managesSheetProject = sheetProjectIds.some(id => managedProjectIds.includes(id));

      // 3. Check specific HR/Bench assignments (Ready-to-deploy)
      let managesBenchResource = false;
      const readyProject = await Project.findOne({ projectName: 'Ready-to-deploy resources' });
      if (readyProject) {
        // Check if this employee is assigned to this manager within Ready-to-deploy
        const assignment = readyProject.managerAssignments?.find(
          a => a.manager.toString() === userId.toString() && a.employee.toString() === timesheet.employeeId.toString()
        );
        if (assignment) managesBenchResource = true;

        // Fallback: If manager is a general PM for Ready-to-deploy and employee is in it?
        // (Specific assignment usually takes precedence, keeping strict for now)
      }

      console.log(`🔒 [AUTH CHECK] User: ${req.user.username} (${userId})`);
      console.log(`   - Direct Manager: ${isDirectManager}`);
      console.log(`   - Manages Project: ${managesSheetProject} (Overlap: ${JSON.stringify(sheetProjectIds)} vs ${JSON.stringify(managedProjectIds)})`);
      console.log(`   - Bench Manager: ${managesBenchResource}`);

      if (!isDirectManager && !managesSheetProject && !managesBenchResource && timesheet.manager !== req.user.fullName) {
        // Last ditch: check legacy string match on 'manager' field (weak but fallback)
        // Note: timesheet.manager might be "Harsha P" and req.user.fullName "Harsha P"
        console.warn(`   x Authorization FAILED.`);
        return res.status(403).json({ message: "Not authorized to approve this timesheet" });
      }
      console.log(`   ✓ Authorization PASSED.`);
    }// Update status and rejection reason
    timesheet.status = normalizedStatus
    if (rejectionReason) {
      timesheet.rejectionReason = rejectionReason
    } else if (normalizedStatus === 'submitted') {
      timesheet.rejectionReason = undefined
    }

    await timesheet.save()

    console.log(`✅ [TIMESHEET] Timesheet ${id} ${status} by ${req.user.email}`)

    // Send notification email to employee
    try {
      /* const emailData = {
        employeeEmail: timesheet.employeeId.email,
        employeeName: timesheet.employeeId.fullName || timesheet.employeeId.username,
        managerName: req.user.fullName || req.user.username,
        status: status,
        month: timesheet.month,
        projectName: timesheet.projectName || 'N/A',
        comments: comments || ''
      } */

      // We need a helper for this status email. 
      // For now, assuming generic email service or I'll add a helper inline/import if exists.
      // Since sendTimesheetNotificationEmail is for submission, I'll use a new function or generic sendEmail

      // TODO: Implement sendTimesheetStatusEmail in emailService
      // await sendTimesheetStatusEmail(emailData) 
      console.log('📧 [TIMESHEET] Status update email logic placeholder')

    } catch (emailError) {
      console.error('❌ [TIMESHEET] Failed to send status email:', emailError)
    }

    res.json({ message: `Timesheet ${status} successfully`, timesheet })

  } catch (error) {
    console.error('❌ [TIMESHEET] Error updating status:', error)
    res.status(500).json({ message: 'Server error while updating status' })
  }
})

export default router


