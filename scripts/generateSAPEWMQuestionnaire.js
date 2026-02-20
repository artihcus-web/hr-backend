/**
 * Generates SAP_EWM_Questionnaire.xlsx in the expected assessment upload format.
 * Run: node scripts/generateSAPEWMQuestionnaire.js
 */
import XLSX from 'xlsx'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const rows = [
  ['SECTION', 'TYPE', 'QUESTION', 'OPTION_A', 'OPTION_B', 'OPTION_C', 'OPTION_D', 'CORRECT_ANSWER']
]

// Section 1: Multiple Choice (1–46)
const section1 = [
  ['Multiple Choice', 'mcq', 'SAP EWM is primarily used for:', 'Financial Accounting', 'Warehouse Management', 'Sales Order Processing', 'HR Management', 'B'],
  ['Multiple Choice', 'mcq', 'In SAP EWM, the highest organizational unit is:', 'Storage Type', 'Warehouse Number', 'Storage Bin', 'Plant', 'B'],
  ['Multiple Choice', 'mcq', 'A Storage Bin belongs to:', 'Storage Section', 'Storage Type', 'Warehouse Number', 'Activity Area', 'B'],
  ['Multiple Choice', 'mcq', 'Inbound delivery in EWM is created based on:', 'Sales Order', 'Purchase Order', 'Production Order', 'Billing Document', 'B'],
  ['Multiple Choice', 'mcq', 'Outbound delivery is mainly related to:', 'Procurement', 'Shipping goods to customers', 'Physical Inventory', 'Replenishment', 'B'],
  ['Multiple Choice', 'mcq', 'The process of placing goods into warehouse bins is called:', 'Picking', 'Packing', 'Putaway', 'Posting', 'C'],
  ['Multiple Choice', 'mcq', 'Warehouse Tasks (WT) are created for:', 'Invoicing', 'Physical movement of goods', 'Costing', 'Budgeting', 'B'],
  ['Multiple Choice', 'mcq', 'A Handling Unit (HU) represents:', 'Storage Type', 'Packaging Unit', 'Storage Bin', 'Delivery Type', 'B'],
  ['Multiple Choice', 'mcq', 'Which document controls physical movement in EWM?', 'Warehouse Request', 'Warehouse Task', 'Delivery Order', 'Billing Document', 'B'],
  ['Multiple Choice', 'mcq', 'Which integration method connects SAP ERP with EWM?', 'IDoc', 'CIF', 'ALE', 'BAPI', 'B'],
  ['Multiple Choice', 'mcq', 'Deconsolidation is used in:', 'Outbound', 'Inbound', 'Billing', 'Transportation', 'B'],
  ['Multiple Choice', 'mcq', 'Picking process belongs to:', 'Inbound', 'Outbound', 'Internal Posting', 'Counting', 'B'],
  ['Multiple Choice', 'mcq', 'POSC stands for:', 'Process Oriented Storage Control', 'Packing Order Storage Control', 'Process Order Supply Chain', 'Production Oriented Storage Cycle', 'A'],
  ['Multiple Choice', 'mcq', 'LOSC stands for:', 'Layout Oriented Storage Control', 'Logistics Order Storage Cycle', 'Location Oriented Stock Control', 'Level Oriented System Control', 'A'],
  ['Multiple Choice', 'mcq', 'Wave Management is used in:', 'Inbound', 'Outbound', 'Counting', 'Posting Change', 'B'],
  ['Multiple Choice', 'mcq', 'Cross Docking is used to:', 'Store goods', 'Transfer goods directly from GR to GI', 'Delete stock', 'Post inventory differences', 'B'],
  ['Multiple Choice', 'mcq', 'Warehouse Monitor transaction code:', '/SCWM/MON', '/SCWM/DEL', '/SCWM/GR', '/SCWM/ORDIM', 'A'],
  ['Multiple Choice', 'mcq', 'Storage Section is a subdivision of:', 'Storage Bin', 'Warehouse', 'Storage Type', 'Activity Area', 'C'],
  ['Multiple Choice', 'mcq', 'Replenishment ensures:', 'Enough stock in picking area', 'Financial closure', 'PO creation', 'Stock deletion', 'A'],
  ['Multiple Choice', 'mcq', 'Posting Change in EWM is used for:', 'Changing stock type', 'Deleting warehouse', 'Printing labels', 'RF setup', 'A'],
  ['Multiple Choice', 'mcq', 'Yard Management handles:', 'Bin configuration', 'Vehicle and yard activities', 'Finance', 'Counting', 'B'],
  ['Multiple Choice', 'mcq', 'Which document is created first in outbound process?', 'Warehouse Task', 'Outbound Delivery', 'Warehouse Order', 'Billing', 'B'],
  ['Multiple Choice', 'mcq', 'Which document is created to perform stock counting in EWM?', 'Warehouse Task', 'Physical Inventory Document', 'Delivery Order', 'Posting Change', 'B'],
  ['Multiple Choice', 'mcq', 'Which physical inventory procedure allows counting without blocking stock?', 'Continuous Counting', 'Annual Counting', 'Cycle Counting', 'Low Stock Check', 'C'],
  ['Multiple Choice', 'mcq', 'What happens after posting inventory differences?', 'Warehouse is deleted', 'Stock quantity is adjusted', 'Delivery is cancelled', 'HU is removed', 'B'],
  ['Multiple Choice', 'mcq', 'In EWM, inventory counting is performed at which level?', 'Plant', 'Storage Type', 'Storage Bin', 'Company Code', 'C'],
  ['Multiple Choice', 'mcq', 'Which transaction is used to monitor physical inventory documents?', '/SCWM/MON', '/SCWM/PI', '/SCWM/GR', '/SCWM/ORDIM', 'A'],
  ['Multiple Choice', 'mcq', 'Slotting is used to determine:', 'Financial posting', 'Optimal storage location', 'Vendor evaluation', 'Delivery priority', 'B'],
  ['Multiple Choice', 'mcq', 'Slotting considers which of the following parameters?', 'Product dimensions', 'Sales price', 'Vendor name', 'Billing date', 'A'],
  ['Multiple Choice', 'mcq', 'The result of slotting can influence:', 'Storage Type search sequence', 'Payment terms', 'Tax codes', 'Cost center', 'A'],
  ['Multiple Choice', 'mcq', 'In EWM, a Resource represents:', 'Storage Bin', 'Warehouse Worker or Equipment', 'Delivery Document', 'Storage Section', 'B'],
  ['Multiple Choice', 'mcq', 'Resource Management is used to:', 'Assign WTs to warehouse workers', 'Create billing documents', 'Monitor accounting entries', 'Create purchase orders', 'A'],
  ['Multiple Choice', 'mcq', 'Queue determination in EWM is used for:', 'Assigning tasks to resources', 'Posting invoices', 'Creating deliveries', 'Physical counting', 'A'],
  ['Multiple Choice', 'mcq', 'Which object groups Warehouse Tasks for execution?', 'Warehouse Request', 'Warehouse Order', 'Posting Change', 'Handling Unit', 'B'],
  ['Multiple Choice', 'mcq', 'WOCR stands for:', 'Warehouse Order Creation Rules', 'Warehouse Operation Control Rules', 'Work Order Creation Report', 'Warehouse Output Control Rules', 'A'],
  ['Multiple Choice', 'mcq', 'WOCR is used to:', 'Create Purchase Orders', 'Group WTs into WOs', 'Delete warehouse tasks', 'Post goods issue', 'B'],
  ['Multiple Choice', 'mcq', 'WOCR can be based on:', 'Activity Area', 'Storage Type', 'Number of tasks', 'All of the above', 'D'],
  ['Multiple Choice', 'mcq', 'A Handling Unit (HU) can contain:', 'Only one product', 'Multiple products', 'No stock', 'Only one bin', 'B'],
  ['Multiple Choice', 'mcq', 'HU management enables:', 'Tracking packaging materials', 'Creating invoices', 'Financial closing', 'Vendor selection', 'A'],
  ['Multiple Choice', 'mcq', 'Nested HUs mean:', 'HU inside another HU', 'HU without stock', 'Deleted HU', 'Blocked HU', 'A'],
  ['Multiple Choice', 'mcq', 'Batch management allows tracking of:', 'Product by production lot', 'Customer address', 'Storage bin capacity', 'Financial period', 'A'],
  ['Multiple Choice', 'mcq', 'Batch determination in outbound is based on:', 'Strategy type', 'Invoice number', 'Vendor name', 'Warehouse section', 'A'],
  ['Multiple Choice', 'mcq', 'Serial numbers are used to:', 'Track individual items', 'Group deliveries', 'Count bins', 'Create POs', 'A'],
  ['Multiple Choice', 'mcq', 'Serial number capture can happen during:', 'Goods Receipt', 'Goods Issue', 'Both GR and GI', 'Physical inventory only', 'C'],
  ['Multiple Choice', 'mcq', 'Labor Management in EWM is used to measure:', 'Financial profit', 'Warehouse employee performance', 'Vendor rating', 'Tax calculation', 'B'],
  ['Multiple Choice', 'mcq', 'Planned versus actual time comparison is part of:', 'Slotting', 'Yard Management', 'Labor Management', 'Posting Change', 'C']
]

