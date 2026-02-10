import mongoose from 'mongoose'
import dotenv from 'dotenv'
import FormConfig from '../models/FormConfig.js'

dotenv.config()

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/myapp'

// Define the employee form structure based on current UserManagement.jsx
const employeeFormConfig = {
    formType: 'employee',
    formName: 'Employee Registration Form',
    description: 'Comprehensive employee onboarding and management form',
    sections: [
        {
            id: 'basic-info',
            title: 'Basic Information',
            description: 'Personal details and contact information',
            order: 0,
            isActive: true,
            isCollapsible: true,
            fields: [
                { name: 'firstName', label: 'First Name', type: 'text', required: true, order: 0, width: 'third' },
                { name: 'middleName', label: 'Middle Name', type: 'text', required: false, order: 1, width: 'third' },
                { name: 'lastName', label: 'Last Name', type: 'text', required: true, order: 2, width: 'third' },
                { name: 'email', label: 'Personal Email ID', type: 'email', required: false, order: 3, width: 'half' },
                { name: 'alternativeEmail', label: 'Alternative Email ID', type: 'email', required: false, order: 4, width: 'half' },
                { name: 'phone', label: 'Phone Number', type: 'tel', required: true, order: 5, width: 'half' },
                { name: 'dateOfBirth', label: 'Date of Birth', type: 'date', required: false, order: 6, width: 'half' },
                { name: 'gender', label: 'Gender', type: 'select', required: false, options: ['Male', 'Female', 'Other'], order: 7, width: 'half' },
                { name: 'maritalStatus', label: 'Marital Status', type: 'select', required: false, options: ['Single', 'Married', 'Divorced', 'Widowed'], order: 8, width: 'half' },
                { name: 'bloodGroup', label: 'Blood Group', type: 'select', required: false, options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], order: 9, width: 'half' }
            ]
        },
        {
            id: 'address-info',
            title: 'Address Information',
            description: 'Present, permanent, and Aadhaar addresses',
            order: 1,
            isActive: true,
            isCollapsible: true,
            fields: [
                { name: 'presentAddress.line1', label: 'Present Address Line 1', type: 'text', required: false, order: 0, width: 'full' },
                { name: 'presentAddress.line2', label: 'Present Address Line 2', type: 'text', required: false, order: 1, width: 'full' },
                { name: 'presentAddress.pincode', label: 'Pincode', type: 'text', required: false, order: 2, width: 'quarter' },
                { name: 'presentAddress.district', label: 'District', type: 'text', required: false, order: 3, width: 'quarter' },
                { name: 'presentAddress.state', label: 'State', type: 'text', required: false, order: 4, width: 'quarter' },
                { name: 'presentAddress.country', label: 'Country', type: 'text', required: false, order: 5, width: 'quarter' }
            ]
        },
        {
            id: 'employment-info',
            title: 'Employment Information',
            description: 'Job details, role, and work information',
            order: 2,
            isActive: true,
            isCollapsible: true,
            fields: [
                { name: 'employeeId', label: 'Employee ID', type: 'text', required: true, order: 0, width: 'half' },
                { name: 'officialEmail', label: 'Official Email ID', type: 'email', required: true, helpText: 'This email will be used for login and all system notifications', order: 1, width: 'full' },
                { name: 'designation', label: 'Designation', type: 'text', required: false, order: 2, width: 'half' },
                { name: 'role', label: 'Role', type: 'select', required: true, options: ['employee', 'manager', 'hr', 'admin', 'c-suite', 'tl', 'supermanager'], order: 3, width: 'half' },
                { name: 'businessUnitHR', label: 'Department/Business Unit', type: 'select', required: false, options: ['BU1', 'BU2', 'BU3'], order: 4, width: 'half' },
                { name: 'employeeStatus', label: 'Employee Status', type: 'select', required: true, options: ['Active', 'Inactive'], order: 5, width: 'half' },
                { name: 'joiningDate', label: 'Joining Date', type: 'date', required: false, order: 6, width: 'half' },
                { name: 'probationPeriod', label: 'Probation Period (days)', type: 'number', required: false, order: 7, width: 'half' }
            ]
        },
        {
            id: 'education-info',
            title: 'Education Details',
            description: 'Academic qualifications and certifications',
            order: 3,
            isActive: true,
            isCollapsible: true,
            fields: [
                { name: 'education', label: 'Education Records', type: 'textarea', required: false, helpText: 'Add education details (handled separately in UI)', order: 0, width: 'full' }
            ]
        },
        {
            id: 'bank-details',
            title: 'Bank Details',
            description: 'Banking information for salary processing',
            order: 4,
            isActive: true,
            isCollapsible: true,
            fields: [
                { name: 'accountNumber', label: 'Account Number', type: 'text', required: false, order: 0, width: 'half' },
                { name: 'confirmAccountNumber', label: 'Confirm Account Number', type: 'text', required: false, order: 1, width: 'half' },
                { name: 'bankName', label: 'Bank Name', type: 'text', required: false, order: 2, width: 'half' },
                { name: 'ifscCode', label: 'IFSC Code', type: 'text', required: false, order: 3, width: 'half' },
                { name: 'accountType', label: 'Account Type', type: 'select', required: false, options: ['Savings', 'Current'], order: 4, width: 'half' },
                { name: 'branchName', label: 'Branch Name', type: 'text', required: false, order: 5, width: 'half' },
                { name: 'swiftCode', label: 'SWIFT Code', type: 'text', required: false, order: 6, width: 'half' },
                { name: 'nameAsPerBankRecords', label: 'Name as per Bank Records', type: 'text', required: false, order: 7, width: 'half' }
            ]
        },
        {
            id: 'pf-details',
            title: 'PF Details',
            description: 'Provident Fund information',
            order: 5,
            isActive: true,
            isCollapsible: true,
            fields: [
                { name: 'isEligibleForPF', label: 'Eligible for PF', type: 'checkbox', required: false, order: 0, width: 'half' },
                { name: 'pfNumber', label: 'PF Number', type: 'text', required: false, order: 1, width: 'half' },
                { name: 'pfScheme', label: 'PF Scheme', type: 'text', required: false, order: 2, width: 'half' },
                { name: 'pfJoiningDate', label: 'PF Joining Date', type: 'date', required: false, order: 3, width: 'half' },
                { name: 'isExistingMemberOfPF', label: 'Existing PF Member', type: 'checkbox', required: false, order: 4, width: 'half' }
            ]
        },
        {
            id: 'esi-details',
            title: 'ESI Details',
            description: 'Employee State Insurance information',
            order: 6,
            isActive: true,
            isCollapsible: true,
            fields: [
                { name: 'isEligibleForESI', label: 'Eligible for ESI', type: 'checkbox', required: false, order: 0, width: 'half' },
                { name: 'esiNumber', label: 'ESI Number', type: 'text', required: false, order: 1, width: 'half' },
                { name: 'isCoveredUnderLWF', label: 'Covered under LWF', type: 'checkbox', required: false, order: 2, width: 'half' }
            ]
        },
        {
            id: 'account-setup',
            title: 'Account Setup',
            description: 'Login credentials and access',
            order: 7,
            isActive: true,
            isCollapsible: true,
            fields: [
                { name: 'password', label: 'Password', type: 'text', required: false, helpText: 'Leave blank to keep existing password', order: 0, width: 'full' }
            ]
        }
    ],
    version: 1,
    isActive: true
}

