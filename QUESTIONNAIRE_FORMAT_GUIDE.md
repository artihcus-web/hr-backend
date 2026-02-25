# Assessment questionnaire – Excel format for the team

All assessment questionnaires must be prepared in **Excel (.xlsx)** using this format so they can be uploaded in Admin → Assessments → Modules → Upload Excel.

## Required columns (first row = header)

| Column           | Required | Description |
|------------------|----------|-------------|
| **SECTION**      | Yes      | Section name (e.g. "Multiple Choice", "Fill in the Blanks", "Yes or No") |
| **TYPE**         | Yes      | One of: `mcq`, `yes_no`, `fill_blanks`, `short_answer`, `long_answer` |
| **QUESTION**     | Yes      | Full question text. For fill-in-the-blank use `_____` where the blank is. |
| **OPTION_A**     | MCQ/Yes-No | First option text |
| **OPTION_B**     | MCQ/Yes-No | Second option text |
| **OPTION_C**     | Optional  | Third option (MCQ) |
| **OPTION_D**     | Optional  | Fourth option (MCQ) |
| **CORRECT_ANSWER** | Yes    | See rules below |

## Rules by type

- **mcq** – Four options (A–D). CORRECT_ANSWER = `A`, `B`, `C`, or `D`.
- **yes_no** – Use OPTION_A = "Yes", OPTION_B = "No". CORRECT_ANSWER = `Yes` or `No`.
- **fill_blanks** – In QUESTION use `_____` for the blank. CORRECT_ANSWER = exact text for the blank.
- **short_answer** / **long_answer** – CORRECT_ANSWER = expected answer; use `|` to allow multiple (e.g. `Earth|Mars`).

## Sample file

Use **SAP_EWM_Questionnaire.xlsx** in this folder as the reference. It contains 90 questions in three sections (Multiple Choice, Fill in the Blanks, Yes or No) and can be uploaded for testing.

## Template download

Admins can also download a small template from: **Upload Questions (Excel)** modal → “Download Excel template” link.

