
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Timesheet from './models/Timesheet.js';

dotenv.config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        // 1. Find 'Ganesh'
        const ganesh = await User.findOne({
            $or: [
                { username: { $regex: 'ganesh', $options: 'i' } },
                { fullName: { $regex: 'ganesh', $options: 'i' } }
            ]
        });

        if (!ganesh) {
            console.log('USER_NOT_FOUND');
        } else {
            console.log(`__USER_DATA_START__`);
            console.log(`ID: ${ganesh._id}`);
            console.log(`Role: ${ganesh.role}`);
            console.log(`BU: ${ganesh.businessUnitHR}`);
            console.log(`__USER_DATA_END__`);
        }

        // 2. Find Users with BU1
        const bu1Users = await User.find({ businessUnitHR: 'BU1' });
        console.log(`\n📋 Users in BU1: ${bu1Users.length}`);
        bu1Users.forEach(u => console.log(`   - ${u.fullName} (${u.role}) [${u._id}]`));

        // 3. Find recent Timesheets
        const timesheets = await Timesheet.find({}).sort({ createdAt: -1 }).limit(5);
        console.log(`\n📋 Recent Timesheets (Last 5):`);
        for (const t of timesheets) {
            console.log(`   - ID: ${t._id}`);
            console.log(`     Employee: ${t.employeeName} (${t.employeeId})`);
            console.log(`     Status: '${t.status}'`);

            // Check employee of this timesheet
            const emp = await User.findById(t.employeeId);
            if (emp) {
                console.log(`     -> Emp BU: '${emp.businessUnitHR}'`);
            } else {
                console.log(`     -> Emp NOT FOUND`);
            }
        }

    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }
};

run();
