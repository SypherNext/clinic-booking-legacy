# clinic-booking

Booking service for Harbor Street Clinic. Patients pick a doctor, a day and a
free half-hour slot; the front desk sees the day's list and can export it.

Slots run 09:00 to 17:00, except for the lunch break from 12:00 to 13:00
(`lunchStart` and `lunchEnd` in `src/config.ts`); bookings made at lunch time
before the break was added are kept.

## Running

    npm install
    npm start          # http://localhost:18800

The server needs a front desk token in the `ADMIN_TOKEN` environment variable and
will not start without one (at least 24 characters). `npm start` and `npm run dev`
read it from a `.env` file in the project folder if there is one:

1. Copy `.env.example` to `.env` (`.env` is in `.gitignore`; never commit it).
2. Generate a token and put it after `ADMIN_TOKEN=`:

       node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"

3. Give the token to the front desk; they type it into the desk page.

On a server you can set `ADMIN_TOKEN` in the environment instead of using `.env`.

The database is a SQLite file in `data/clinic.db`. It is created on first start
with three doctors.

## Tests

    npm test           # unit and API tests
    npm run check      # type check + lint + tests

## Endpoints

| Method | Path | What it does |
| --- | --- | --- |
| GET | /api/doctors | list doctors |
| GET | /api/slots?doctorId=&date= | slots for one doctor and day |
| GET | /api/slots/next?doctorId=&date= | the doctor's first free slot on or after that date (14 days, skipping days off) |
| GET | /api/today | today's clinic date `{ date }` |
| GET | /api/appointments?doctorId=&date= | appointments for one doctor and day |
| GET | /api/appointments/:id | one appointment |
| POST | /api/appointments | book `{ doctorId, startsAt, patientName, patientPhone }` |
| PATCH | /api/appointments/:id | move to another slot, same doctor `{ startsAt }` |
| DELETE | /api/appointments/:id | cancel |
| GET | /admin/report?date= | front desk report (needs `x-admin-token`) |
| GET | /admin/report.csv?date= | the same as CSV |
| POST | /admin/days-off | mark a doctor away `{ doctorId, date, reason }` (needs `x-admin-token`) |
| GET | /admin/days-off?from= | days off on or after `from` (default today), sorted by date (needs `x-admin-token`) |
| DELETE | /admin/days-off/:id | remove a day off (needs `x-admin-token`) |

## Known issues

- Daylight saving time is not handled. The clinic is on UTC-8 all year.
