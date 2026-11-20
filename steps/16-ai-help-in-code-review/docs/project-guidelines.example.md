# Project guidelines: clinic booking service

These are the working rules for this project. Copy this file to the instruction
file your coding assistant reads in the project folder (the course lesson on
project rules lists the usual file names) and keep the two in step.

## Commands

- `npm run check` runs the type check, the lint and every test. Run it before you
  say a change is done, and quote its summary lines (tests, pass, fail).
- `node --test test/<name>.test.ts` runs one test file.
- `npm start` serves the app on http://localhost:18800.

## Where code goes

- `src/routes/`: HTTP handlers only. Read the input, call the rules and the
  stores, send the response. No SQL in a route.
- `src/store/`: every SQL statement, one module per table.
- `src/lib/booking-rules.ts`: input and booking rules. Each rule returns an error
  message or null (or a value or `{ error }`).
- `src/lib/time.ts`: every clinic-time conversion. Times are stored as UTC ISO
  strings. To find a clinic day's appointments use `clinicDayUtcRange(date)`;
  never compare the date part of a UTC time with a clinic date.
- `public/`: plain browser JavaScript, no build step. Show any text that came
  from a user with `textContent`, never `innerHTML`.

## Rules

- Do not add npm packages without asking first.
- A bug fix starts with a test that fails without the fix.
- Never change or delete an existing test to make it pass. Stop and ask.
- Send errors with `sendError(res, status, message)` and keep existing messages
  exactly as they are: the booking page shows them to patients.
- Keep each change small and inside the request. List anything else you notice
  under "Also noticed" instead of fixing it.
- Do not open, print or copy `.env` files.
