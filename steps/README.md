# Steps

Each folder is a complete copy of the app at the end of one lesson. Lessons 1 to 4 do not change the code, so the first step is lesson 5. Copy a folder (without `node_modules`) to catch up, or compare it with your own working copy, for example with `diff -r steps/09-fixing-bugs-together/src ~/clinic-work/src`.

| Folder | What changed in that lesson | Tests |
| --- | --- | --- |
| `05-milestone-your-first-small-fix` | A missing or blank patient name is rejected with 400; names are trimmed | 22 |
| `06-saying-clearly-what-you-want` | Only real, open, future slots can be booked; rules in `src/lib/booking-rules.ts` | 30 |
| `07-make-a-plan-before-changing-code` | No double booking: insert straight after the check, plus a unique index | 34 |
| `08-let-tests-guide-the-work` | A cancelled slot can be booked again | 35 |
| `09-fixing-bugs-together` | 4:00 PM and 4:30 PM bookings found again: days are looked up by their UTC range | 40 |
| `10-milestone-add-a-feature-with-tests` | Move (reschedule) an appointment, in the API and on the booking page | 46 |
| `11-checking-ai-code-carefully` | Cancelling the appointment being moved also ends the move | 46 |
| `12-cleaning-up-old-code-safely` | SQL moved into `src/store/`, shared helpers, thin route handlers | 54 |
| `13-project-rules-the-assistant-follows` | `docs/project-guidelines.example.md`; "Next free time" button | 62 |
| `14-working-in-a-bigger-codebase` | `src/lib/schedule.ts`; lunch break 12:00 to 13:00 | 65 |
| `15-staying-safe-secrets-tricks-and-fake-packages` | Token read from `ADMIN_TOKEN`; pages open on today's clinic date | 75 |
| `16-ai-help-in-code-review` | Review fixes and `.github/workflows/ci.yml` | 75 |
| `17-capstone-ship-a-feature-from-idea-to-merge` | Doctor days off, from spec to merge | 112 |