async function migrateEmployeeForm() {
    try {
        console.log('🔄 Connecting to MongoDB...')
        await mongoose.connect(MONGODB_URI)
        console.log('✅ Connected to MongoDB')

        // Check if employee form config already exists
        const existing = await FormConfig.findOne({ formType: 'employee' })

        if (existing) {
            console.log('⚠️  Employee form configuration already exists!')
            console.log('   Do you want to update it? (This will overwrite existing config)')
            console.log('   To update, delete the existing config first or modify this script.')
            await mongoose.connection.close()
            return
        }

        // Create new form configuration
        console.log('📝 Creating employee form configuration...')
        const formConfig = new FormConfig(employeeFormConfig)
        await formConfig.save()

        console.log('✅ Employee form configuration created successfully!')
        console.log(`   - Form Type: ${formConfig.formType}`)
        console.log(`   - Sections: ${formConfig.sections.length}`)
        console.log(`   - Total Fields: ${formConfig.sections.reduce((sum, s) => sum + s.fields.length, 0)}`)
        console.log(`   - Version: ${formConfig.version}`)
        console.log('\n📋 Sections created:')
        formConfig.sections.forEach(section => {
            console.log(`   - ${section.title} (${section.fields.length} fields)`)
        })

        await mongoose.connection.close()
        console.log('\n✅ Migration completed successfully!')
        console.log('   You can now access the Form Builder to manage this configuration.')
    } catch (error) {
        console.error('❌ Migration failed:', error)
        await mongoose.connection.close()
        process.exit(1)
    }
}

// Run migration
migrateEmployeeForm()
