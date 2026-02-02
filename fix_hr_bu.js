
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const hrEmail = 'hr.bu1@artihcus.com';

        // 1. Find the HR
        const hr = await User.findOne({ email: hrEmail });

        if (!hr) {
            console.log(`❌ HR User "${hrEmail}" NOT FOUND`);
            return;
        }

        console.log(`\n👩‍💼 BEFORE UPDATE:`);
        console.log(`   Name: ${hr.fullName}`);
        console.log(`   BU: ${hr.businessUnitHR}`);

        // 2. Update to BU1
        hr.businessUnitHR = 'BU1';
        await hr.save();

        console.log(`\n✅ AFTER UPDATE:`);
        console.log(`   Name: ${hr.fullName}`);
        console.log(`   BU: ${hr.businessUnitHR}`);
        console.log(`\n🎉 FIXED! The HR is now officially "The HR for BU1". Timesheets should appear.`);

    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }
};

run();
