
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Timesheet from './models/Timesheet.js';
import Project from './models/Project.js';
import Bench from './models/Bench.js';

dotenv.config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        // 1. Simulate req.user (Ganesh)
        const user = await User.findOne({
            $or: [
                { username: { $regex: 'ganesh', $options: 'i' } },
                { fullName: { $regex: 'ganesh', $options: 'i' } }
            ]
        });

        if (!user) {
            console.log('❌ User Ganesh not found');
            return;
        }

        console.log(`\n👤 Acting as User: ${user.fullName} (${user.email})`);
        console.log(`   Role: ${user.role}`);
        console.log(`   BusinessUnitHR: ${user.businessUnitHR}`);
        console.log(`   ID: ${user._id}`);

        // --- SIMULATE LOGIC FROM routes/timesheet.js ---

        let query = {};
        const userId = user._id;

        // 1. Projects Managed
        const projectsManaged = await Project.find({
            projectManagers: { $in: [userId, userId.toString()] }
        }).select('_id');
        const projectIds = projectsManaged.map(p => p._id);
        console.log(`   Projects Managed: ${projectIds.length}`);

        // 2. Benches Managed (HR Manager)
        const benchesManaged = await Bench.find({ hrManager: userId }).select('employees');
        let benchEmployeeIds = [];
        benchesManaged.forEach(bench => {
            if (bench.employees) benchEmployeeIds = [...benchEmployeeIds, ...bench.employees];
        });
        console.log(`   Bench Employees: ${benchEmployeeIds.length}`);

        // 3. Mapped Employees (Manager Assignments in Projects)
        const assignmentProjects = await Project.find({ 'managerAssignments.manager': userId }).select('managerAssignments');
        let mappedEmployeeIds = [];
        if (assignmentProjects.length > 0) {
            assignmentProjects.forEach(proj => {
                const myAssignments = proj.managerAssignments.filter(a => a.manager.toString() === userId.toString());
                mappedEmployeeIds = [...mappedEmployeeIds, ...myAssignments.map(a => a.employee)];
            });
        }
        console.log(`   Mapped Employees: ${mappedEmployeeIds.length}`);

        // 4. Direct Reports
        const directReportEmployees = await User.find({ managerId: userId.toString() }).select('_id');
        const directReportIds = directReportEmployees.map(u => u._id);
        console.log(`   Direct Reports: ${directReportIds.length}`);

        // 5. BU HR Employees
        let buEmployeeIds = [];
        if (user.businessUnitHR) {
            const buEmployees = await User.find({ businessUnitHR: user.businessUnitHR }).select('_id fullName');
            buEmployeeIds = buEmployees.map(u => u._id);
            console.log(`   BU Employees (${user.businessUnitHR}): ${buEmployeeIds.length}`);
            // buEmployees.forEach(e => console.log(`      - ${e.fullName} (${e._id})`));
        }

        // Check if "Unassigned Emp" is in BU Employees
        // We know unassigned emp id from previous debug or we can find last timesheet emp
        const recentTimesheet = await Timesheet.findOne({}).sort({ createdAt: -1 });
        if (recentTimesheet) {
            const tsEmpId = recentTimesheet.employeeId.toString();
            const isInBU = buEmployeeIds.some(id => id.toString() === tsEmpId);
            console.log(`\n   🔎 Checking specific Timesheet Emp (${recentTimesheet.employeeName}):`);
            console.log(`      In BU List? ${isInBU ? 'YES ✅' : 'NO ❌'}`);
        }

        // Construct Query
        if (projectIds.length === 0 && benchEmployeeIds.length === 0 && mappedEmployeeIds.length === 0 && directReportIds.length === 0 && buEmployeeIds.length === 0) {
            console.log('   ⚠️ No managed entities found. Query would match NOTHING.');
        } else {
            query.$or = [];
            if (projectIds.length > 0) {
                query.$or.push({ projectIds: { $in: projectIds } });
                query.$or.push({ projectId: { $in: projectIds } });
            }
            if (benchEmployeeIds.length > 0) query.$or.push({ employeeId: { $in: benchEmployeeIds } });
            if (mappedEmployeeIds.length > 0) query.$or.push({ employeeId: { $in: mappedEmployeeIds } });
            if (directReportIds.length > 0) query.$or.push({ employeeId: { $in: directReportIds } });
            if (buEmployeeIds.length > 0) query.$or.push({ employeeId: { $in: buEmployeeIds } });

            console.log(`\n   🛠 Constructed Query $or length: ${query.$or.length}`);

            // RUN QUERY
            const pendingTimesheets = await Timesheet.find(query);
            console.log(`\n✅ QUERY RESULTS: Found ${pendingTimesheets.length} timesheets.`);
            pendingTimesheets.forEach(t => {
                console.log(`   - [${t.status}] ${t.employeeName}: ${t._id}`);
            });
        }

    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }
};

run();
