# clinic-booking

Booking service for Harbor Street Clinic. Patients pick a doctor, a day and a
free half-hour slot; the front desk sees the day's list and can export it.

Slots run 09:00 to 17:00, except for the lunch break from 12:00 to 13:00
(`lunchStart` and `lunchEnd` in `src/config.ts`); bookings made at lunch time
before the break was added are kept.

## Running

    npm install
    npm start          # http://localhost:18800

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
| GET | /api/appointments?doctorId=&date= | appointments for one doctor and day |
| POST | /api/appointments | book `{ doctorId, startsAt, patientName, patientPhone }` |
| DELETE | /api/appointments/:id | cancel |
| GET | /admin/report?date= | front desk report (needs `x-admin-token`) |
| GET | /admin/report.csv?date= | the same as CSV |

## Known issues

- Daylight saving time is not handled. The clinic is on UTC-8 all year.
- Some afternoon times have been reported as "showing free when they are
  not". Could not reproduce.