// Section 2: Fill in the Blanks (47–65)
const section2 = [
  ['Fill in the Blanks', 'fill_blanks', 'The smallest unit in warehouse structure is _____.', '', '', '', '', 'Storage Bin'],
  ['Fill in the Blanks', 'fill_blanks', 'Goods Receipt is abbreviated as _____.', '', '', '', '', 'GR'],
  ['Fill in the Blanks', 'fill_blanks', 'CIF stands for _____ Integration Framework.', '', '', '', '', 'Core'],
  ['Fill in the Blanks', 'fill_blanks', 'POSC is used to define _____ steps in putaway.', '', '', '', '', 'Multiple'],
  ['Fill in the Blanks', 'fill_blanks', 'LOSC controls stock movement based on warehouse _____.', '', '', '', '', 'Layout'],
  ['Fill in the Blanks', 'fill_blanks', 'RF devices are used for real-time warehouse _____.', '', '', '', '', 'Operations'],
  ['Fill in the Blanks', 'fill_blanks', 'Physical inventory document is used for stock _____.', '', '', '', '', 'Counting'],
  ['Fill in the Blanks', 'fill_blanks', 'Activity Areas are assigned to _____ Types.', '', '', '', '', 'Storage'],
  ['Fill in the Blanks', 'fill_blanks', 'Slotting determines optimal _____ for products.', '', '', '', '', 'Storage Type'],
  ['Fill in the Blanks', 'fill_blanks', 'Handling Unit contains packaging _____.', '', '', '', '', 'Information'],
  ['Fill in the Blanks', 'fill_blanks', 'Wave Management groups multiple outbound _____.', '', '', '', '', 'Deliveries'],
  ['Fill in the Blanks', 'fill_blanks', 'Posting Change can change stock from unrestricted to _____.', '', '', '', '', 'Blocked'],
  ['Fill in the Blanks', 'fill_blanks', 'Replenishment ensures picking bin stock does not go below _____ level.', '', '', '', '', 'Minimum'],
  ['Fill in the Blanks', 'fill_blanks', 'Yard is divided into yard _____.', '', '', '', '', 'Bins'],
  ['Fill in the Blanks', 'fill_blanks', 'Resource Management assigns _____ to warehouse tasks.', '', '', '', '', 'Resources'],
  ['Fill in the Blanks', 'fill_blanks', 'Deconsolidation is part of inbound _____ process.', '', '', '', '', 'Delivery'],
  ['Fill in the Blanks', 'fill_blanks', 'WOCR stands for Warehouse Order Creation _____.', '', '', '', '', 'Rules'],
  ['Fill in the Blanks', 'fill_blanks', 'EWM can be deployed as Embedded or _____ system.', '', '', '', '', 'Decentralized'],
  ['Fill in the Blanks', 'fill_blanks', 'Labor Management tracks warehouse _____.', '', '', '', '', 'Performance']
]

