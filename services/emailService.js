import nodemailer from 'nodemailer'

// Base URL for frontend (used in email links)
// Configure FRONTEND_URL in .env (e.g. https://hr.artihcus.com)
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://hr.artihcus.com'

// Create transporter for HR Portal emails
// Supports both SendGrid (recommended) and Gmail SMTP
const createTransporter = () => {
  console.log('📧 [EMAIL SERVICE] Creating email transporter...')

  // Check if SendGrid API key is configured (preferred for better deliverability)
  const sendGridApiKey = process.env.SENDGRID_API_KEY

  if (sendGridApiKey) {
    console.log('📧 [EMAIL SERVICE] Using SendGrid (better deliverability)')
    console.log('📧 [EMAIL SERVICE] SendGrid API Key:', sendGridApiKey ? '***SET***' : 'NOT SET')

    // SendGrid configuration for better inbox delivery
    const transporter = nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      secure: false,
      auth: {
        user: 'apikey', // SendGrid requires 'apikey' as username
        pass: sendGridApiKey, // Your SendGrid API key
      },
      tls: {
        rejectUnauthorized: false
      }
    })

    console.log('✅ [EMAIL SERVICE] SendGrid transporter created successfully')
    return transporter
  }

  // Fallback to Gmail SMTP if SendGrid not configured
  console.log('📧 [EMAIL SERVICE] SendGrid not configured, using Gmail SMTP')
  const emailUser = process.env.EMAIL_USER || 'Artihcusweb@gmail.com'
  const emailPassword = process.env.EMAIL_PASSWORD || 'zhiu altz yojv nesc'

  console.log('📧 [EMAIL SERVICE] Email User:', emailUser ? `${emailUser.substring(0, 5)}***` : 'NOT SET')
  console.log('📧 [EMAIL SERVICE] Email Password:', emailPassword ? '***SET***' : 'NOT SET')

  if (!emailUser || !emailPassword) {
    console.error('❌ [EMAIL SERVICE] Email credentials not configured!')
    throw new Error('Email credentials not configured. Please set SENDGRID_API_KEY or EMAIL_USER and EMAIL_PASSWORD environment variables.')
  }

  // Use Gmail service configuration
  // Use Gmail service configuration with explicit port 587 to avoid EACCES issues
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // use false for STARTTLS; true for 465
    auth: {
      user: emailUser,
      pass: emailPassword,
    },
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  })

  console.log('✅ [EMAIL SERVICE] Gmail transporter created successfully (Port 587)')
  console.log('⚠️  [EMAIL SERVICE] Note: Gmail SMTP may go to junk in corporate email systems')
  console.log('📧 [EMAIL SERVICE] Consider using SendGrid for better deliverability')
  return transporter
}

