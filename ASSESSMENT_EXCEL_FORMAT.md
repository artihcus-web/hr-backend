# Assessment Questions – Excel Upload Format

Use a **single sheet** in an `.xlsx` file. Row 1 must be the header row. Each data row is one question.

## Column headers (exact spelling, any order)

| Column         | Required | Description |
|----------------|----------|-------------|
| **SECTION**    | Yes      | Section/heading name (e.g. "Multiple Choice", "Fill in the Blanks", "Yes or No"). Used to group questions. |
| **TYPE**       | Yes      | One of: `mcq`, `yes_no`, `fill_blanks`, `short_answer`, `long_answer` |
| **QUESTION**   | Yes      | Question text. For fill-in-the-blank use `_____` where the blank is. |
| **OPTION_A**   | For MCQ/Yes-No | First option (e.g. "Yes" or choice A) |
| **OPTION_B**   | For MCQ/Yes-No | Second option (e.g. "No" or choice B) |
| **OPTION_C**   | Optional (MCQ) | Third option |
| **OPTION_D**   | Optional (MCQ) | Fourth option |
| **CORRECT_ANSWER** | Yes  | See below per type. |

## Question types and CORRECT_ANSWER

- **mcq** – CORRECT_ANSWER = `A`, `B`, `C`, or `D` (letter of the correct option).
- **yes_no** – Use OPTION_A = "Yes", OPTION_B = "No". CORRECT_ANSWER = `Yes` or `No` (or `A`/`B`).
- **fill_blanks** – CORRECT_ANSWER = exact text that fills the blank (or multiple blanks separated by `|` if multiple `_____` in QUESTION).
- **short_answer** – CORRECT_ANSWER = expected short answer. For multiple accepted answers, separate with `|`.
- **long_answer** – CORRECT_ANSWER = expected answer or key points (manual grading); can use `|` for alternatives.

## Example rows

| SECTION            | TYPE         | QUESTION                    | OPTION_A | OPTION_B | OPTION_C | OPTION_D | CORRECT_ANSWER |
|--------------------|--------------|-----------------------------|----------|----------|----------|----------|----------------|
| Multiple Choice    | mcq          | What is 2+2?                | 3        | 4        | 5        | 6        | B              |
| Yes or No          | yes_no       | Is the sky blue?            | Yes      | No       |          |          | Yes            |
| Fill in the Blanks | fill_blanks  | The capital of India is _____. |        |          |          |          | New Delhi      |
| Short Answer       | short_answer | Name one planet.            |          |          |          |          | Earth\|Mars\|Jupiter |
| Long Answer        | long_answer  | Describe the water cycle.  |          |          |          |          | (model answer) |

## Rules

1. First row must be the header. Column names are case-insensitive (SECTION, section, Section all work).
2. Empty rows are skipped.
3. SECTION and TYPE are trimmed; QUESTION is required for every row.
4. For MCQ, at least OPTION_A and OPTION_B and CORRECT_ANSWER (A/B/C/D) are required.
5. For yes_no, OPTION_A and OPTION_B typically "Yes" and "No"; CORRECT_ANSWER "Yes" or "No".

## Template

Download or copy a template that has the header row and 1–2 example rows, then add your questions.
