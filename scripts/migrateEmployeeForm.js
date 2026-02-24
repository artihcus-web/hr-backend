import mongoose from 'mongoose'
import dotenv from 'dotenv'
import FormConfig from '../models/FormConfig.js'

dotenv.config()

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/myapp'

// Comprehensive employee form structure with ALL fields from UserManagement.jsx
const employeeFormConfig = {
    formType: 'employee',
    formName: 'Employee Registration Form',
    description: 'Comprehensive employee onboarding and management form',
    sections: [
        {
            id: 'basic-info',
            title: 'Basic Information',
            description: 'Personal details and identification information',
            order: 0,
            isActive: true,
            isCollapsible: true,
            fields: [
                { name: 'profileImage', label: 'Profile Image', type: 'file', required: false, order: -1, width: 'full', helpText: 'Max 1MB, JPEG or PNG', isActive: true },
                { name: 'employeeName', label: 'Employee Name', type: 'text', required: false, order: 0, width: 'full', isActive: true },
                { name: 'firstName', label: 'First Name', type: 'text', required: true, order: 1, width: 'third', isActive: true },
                { name: 'middleName', label: 'Middle Name', type: 'text', required: false, order: 2, width: 'third', isActive: true },
                { name: 'lastName', label: 'Last Name', type: 'text', required: true, order: 3, width: 'third', isActive: true },
                { name: 'gender', label: 'Gender', type: 'select', required: false, options: ['Male', 'Female', 'Other'], order: 4, width: 'half', isActive: true },
                { name: 'bloodGroup', label: 'Blood Group', type: 'select', required: false, options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], order: 5, width: 'half', isActive: true },
                { name: 'birthdayDate', label: 'DOB as per Aadhaar', type: 'date', required: false, order: 6, width: 'half', isActive: true },
                { name: 'dateOfBirth', label: 'Date of Birth (Actual)', type: 'date', required: false, order: 7, width: 'half', isActive: true },
                { name: 'maritalStatus', label: 'Marital Status', type: 'select', required: false, options: ['Single', 'Married', 'Divorced', 'Widowed'], order: 8, width: 'half', isActive: true },
                { name: 'marriageDate', label: 'Marriage Date', type: 'date', required: false, order: 9, width: 'half', isActive: true },
                { name: 'isPhysicallyChallenged', label: 'Physically Challenged', type: 'checkbox', required: false, order: 10, width: 'half', isActive: true },
                { name: 'physicallyChallengedDetails', label: 'Physically Challenged Details', type: 'text', required: false, order: 11, width: 'half', isActive: true },
                { name: 'isInternationalEmployee', label: 'International Employee', type: 'checkbox', required: false, order: 12, width: 'half', isActive: true },
                { name: 'countryOfOrigin', label: 'Country of Origin', type: 'text', required: false, order: 13, width: 'half', isActive: true },
                { name: 'cityLocation', label: 'City Location', type: 'text', required: false, order: 14, width: 'half', isActive: true }
            ]
        },
        {
            id: 'contact-info',
            title: 'Contact Information',
            description: 'Phone numbers and email addresses',
            order: 1,
            isActive: true,
            isCollapsible: true,
            fields: [
                { name: 'primaryCountryCode', label: 'Primary Country Code', type: 'text', required: false, order: 0, width: 'quarter', isActive: true },
                { name: 'phone', label: 'Phone Number', type: 'tel', required: true, order: 1, width: 'half', isActive: true },
                { name: 'secondaryCountryCode', label: 'Secondary Country Code', type: 'text', required: false, order: 2, width: 'quarter', isActive: true },
                { name: 'secondaryContact', label: 'Secondary Contact', type: 'tel', required: false, order: 3, width: 'half', isActive: true },
                { name: 'emergencyCountryCode', label: 'Emergency Country Code', type: 'text', required: false, order: 4, width: 'quarter', isActive: true },
                { name: 'emergencyContact', label: 'Emergency Contact', type: 'tel', required: false, order: 5, width: 'half', isActive: true },
                { name: 'emergencyContactName', label: 'Emergency Contact Name', type: 'text', required: false, order: 6, width: 'half', isActive: true },
                { name: 'email', label: 'Personal Email ID', type: 'email', required: false, order: 7, width: 'half', isActive: true },
                { name: 'alternativeEmail', label: 'Alternative Email ID', type: 'email', required: false, order: 8, width: 'half', isActive: true },
                { name: 'mobileNumber', label: 'Mobile Number', type: 'tel', required: false, order: 9, width: 'half', isActive: true }
            ]
        },
        {
            id: 'address-info',
            title: 'Communication Details',
            description: 'Present, permanent, and Aadhaar addresses',
            order: 2,
            isActive: true,
            isCollapsible: true,
            fields: [
                { name: 'presentAddress.line1', label: 'Present Address Line 1', type: 'text', required: false, order: 0, width: 'full', isActive: true },
                { name: 'presentAddress.line2', label: 'Present Address Line 2', type: 'text', required: false, order: 1, width: 'full', isActive: true },
                { name: 'presentAddress.district', label: 'City', type: 'text', required: false, order: 2, width: 'third', isActive: true },
                { name: 'presentAddress.state', label: 'State/Province/Region', type: 'text', required: false, order: 3, width: 'third', isActive: true },
                { name: 'presentAddress.pincode', label: 'ZIP/Postal Code', type: 'text', required: false, order: 4, width: 'third', isActive: true },
                { name: 'presentAddress.country', label: 'Country', type: 'text', required: false, order: 5, width: 'full', isActive: true },
                { name: 'permanentAddress.line1', label: 'Permanent Address Line 1', type: 'text', required: false, order: 6, width: 'full', isActive: true },
                { name: 'permanentAddress.line2', label: 'Permanent Address Line 2', type: 'text', required: false, order: 7, width: 'full', isActive: true },
                { name: 'permanentAddress.district', label: 'Permanent City', type: 'text', required: false, order: 8, width: 'third', isActive: true },
                { name: 'permanentAddress.state', label: 'Permanent State/Province/Region', type: 'text', required: false, order: 9, width: 'third', isActive: true },
                { name: 'permanentAddress.pincode', label: 'Permanent ZIP/Postal Code', type: 'text', required: false, order: 10, width: 'third', isActive: true },
                { name: 'permanentAddress.country', label: 'Permanent Country', type: 'text', required: false, order: 11, width: 'full', isActive: true },
                { name: 'aadhaarAddressOption', label: 'Aadhaar Address Option', type: 'radio', required: false, options: ['present', 'permanent'], order: 12, width: 'full', isActive: true },
                { name: 'aadhaarAddress.line1', label: 'Aadhaar Address Line 1', type: 'text', required: false, order: 13, width: 'full', isActive: true },
                { name: 'aadhaarAddress.line2', label: 'Aadhaar Address Line 2', type: 'text', required: false, order: 14, width: 'full', isActive: true },
                { name: 'aadhaarAddress.district', label: 'Aadhaar City', type: 'text', required: false, order: 15, width: 'third', isActive: true },
                { name: 'aadhaarAddress.state', label: 'Aadhaar State/Province/Region', type: 'text', required: false, order: 16, width: 'third', isActive: true },
                { name: 'aadhaarAddress.pincode', label: 'Aadhaar ZIP/Postal Code', type: 'text', required: false, order: 17, width: 'third', isActive: true },
                { name: 'aadhaarAddress.country', label: 'Aadhaar Country', type: 'text', required: false, order: 18, width: 'full', isActive: true }
            ]
        },
        {
            id: 'family-details',
            title: 'Family Details',
            description: 'Family members information',
            order: 3,
            isActive: true,
            isCollapsible: true,
            fields: [
                { name: 'name', label: 'Name', type: 'text', required: false, order: 0, width: 'third', isActive: true },
                { name: 'relation', label: 'Relationship', type: 'select', required: false, options: ['Father', 'Mother', 'Spouse', 'Other'], order: 1, width: 'third', isActive: true },
                { name: 'dob', label: 'DOB', type: 'date', required: false, order: 2, width: 'third', isActive: true },
                { name: 'selectRelationship', label: 'Select Relationship', type: 'text', required: false, order: 3, width: 'full', isActive: true, placeholder: 'Select Relationship' }
            ]
        },
        {
            id: 'employment-info',
            title: 'Employment Information',
            description: 'Job details, role, and work information',
            order: 4,
            isActive: true,
            isCollapsible: true,
            fields: [
                { name: 'employeeId', label: 'Employee ID', type: 'text', required: true, order: 0, width: 'half', isActive: true },
                { name: 'officialEmail', label: 'Official Email ID', type: 'email', required: true, helpText: 'This email will be used for login and all system notifications', order: 1, width: 'full', isActive: true },
                { name: 'businessUnitHR', label: 'Department/Business Unit', type: 'select', required: false, options: ['BU1', 'BU2', 'BU3'], order: 2, width: 'half', isActive: true },
                { name: 'designation', label: 'Designation', type: 'text', required: false, order: 3, width: 'half', isActive: true },
                { name: 'role', label: 'Role', type: 'select', required: true, options: ['admin', 'c-suite', 'hr', 'manager', 'supermanager', 'tl', 'employee', 'client'], order: 4, width: 'half', isActive: true },
                { name: 'employeeStatus', label: 'Employee Status', type: 'select', required: true, options: ['Active', 'Inactive'], order: 5, width: 'half', isActive: true },
                { name: 'joiningDate', label: 'Joining Date', type: 'date', required: false, order: 6, width: 'half', isActive: true },
                { name: 'probationPeriod', label: 'Probation Period (days)', type: 'number', required: false, order: 7, width: 'half', isActive: true },
                { name: 'costCenter', label: 'Cost Center', type: 'text', required: false, order: 8, width: 'half', isActive: true },
                { name: 'department', label: 'Department', type: 'text', required: false, order: 9, width: 'half', isActive: true },
                { name: 'cid', label: 'CID', type: 'text', required: false, order: 10, width: 'half', isActive: true },
                { name: 'managerId', label: 'Manager ID', type: 'text', required: false, order: 11, width: 'half', isActive: true },
                { name: 'superManagerId', label: 'Super Manager ID', type: 'text', required: false, order: 12, width: 'half', isActive: true },
                { name: 'noticePeriod', label: 'Notice Period', type: 'text', required: false, order: 13, width: 'half', isActive: true },
                { name: 'division', label: 'Division', type: 'text', required: false, order: 14, width: 'half', isActive: true },
                { name: 'grade', label: 'Grade', type: 'text', required: false, order: 15, width: 'half', isActive: true },
                { name: 'location', label: 'Location', type: 'text', required: false, order: 16, width: 'half', isActive: true },
                { name: 'employeeNumberSeries', label: 'Employee Number Series', type: 'text', required: false, order: 17, width: 'half', isActive: true }
            ]
        },
        {
            id: 'education-details',
            title: 'Education Details',
            description: 'Academic qualifications and certifications',
            order: 5,
            isActive: true,
            isCollapsible: true,
            fields: [
                { name: 'headingQualifications', label: 'Qualifications', type: 'text', required: false, order: 0, width: 'full', isActive: true },
                { name: 'institute', label: 'Institute Name', type: 'text', required: false, order: 1, width: 'half', isActive: true, placeholder: 'Enter Institute Name' },
                { name: 'degree', label: 'Degree / Qualification', type: 'select', required: false, options: ['SSC/CBSE/ICSE', 'Intermediate', 'Diploma', 'UG', 'PG', 'PHD', 'Other'], order: 2, width: 'half', isActive: true },
                { name: 'selectDegree', label: 'Select Degree', type: 'text', required: false, order: 3, width: 'full', isActive: true, placeholder: 'Select Degree' },
                { name: 'percentage', label: 'Percentage / CGPA', type: 'text', required: false, order: 4, width: 'third', isActive: true, placeholder: 'e.g. 85% or 8.5' },
                { name: 'fromDate', label: 'From', type: 'date', required: false, order: 5, width: 'third', isActive: true },
                { name: 'toDate', label: 'To', type: 'date', required: false, order: 6, width: 'third', isActive: true },
                { name: 'attachment', label: 'Attachment', type: 'file', required: false, order: 7, width: 'full', helpText: 'PDF only (.pdf) – Please attach only PDF files here.', isActive: true }
            ]
        },
        {
            id: 'languages',
            title: 'Languages Known',
            description: 'Languages and proficiency levels',
            order: 6,
            isActive: true,
            isCollapsible: true,
            fields: [
                { name: 'name', label: 'Language', type: 'text', required: false, order: 0, width: 'half', isActive: true, placeholder: 'Language (e.g. English)' },
                { name: 'read', label: 'Read', type: 'checkbox', required: false, order: 1, width: 'third', isActive: true },
                { name: 'write', label: 'Write', type: 'checkbox', required: false, order: 2, width: 'third', isActive: true },
                { name: 'speak', label: 'Speak', type: 'checkbox', required: false, order: 3, width: 'third', isActive: true }
            ]
        },
        {
            id: 'experience-details',
            title: 'Experience Details',
            description: 'Previous work experience',
            order: 7,
            isActive: true,
            isCollapsible: true,
            fields: [
                { name: 'organization', label: 'Organization', type: 'text', required: false, order: 0, width: 'half', isActive: true, placeholder: 'Enter Organization Name' },
                { name: 'designation', label: 'Position / Designation', type: 'text', required: false, order: 1, width: 'half', isActive: true, placeholder: 'Enter Designation' },
                { name: 'fromDate', label: 'From', type: 'date', required: false, order: 2, width: 'half', isActive: true },
                { name: 'toDate', label: 'To', type: 'date', required: false, order: 3, width: 'half', isActive: true },
                { name: 'attachments', label: 'Attachments', type: 'file', required: false, order: 4, width: 'full', helpText: 'PDF only. You can add multiple attachments (e.g. experience letter, payslips).', isActive: true }
            ]
        },
        {
            id: 'bank-details',
            title: 'Bank Details',
            description: 'Banking information for salary processing',
            order: 8,
            isActive: true,
            isCollapsible: true,
            fields: [
                { name: 'accountNumber', label: 'Account Number', type: 'text', required: false, order: 0, width: 'half', isActive: true },
                { name: 'confirmAccountNumber', label: 'Confirm Account Number', type: 'text', required: false, order: 1, width: 'half', isActive: true },
                { name: 'bankName', label: 'Bank Name', type: 'text', required: false, order: 2, width: 'half', isActive: true },
                { name: 'ifscCode', label: 'IFSC Code', type: 'text', required: false, order: 3, width: 'half', isActive: true },
                { name: 'accountType', label: 'Account Type', type: 'select', required: false, options: ['Savings', 'Current'], order: 4, width: 'half', isActive: true },
                { name: 'branchName', label: 'Branch Name', type: 'text', required: false, order: 5, width: 'half', isActive: true },
                { name: 'salaryPaymentMode', label: 'Salary Payment Mode', type: 'select', required: false, options: ['NEFT', 'RTGS', 'IMPS', 'Cheque'], order: 6, width: 'half', isActive: true },
                { name: 'nameAsPerBankRecords', label: 'Name as per Bank Records', type: 'text', required: false, order: 7, width: 'half', isActive: true },
                { name: 'iban', label: 'IBAN', type: 'text', required: false, order: 8, width: 'half', isActive: true },
                { name: 'swiftCode', label: 'Swift Code', type: 'text', required: false, order: 9, width: 'half', isActive: true },
                { name: 'bankBranch', label: 'Bank Branch', type: 'text', required: false, order: 10, width: 'half', isActive: true }
            ]
        },
        {
            id: 'documents',
            title: 'Documents',
            description: 'Identity and verification documents',
            order: 9,
            isActive: true,
            isCollapsible: true,
            fields: [
                { name: 'documentType', label: 'Document Type', type: 'select', required: true, options: ['Aadhar Card', 'PAN Card', 'Passport', 'Driving License', 'Voter ID', 'Other'], order: 0, width: 'third', isActive: true },
                { name: 'documentNumber', label: 'Document Number', type: 'text', required: true, order: 1, width: 'third', isActive: true, placeholder: 'Enter Number' },
                { name: 'attachment', label: 'Attachment', type: 'file', required: false, order: 2, width: 'third', helpText: 'PDF only (.pdf) – Please attach only PDF files here.', isActive: true }
            ]
        },
        {
            id: 'pf-details',
            title: 'PF Details',
            description: 'Provident Fund information',
            order: 10,
            isActive: true,
            isCollapsible: true,
            fields: [
                { name: 'isEligibleForPF', label: 'Is Employee Eligible for PF', type: 'checkbox', required: false, order: 0, width: 'half', isActive: true },
                { name: 'pfNumber', label: 'PF Number', type: 'text', required: false, order: 1, width: 'half', isActive: true },
                { name: 'pfScheme', label: 'PF Scheme', type: 'text', required: false, order: 2, width: 'half', isActive: true },
                { name: 'pfJoiningDate', label: 'PF Joining Date', type: 'date', required: false, order: 3, width: 'half', isActive: true },
                { name: 'eligibleForExcessEPFContribution', label: 'Eligible for Excess EPF Contribution', type: 'checkbox', required: false, order: 4, width: 'half', isActive: true },
                { name: 'isEligibleForExcessEPSContribution', label: 'Is Employee Eligible for Excess EPS Contribution', type: 'checkbox', required: false, order: 5, width: 'half', isActive: true },
                { name: 'isExistingMemberOfPF', label: 'Is Existing Member of PF', type: 'checkbox', required: false, order: 6, width: 'half', isActive: true },
                { name: 'salary', label: 'Salary', type: 'number', required: false, order: 7, width: 'half', isActive: true },
                { name: 'universalAccountNumber', label: 'Universal Account Number', type: 'text', required: false, order: 8, width: 'half', isActive: true }
            ]
        },
        {
            id: 'esi-details',
            title: 'ESI Details',
            description: 'Employee State Insurance information',
            order: 11,
            isActive: true,
            isCollapsible: true,
            fields: [
                { name: 'isEligibleForESI', label: 'Is Employee Eligible for ESI', type: 'checkbox', required: false, order: 0, width: 'half', isActive: true },
                { name: 'esiNumber', label: 'ESI Number', type: 'text', required: false, order: 1, width: 'half', isActive: true },
                { name: 'isCoveredUnderLWF', label: 'Is Covered Under LWF', type: 'checkbox', required: false, order: 2, width: 'half', isActive: true }
            ]
        },
        {
            id: 'other-info',
            title: 'Account Setup',
            description: 'Login credentials and access',
            order: 12,
            isActive: true,
            isCollapsible: true,
            fields: [
                { name: 'password', label: 'Password', type: 'text', required: false, helpText: 'Leave blank to keep existing password', order: 0, width: 'full', isActive: true }
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
            console.log('   Updating existing configuration with all fields...')
            
            // Update existing config - merge sections and fields
            existing.formName = employeeFormConfig.formName
            existing.description = employeeFormConfig.description
            existing.version = (existing.version || 1) + 1
            existing.isActive = employeeFormConfig.isActive
            
            // Replace all sections with the new comprehensive config
            // This ensures all fields are present and there are no duplicates
            existing.sections = employeeFormConfig.sections
            await existing.save()
            
            console.log('✅ Employee form configuration updated successfully!')
            console.log(`   - Form Type: ${existing.formType}`)
            console.log(`   - Sections: ${existing.sections.length}`)
            console.log(`   - Total Fields: ${existing.sections.reduce((sum, s) => sum + (s.fields?.length || 0), 0)}`)
            console.log(`   - Version: ${existing.version}`)
            console.log('\n📋 Sections:')
            existing.sections.forEach(section => {
                console.log(`   - ${section.title} (${section.fields?.length || 0} fields)`)
            })
        } else {
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
        }

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