// Timesheet submission notification email template
const createTimesheetNotificationTemplate = (data) => {
  const { employeeName, employeeId, projectName, month, entries, weekStartDate } = data

  const approvalsUrl = `${FRONTEND_URL}/approvals/timesheet`

  // Helper to parse duration string to minutes
  const parseDuration = (str) => {
    if (!str || str === 'WO' || str === 'FL') return 0
    let match = str.match(/(\d+)\s?:\s?(\d+)/)
    if (!match) match = str.match(/(\d+)h\s?(\d+)m?/)
    if (match) return parseInt(match[1]) * 60 + parseInt(match[2] || 0)
    return 0
  }

  // Helper to format minutes to duration string
  const formatDuration = (minutes) => {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return `${h} : ${String(m).padStart(2, '0')}`
  }

  // Group entries by charge code/project
  const groupedRows = {}
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  
  if (entries && entries.length > 0) {
    entries.forEach(entry => {
      const key = `${entry.projectId || 'unknown'}-${entry.chargeCode || 'General'}`
      if (!groupedRows[key]) {
        groupedRows[key] = {
          chargeCode: entry.chargeCode || 'General',
          dailyHours: Array(7).fill('0 : 00'),
          totalHours: 0
        }
      }
      
      // Find day index (Mon=0, Tue=1, etc.)
      const entryDate = new Date(entry.date)
      const dayIndex = (entryDate.getDay() + 6) % 7 // Convert Sun=0 to Mon=0
      
      if (dayIndex >= 0 && dayIndex < 7) {
        groupedRows[key].dailyHours[dayIndex] = entry.hoursCompleted || entry.totalDailyHours || '0 : 00'
      }
    })

    // Calculate row totals
    Object.keys(groupedRows).forEach(key => {
      const row = groupedRows[key]
      const totalMins = row.dailyHours.reduce((acc, val) => acc + parseDuration(val), 0)
      row.totalHours = formatDuration(totalMins)
    })
  }

  // Calculate daily totals
  const dailyTotals = Array(7).fill(0)
  Object.values(groupedRows).forEach(row => {
    row.dailyHours.forEach((hours, idx) => {
      dailyTotals[idx] += parseDuration(hours)
    })
  })

  // Get week start date
  let weekStart = null
  if (weekStartDate) {
    weekStart = new Date(weekStartDate)
  } else if (entries && entries.length > 0) {
    // Find earliest date and adjust to Monday
    const dates = entries.map(e => new Date(e.date)).filter(d => !isNaN(d.getTime()))
    if (dates.length > 0) {
      const earliest = new Date(Math.min(...dates))
      const day = earliest.getDay()
      const diff = earliest.getDate() - day + (day === 0 ? -6 : 1)
      weekStart = new Date(earliest)
      weekStart.setDate(diff)
    }
  }

  // Get week days
  const weekDays = []
  if (weekStart) {
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart)
      d.setDate(weekStart.getDate() + i)
      weekDays.push({
        date: d.getDate().toString().padStart(2, '0'),
        name: dayNames[i]
      })
    }
  } else {
    // Fallback: use day names only
    for (let i = 0; i < 7; i++) {
      weekDays.push({ date: '', name: dayNames[i] })
    }
  }

  // Build table rows
  const rowsHtml = Object.values(groupedRows).map(row => {
    const cellsHtml = row.dailyHours.map(hours => {
      const display = hours === 'WO' ? 'WO' : hours === 'FL' ? 'FL' : hours
      return `<td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${display}</td>`
    }).join('')
    
    return `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; width: 200px;">${row.chargeCode}</td>
        ${cellsHtml}
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: bold; background-color: #f9fafb;">${row.totalHours}</td>
      </tr>
    `
  }).join('')

  // Daily totals row
  const dailyTotalsHtml = dailyTotals.map(total => {
    const display = formatDuration(total)
    return `<td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: bold; background-color: #f3f4f6;">${display}</td>`
  }).join('')
  
  const grandTotalMins = dailyTotals.reduce((acc, val) => acc + val, 0)
  const grandTotalHtml = `<td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: bold; background-color: #e5e7eb;">${formatDuration(grandTotalMins)}</td>`

  const tableHtml = entries && entries.length > 0
    ? `
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 12px;">
        <thead>
          <tr>
            <th style="padding: 10px; border: 1px solid #ddd; background-color: #4f46e5; color: white; text-align: left; width: 200px;">Project Code</th>
            ${weekDays.map(day => `<th style="padding: 10px; border: 1px solid #ddd; background-color: #4f46e5; color: white; text-align: center;">${day.date} ${day.name}</th>`).join('')}
            <th style="padding: 10px; border: 1px solid #ddd; background-color: #4f46e5; color: white; text-align: center;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #f3f4f6;">Daily Total</td>
            ${dailyTotalsHtml}
            ${grandTotalHtml}
          </tr>
        </tfoot>
      </table>
    `
    : '<p style="padding: 20px; text-align: center; color: #666;">No entries found.</p>'

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Timesheet Submission Notification</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f9f9f9;
            }
            .email-container {
                background-color: #ffffff;
                padding: 30px;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
                padding-bottom: 20px;
                border-bottom: 2px solid #4f46e5;
            }
            .header h1 {
                color: #4f46e5;
                margin: 0;
            }
            .content {
                margin-bottom: 25px;
            }
            .info-box {
                background-color: #f8f9fa;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
                border-left: 4px solid #4f46e5;
            }
            .info-box p {
                margin: 8px 0;
            }
            .info-label {
                font-weight: bold;
                color: #555;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
                font-size: 12px;
            }
            th {
                background-color: #4f46e5;
                color: white;
                padding: 10px;
                text-align: left;
                border: 1px solid #ddd;
            }
            td {
                padding: 8px;
                border: 1px solid #ddd;
            }
            .footer {
                text-align: center;
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #eee;
                color: #666;
                font-size: 14px;
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="header">
                <h1>Timesheet Review Required</h1>
            </div>
            
            <div class="content">
                <p>Hello,</p>
                
                <p>A new timesheet has been submitted and requires your review.</p>
                
                <div class="info-box">
                    <p><span class="info-label">Employee Name:</span> ${employeeName}</p>
                    <p><span class="info-label">Employee ID:</span> ${employeeId}</p>
                    <p><span class="info-label">Project:</span> ${projectName || 'N/A'}</p>
                    <p><span class="info-label">Month:</span> ${month}</p>
                    <p><span class="info-label">Submitted:</span> ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
                
                <h3 style="color: #4f46e5; margin-top: 30px;">Timesheet Details:</h3>
                
                ${tableHtml}
                
                <p>Please review the timesheet at your earliest convenience.</p>
                
                <p style="margin-top: 10px;">You can open the approvals page directly using the button below:</p>
                
                <p style="margin-top: 15px; text-align: center;">
                  <a 
                    href="${approvalsUrl}" 
                    style="display: inline-block; padding: 10px 22px; background-color: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 999px; font-weight: 600; font-size: 13px; letter-spacing: 0.03em;"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open Timesheet Approvals
                  </a>
                </p>
                
                <p style="margin-top: 20px; padding: 15px; background-color: #f0f7ff; border-left: 4px solid #4f46e5; border-radius: 4px;">
                    <strong>Note:</strong> If this email appears in your Junk/Spam folder, please mark it as "Not Junk" to ensure you receive future notifications.
                </p>
                
                <p style="margin-top: 20px;">Thank you.</p>
            </div>
            
            <div class="footer">
                <p><strong>Best regards,</strong><br>
                HR Portal Team</p>
                <p style="margin-top: 15px; font-size: 12px; color: #999;">
                    This is an automated notification from HR Portal.<br>
                    If you no longer wish to receive these emails, please contact your HR administrator.
                </p>
            </div>
        </div>
    </body>
    </html>
  `
}

// Send timesheet submission notification to project manager
export const sendTimesheetNotificationEmail = async (data) => {
  console.log('📧 [EMAIL SERVICE] ==========================================')
  console.log('📧 [EMAIL SERVICE] Starting email send process...')
  console.log('📧 [EMAIL SERVICE] Recipient:', data.managerEmail)
  console.log('📧 [EMAIL SERVICE] Employee:', data.employeeName, `(${data.employeeId})`)
  console.log('📧 [EMAIL SERVICE] Project:', data.projectName)
  console.log('📧 [EMAIL SERVICE] Month:', data.month)
  console.log('📧 [EMAIL SERVICE] Entries count:', data.entries?.length || 0)

  try {
    console.log('📧 [EMAIL SERVICE] Creating transporter...')
    const transporter = createTransporter()

    // Determine sender email based on service used
    const sendGridApiKey = process.env.SENDGRID_API_KEY
    const emailUser = sendGridApiKey
      ? (process.env.SENDGRID_FROM_EMAIL || 'noreply@artihcus.com') // SendGrid sender
      : (process.env.EMAIL_USER || 'Artihcusweb@gmail.com') // Gmail sender

    console.log('📧 [EMAIL SERVICE] Using sender:', sendGridApiKey ? 'SendGrid' : 'Gmail')
    console.log('📧 [EMAIL SERVICE] From email:', emailUser)

    console.log('📧 [EMAIL SERVICE] Preparing email template...')
    const emailHtml = createTimesheetNotificationTemplate(data)
    console.log('📧 [EMAIL SERVICE] Email template created, length:', emailHtml.length)

    // Create plain text version for better deliverability
    const approvalsUrl = `${FRONTEND_URL}/approvals/timesheet`
    const textVersion = `
Timesheet Review Required

Hello,

A new timesheet has been submitted and requires your review.

Employee Name: ${data.employeeName}
Employee ID: ${data.employeeId}
Project: ${data.projectName || 'N/A'}
Month: ${data.month}
Submitted Date: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}

