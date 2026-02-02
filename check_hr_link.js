
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        // 1. Check the Employee (Ganesh)
        const employee = await User.findOne({
            $or: [
                { email: { $regex: 'ganesh', $options: 'i' } },
                { fullName: { $regex: 'ganesh', $options: 'i' } }
            ]
        });

        if (!employee) {
            console.log('❌ Employee "Ganesh" NOT FOUND');
        } else {
            console.log(`\n👨‍💼 EMPLOYEE: ${employee.fullName} (${employee.email})`);
            console.log(`   ID: ${employee._id}`);
            console.log(`   Role: ${employee.role}`);
            console.log(`   BusinessUnitHR: '${employee.businessUnitHR}'`);
        }

        // 2. Check the HR (hr.bu1@artihcus.com)
        const hrEmail = 'hr.bu1@artihcus.com';
        const hr = await User.findOne({ email: hrEmail });

        if (!hr) {
            console.log(`\n❌ HR User "${hrEmail}" NOT FOUND`);
        } else {
            console.log(`\n👩‍💼 HR ADMIN: ${hr.fullName} (${hr.email})`);
            console.log(`   ID: ${hr._id}`);
            console.log(`   Role: ${hr.role}`);
            console.log(`   BusinessUnitHR: '${hr.businessUnitHR}'`); // THIS MUST MATCH EMPLOYEE'S BU

            if (employee && hr) {
                const match = employee.businessUnitHR === hr.businessUnitHR;
                console.log(`\n🔗 LINK STATUS: ${match ? 'CONNECTED ✅' : 'BROKEN ❌'}`);
                if (!match) console.log(`   Reason: Employee is '${employee.businessUnitHR}' but HR is '${hr.businessUnitHR}'`);
            }
        }

    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }
};

run();