// Section 3: Yes / No (66–90)
const section3 = [
  ['Yes or No', 'yes_no', 'EWM supports batch management.', 'Yes', 'No', '', '', 'Yes'],
  ['Yes or No', 'yes_no', 'Storage Bin is higher than Storage Type.', 'Yes', 'No', '', '', 'No'],
  ['Yes or No', 'yes_no', 'Warehouse Task is optional for stock movement.', 'Yes', 'No', '', '', 'No'],
  ['Yes or No', 'yes_no', 'EWM supports serial number management.', 'Yes', 'No', '', '', 'Yes'],
  ['Yes or No', 'yes_no', 'Cross Docking eliminates storage step.', 'Yes', 'No', '', '', 'Yes'],
  ['Yes or No', 'yes_no', 'Wave Management is used in inbound process only.', 'Yes', 'No', '', '', 'No'],
  ['Yes or No', 'yes_no', 'Physical inventory can be done in EWM.', 'Yes', 'No', '', '', 'Yes'],
  ['Yes or No', 'yes_no', 'CIF is required for ERP integration in decentralized EWM.', 'Yes', 'No', '', '', 'Yes'],
  ['Yes or No', 'yes_no', 'POSC is only for outbound process.', 'Yes', 'No', '', '', 'No'],
  ['Yes or No', 'yes_no', 'Yard Management is mandatory in all warehouses.', 'Yes', 'No', '', '', 'No'],
  ['Yes or No', 'yes_no', 'RF framework is used for mobile execution.', 'Yes', 'No', '', '', 'Yes'],
  ['Yes or No', 'yes_no', 'Posting change requires physical stock movement always.', 'Yes', 'No', '', '', 'No'],
  ['Yes or No', 'yes_no', 'Replenishment is required in fixed bin concept.', 'Yes', 'No', '', '', 'Yes'],
  ['Yes or No', 'yes_no', 'Activity Areas are relevant for picking.', 'Yes', 'No', '', '', 'Yes'],
  ['Yes or No', 'yes_no', 'Warehouse Monitor helps in operational monitoring.', 'Yes', 'No', '', '', 'Yes'],
  ['Yes or No', 'yes_no', 'Embedded EWM runs inside S/4HANA system.', 'Yes', 'No', '', '', 'Yes'],
  ['Yes or No', 'yes_no', 'HU can exist without stock.', 'Yes', 'No', '', '', 'Yes'],
  ['Yes or No', 'yes_no', 'Deconsolidation is an outbound process.', 'Yes', 'No', '', '', 'No'],
  ['Yes or No', 'yes_no', 'Warehouse Order groups multiple WTs.', 'Yes', 'No', '', '', 'Yes'],
  ['Yes or No', 'yes_no', 'EWM supports quality inspection integration.', 'Yes', 'No', '', '', 'Yes'],
  ['Yes or No', 'yes_no', 'Slotting is mandatory in EWM.', 'Yes', 'No', '', '', 'No'],
  ['Yes or No', 'yes_no', 'Storage Section is mandatory in warehouse structure.', 'Yes', 'No', '', '', 'No'],
  ['Yes or No', 'yes_no', 'Labor Management measures KPIs.', 'Yes', 'No', '', '', 'Yes'],
  ['Yes or No', 'yes_no', 'Cross docking reduces handling steps.', 'Yes', 'No', '', '', 'Yes'],
  ['Yes or No', 'yes_no', 'SAP WM and SAP EWM are identical systems.', 'Yes', 'No', '', '', 'No']
]

;[...section1, ...section2, ...section3].forEach(r => rows.push(r))

const ws = XLSX.utils.aoa_to_sheet(rows)
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, 'SAP EWM Questionnaire')
const outPath = join(__dirname, '..', 'SAP_EWM_Questionnaire.xlsx')
const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
writeFileSync(outPath, buf)
console.log('Created:', outPath)
console.log('Total questions:', rows.length - 1)