Timesheet Details:
${data.entries && data.entries.length > 0
        ? data.entries.map((entry, idx) => `
Entry ${idx + 1}:
  Date: ${entry.date || '-'}
  Day: ${entry.day || '-'}
  Shift: ${entry.shift || '-'}

  Hours Completed: ${entry.hoursCompleted || 0}
  Overtime: ${entry.overtime || 0}
  Total Hours: ${entry.totalDailyHours || 0}
`).join('\n')
        : 'No entries'
      }

Please review the timesheet and take appropriate action.

You can open the approvals page directly here:
${approvalsUrl}

Note: If this email appears in your Junk/Spam folder, please mark it as "Not Junk" to ensure you receive future notifications.

Best regards,
HR Portal Team
    `.trim()

    // Configure email options
    const mailOptions = {
      from: `HR Portal <${emailUser}>`,
      replyTo: emailUser,
      to: data.managerEmail,
      subject: `Timesheet Review Required - ${data.employeeName} - ${data.month}`,
      html: emailHtml,
      text: textVersion,
      // Clean headers for better deliverability
      headers: {
        'MIME-Version': '1.0',
        'Content-Type': 'text/html; charset=UTF-8',
        'Date': new Date().toUTCString(),
        'Message-ID': `<${Date.now()}-${Math.random().toString(36).substr(2, 9)}@${emailUser.split('@')[1]}>`,
      },
    }

    if (sendGridApiKey) {
      console.log('📧 [EMAIL SERVICE] Using SendGrid - 95%+ inbox delivery rate expected')
    } else {
      console.log('⚠️  [EMAIL SERVICE] Using Gmail SMTP - may go to junk in corporate emails')
      console.log('💡 [EMAIL SERVICE] Tip: Set SENDGRID_API_KEY for better deliverability')
    }

    console.log('📧 [EMAIL SERVICE] Mail options prepared:')
    console.log('📧 [EMAIL SERVICE]   From:', mailOptions.from)
    console.log('📧 [EMAIL SERVICE]   To:', mailOptions.to)
    console.log('📧 [EMAIL SERVICE]   Subject:', mailOptions.subject)

    console.log('📧 [EMAIL SERVICE] Verifying transporter connection...')
    try {
      await transporter.verify()
      console.log('✅ [EMAIL SERVICE] Transporter verified successfully')
    } catch (verifyError) {
      console.error('❌ [EMAIL SERVICE] Transporter verification failed:', verifyError.message)
      console.error('❌ [EMAIL SERVICE] This might indicate firewall/network issues')
      throw verifyError
    }

    console.log('📧 [EMAIL SERVICE] Sending email via transporter...')
    const info = await transporter.sendMail(mailOptions)

    console.log('✅ [EMAIL SERVICE] Email sent successfully!')
    console.log('📧 [EMAIL SERVICE] Message ID:', info.messageId)
    console.log('📧 [EMAIL SERVICE] Response:', info.response)
    console.log('📧 [EMAIL SERVICE] ==========================================')
    return true
  } catch (error) {
    console.error('❌ [EMAIL SERVICE] ==========================================')
    console.error('❌ [EMAIL SERVICE] Error sending timesheet notification email!')
    console.error('❌ [EMAIL SERVICE] Error type:', error.constructor.name)
    console.error('❌ [EMAIL SERVICE] Error message:', error.message)
    console.error('❌ [EMAIL SERVICE] Error code:', error.code)

    // Provide specific troubleshooting for common errors
    if (error.code === 'ESOCKET' || error.code === 'EACCES') {
      console.error('❌ [EMAIL SERVICE] ==========================================')
      console.error('❌ [EMAIL SERVICE] NETWORK/FIREWALL ISSUE DETECTED!')
      console.error('❌ [EMAIL SERVICE] This error indicates a connection permission issue.')
      console.error('❌ [EMAIL SERVICE] Possible solutions:')
      console.error('❌ [EMAIL SERVICE]   1. Check Windows Firewall - allow Node.js/your app')
      console.error('❌ [EMAIL SERVICE]   2. Check antivirus - may be blocking SMTP connections')
      console.error('❌ [EMAIL SERVICE]   3. Try running server as Administrator')
      console.error('❌ [EMAIL SERVICE]   4. Check network/firewall rules for port 587')
      console.error('❌ [EMAIL SERVICE]   5. Verify Gmail account has "Less secure app access" enabled')
      console.error('❌ [EMAIL SERVICE]   6. Check if corporate firewall is blocking SMTP')
      console.error('❌ [EMAIL SERVICE] ==========================================')
    }

    console.error('❌ [EMAIL SERVICE] Error stack:', error.stack)
    console.error('❌ [EMAIL SERVICE] Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)))
    console.error('❌ [EMAIL SERVICE] ==========================================')
    return false
  }
}

// Send password reset email
export const sendPasswordResetEmail = async (email, resetUrl) => {
  console.log('📧 [EMAIL SERVICE] Sending password reset email to:', email)

  try {
    const transporter = createTransporter()

    // Determine sender email based on service used
    const sendGridApiKey = process.env.SENDGRID_API_KEY
    const emailUser = sendGridApiKey
      ? (process.env.SENDGRID_FROM_EMAIL || 'noreply@artihcus.com')
      : (process.env.EMAIL_USER || 'Artihcusweb@gmail.com')

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button { display: inline-block; padding: 10px 20px; background-color: #f97316; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { margin-top: 30px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Password Reset Request</h2>
          <p>You received this email because you (or someone else) requested a password reset for your account.</p>
          <p>Please click on the button below to reset your password:</p>
          <a href="${resetUrl}" class="button">Reset Password</a>
          <p>Or paste this link into your browser:</p>
          <p>${resetUrl}</p>
          <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
          <p>This link will expire in 1 hour.</p>
          <div class="footer">
            <p>Best regards,<br>Artihcus HR Team</p>
          </div>
        </div>
      </body>
      </html>
    `

    const mailOptions = {
      from: `Artihcus Support <${emailUser}>`,
      to: email,
      subject: 'Password Reset Request',
      html: emailHtml
    }

    await transporter.sendMail(mailOptions)
    console.log('✅ [EMAIL SERVICE] Password reset email sent successfully')
    return true
  } catch (error) {
    console.error('❌ [EMAIL SERVICE] Error sending password reset email:', error)
    return false
  }
}

