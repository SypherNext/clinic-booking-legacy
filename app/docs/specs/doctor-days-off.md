# Spec: doctor days off

## Why

Front desk, issue 61: "Dr. Tanaka is away on Wednesday 2030-03-06. Patients can
still book her that day and we have to phone them all back."

## What

The front desk can mark a doctor as away on a date. On that date nobody can
book or move an appointment to that doctor.

## Rules

1. Only the front desk (x-admin-token) can add, list or remove days off.
2. POST /admin/days-off with {"doctorId", "date", "reason"} adds one.
   - 400 if the date is not a real YYYY-MM-DD date, is in the past, or is a day the clinic
     is closed; 400 if reason is not text or is longer than 100 characters (reason is optional).
   - 404 "Doctor not found" for an unknown doctor.
   - 409 "Already marked away on that day" if it already exists.
   - 409 "Doctor has booked appointments that day; move or cancel them first" if any
     booked appointment exists for that doctor that clinic day. Never cancel anything automatically.
   - 201 with {id, doctorId, date, reason}.
3. GET /admin/days-off?from=YYYY-MM-DD lists days off on or after that date, sorted by date.
   from is optional and defaults to today's clinic date.
4. DELETE /admin/days-off/:id removes one (404 if unknown).
5. GET /api/slots for that doctor and date returns closed: true, away: true and no slots.
6. POST and PATCH /api/appointments to that doctor on that date return
   400 "The doctor is away on that day".
7. The next free slot search skips days off.

## Screens

- Booking page: on an away day, the slot area says "<Doctor name> is away on this day."
- Front desk page: a "Doctor away days" section to add one (doctor, date, reason)
  and list upcoming ones with a Remove button.

## Out of scope

Recurring days off, half days, and telling patients.

## Done when

- Tests cover every rule above, and npm run check passes.
- The booking page and the front desk page are checked by hand in a browser.
