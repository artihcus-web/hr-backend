import XLSX from 'xlsx'

const TYPE_VALUES = ['mcq', 'yes_no', 'fill_blanks', 'short_answer', 'long_answer']
const HEADERS = ['section', 'type', 'question', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer']

function normalizeHeader (cell) {
  if (cell == null) return ''
  return String(cell).trim().toLowerCase().replace(/\s+/g, '_')
}

function findColumnIndex (row, header) {
  for (let c = 0; c < row.length; c++) {
    if (normalizeHeader(row[c]) === header) return c
  }
  return -1
}

/**
 * Parse an Excel buffer (from uploaded .xlsx). Returns { questions, errors }.
 * questions: array of { section, type, text, options, correctAnswer } ready for AssessmentQuestion.
 * errors: array of { row, message } for invalid rows (row is 1-based).
 */
export function parseAssessmentExcel (buffer) {
  const questions = []
  const errors = []
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false })
  const firstSheet = wb.SheetNames[0]
  if (!firstSheet) {
    errors.push({ row: 0, message: 'No sheet found' })
    return { questions, errors }
  }
  const ws = wb.Sheets[firstSheet]
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false })
  if (!data.length) {
    errors.push({ row: 0, message: 'Sheet is empty' })
    return { questions, errors }
  }
  const headerRow = data[0]
  const col = {}
  HEADERS.forEach(h => { col[h] = findColumnIndex(headerRow, h) })
  if (col.section < 0 || col.type < 0 || col.question < 0 || col.correct_answer < 0) {
    errors.push({ row: 1, message: 'Missing required columns: SECTION, TYPE, QUESTION, CORRECT_ANSWER' })
    return { questions, errors }
  }
  for (let r = 1; r < data.length; r++) {
    const row = data[r]
    const section = row[col.section] != null ? String(row[col.section]).trim() : ''
    const typeRaw = row[col.type] != null ? String(row[col.type]).trim().toLowerCase().replace(/\s+/g, '_') : ''
    const question = row[col.question] != null ? String(row[col.question]).trim() : ''
    const correctAnswer = row[col.correct_answer] != null ? String(row[col.correct_answer]).trim() : ''
    if (!section || !question) continue
    if (!typeRaw || !TYPE_VALUES.includes(typeRaw)) {
      errors.push({ row: r + 1, message: `Invalid or missing TYPE. Use one of: ${TYPE_VALUES.join(', ')}` })
      continue
    }
    if (!correctAnswer) {
      errors.push({ row: r + 1, message: 'CORRECT_ANSWER is required' })
      continue
    }
    const options = []
    const labels = ['A', 'B', 'C', 'D']
    for (let i = 0; i < 4; i++) {
      const key = ['option_a', 'option_b', 'option_c', 'option_d'][i]
      const idx = col[key]
      if (idx >= 0 && row[idx] != null && String(row[idx]).trim() !== '') {
        options.push({ label: labels[i], text: String(row[idx]).trim() })
      }
    }
    if ((typeRaw === 'mcq' || typeRaw === 'yes_no') && options.length < 2) {
      errors.push({ row: r + 1, message: 'MCQ and Yes/No require at least OPTION_A and OPTION_B' })
      continue
    }
    let normalizedCorrect = correctAnswer
    if (typeRaw === 'mcq') {
      const upper = correctAnswer.toUpperCase()
      if (['A', 'B', 'C', 'D'].includes(upper)) normalizedCorrect = upper
    }
    if (typeRaw === 'yes_no') {
      const v = correctAnswer.toLowerCase()
      if (v === 'yes' || v === 'no') normalizedCorrect = v === 'yes' ? 'Yes' : 'No'
    }
    questions.push({
      section,
      type: typeRaw,
      text: question,
      options,
      correctAnswer: normalizedCorrect,
      order: r - 1
    })
  }
  return { questions, errors }
}
