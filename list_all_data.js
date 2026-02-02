
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Timesheet from './models/Timesheet.js';

dotenv.config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        console.log('\n📋 --- RELEVANT USERS (With name match or BU set) ---');
        // Find users with 'ganesh' in name OR 'unassigned' in name OR businessUnitHR is not null
        const users = await User.find({
            $or: [
                { fullName: { $regex: 'ganesh', $options: 'i' } },
                { username: { $regex: 'ganesh', $options: 'i' } },
                { businessUnitHR: { $ne: null } }
            ]
        }).select('fullName email role businessUnitHR _id');

        users.forEach(u => {
            console.log(`- ${u.fullName} (${u.email}) [${u._id}]`);
            console.log(`  Role: ${u.role} | BU: '${u.businessUnitHR}'`);
        });

        console.log('\n📋 --- ALL TIMESHEETS ---');
        const timesheets = await Timesheet.find({}).sort({ createdAt: -1 });
        timesheets.forEach(t => {
            console.log(`- Employee: ${t.employeeName} | Project: ${t.projectName} | Status: ${t.status}`);
        });

    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }
};

run();
