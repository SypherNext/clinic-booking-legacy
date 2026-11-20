// Front desk page: the day report for every doctor.

const el = (id) => document.getElementById(id);

function say(text, kind) {
  el('message').textContent = text;
  el('message').className = 'message ' + (kind || '');
}

async function getReport(path) {
  const res = await fetch(path + '?date=' + el('date').value, {
    headers: { 'x-admin-token': el('token').value },
  });
  if (res.status === 401) throw new Error('That desk token is not right.');
  if (!res.ok) throw new Error('Could not load the report (' + res.status + ').');
  return res;
}

function cell(text) {
  const td = document.createElement('td');
  td.textContent = text;
  return td;
}

el('report-form').onsubmit = async (e) => {
  e.preventDefault();
  try {
    const report = await (await getReport('/admin/report')).json();
    say('');
    el('totals').textContent = report.booked + ' booked, ' + report.cancelled + ' cancelled';
    const body = el('rows');
    body.innerHTML = '';
    for (const a of report.appointments) {
      const tr = document.createElement('tr');
      for (const value of [a.time, a.doctor, a.patient, a.phone, a.status]) tr.appendChild(cell(value));
      body.appendChild(tr);
    }
  } catch (err) {
    say(err.message, 'error');
  }
};

el('csv').onclick = async () => {
  try {
    const blob = await (await getReport('/admin/report.csv')).blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'appointments-' + el('date').value + '.csv';
    link.click();
  } catch (err) {
    say(err.message, 'error');
  }
};

// today's clinic date comes from the server; the UTC date is already tomorrow after 4 PM
fetch('/api/today')
  .then((res) => {
    if (!res.ok) throw new Error('Could not load today (' + res.status + ')');
    return res.json();
  })
  .then((today) => {
    if (!el('date').value) el('date').value = today.date;
    if (!el('away-date').value) el('away-date').value = today.date;
  })
  .catch(() => say('Could not load today\'s date. Pick a date.', 'error'));

// Doctor away days

let doctors = []; // from /api/doctors: { id, name, specialty }

function sayAway(text, kind) {
  el('away-message').textContent = text;
  el('away-message').className = 'message ' + (kind || '');
}

function prettyDate(date) {
  const d = new Date(date + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// calls a /admin/days-off endpoint with the desk token; throws with the server's message
async function daysOffApi(path, options) {
  const res = await fetch(path, {
    ...options,
    headers: { 'content-type': 'application/json', 'x-admin-token': el('token').value },
  });
  if (res.status === 401) throw new Error('That desk token is not right.');
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Request failed (' + res.status + ').');
  return body;
}

async function loadDoctors() {
  const res = await fetch('/api/doctors');
  if (!res.ok) throw new Error('Could not load the doctors (' + res.status + ').');
  doctors = await res.json();
  const select = el('away-doctor');
  select.innerHTML = '';
  for (const d of doctors) {
    const option = document.createElement('option');
    option.value = d.id;
    option.textContent = d.name;
    select.appendChild(option);
  }
}

function doctorName(id) {
  const doctor = doctors.find((d) => d.id === id);
  return doctor ? doctor.name : 'Doctor ' + id;
}

// upcoming days off, from today's clinic date on
async function loadDaysOff() {
  const rows = await daysOffApi('/admin/days-off');
  const body = el('away-rows');
  body.innerHTML = '';
  if (rows.length === 0) {
    const tr = document.createElement('tr');
    const td = cell('No upcoming away days.');
    td.colSpan = 4;
    td.className = 'muted';
    tr.appendChild(td);
    body.appendChild(tr);
    return;
  }
  for (const d of rows) {
    const tr = document.createElement('tr');
    tr.append(cell(prettyDate(d.date)), cell(doctorName(d.doctorId)), cell(d.reason), cell(''));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'small ghost';
    remove.textContent = 'Remove';
    remove.onclick = () => removeDayOff(d);
    tr.lastChild.appendChild(remove);
    body.appendChild(tr);
  }
}

async function removeDayOff(d) {
  try {
    await daysOffApi('/admin/days-off/' + d.id, { method: 'DELETE' });
    sayAway(doctorName(d.doctorId) + ' is no longer away on ' + prettyDate(d.date) + '.', 'ok');
    await loadDaysOff();
  } catch (err) {
    sayAway(err.message, 'error');
  }
}

el('away-form').onsubmit = async (e) => {
  e.preventDefault();
  try {
    const d = await daysOffApi('/admin/days-off', {
      method: 'POST',
      body: JSON.stringify({
        doctorId: Number(el('away-doctor').value),
        date: el('away-date').value,
        reason: el('away-reason').value,
      }),
    });
    sayAway(doctorName(d.doctorId) + ' is marked away on ' + prettyDate(d.date) + '.', 'ok');
    el('away-reason').value = '';
    await loadDaysOff();
  } catch (err) {
    sayAway(err.message, 'error');
  }
};

el('away-show').onclick = async () => {
  try {
    sayAway('');
    await loadDaysOff();
  } catch (err) {
    sayAway(err.message, 'error');
  }
};

loadDoctors().catch((err) => sayAway(err.message, 'error'));
