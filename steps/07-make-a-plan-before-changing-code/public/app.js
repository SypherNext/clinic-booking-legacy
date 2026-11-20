// Booking page. Plain browser JavaScript, no build step.

const $ = (id) => document.getElementById(id);
let chosen = null; // the slot the user clicked

async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'content-type': 'application/json' },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Request failed (' + res.status + ')');
  return body;
}

function nextWeekday() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function showMessage(text, kind) {
  $('message').textContent = text;
  $('message').className = 'message ' + (kind || '');
}

function prettyDate(date) {
  const d = new Date(date + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function prettyTime(hhmm) {
  let [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return h + ':' + String(m).padStart(2, '0') + ' ' + suffix;
}

async function loadDoctors() {
  const doctors = await api('/api/doctors');
  $('doctor').innerHTML = doctors
    .map((d) => '<option value="' + d.id + '">' + d.name + ' (' + d.specialty + ')</option>')
    .join('');
}

async function loadSlots() {
  const doctorId = $('doctor').value;
  const date = $('date').value;
  chosen = null;
  $('book-form').hidden = true;
  $('day-label').textContent = prettyDate(date);
  const data = await api('/api/slots?doctorId=' + doctorId + '&date=' + date);
  const box = $('slots');
  box.innerHTML = '';
  if (data.closed) {
    box.innerHTML = '<div class="closed">The clinic is closed on this day.</div>';
    return;
  }
  for (const slot of data.slots) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'slot' + (slot.available ? '' : ' taken');
    b.textContent = prettyTime(slot.time);
    b.disabled = !slot.available;
    b.onclick = () => choose(slot, b);
    box.appendChild(b);
  }
}

function choose(slot, button) {
  chosen = slot;
  document.querySelectorAll('.slot.chosen').forEach((el) => el.classList.remove('chosen'));
  button.classList.add('chosen');
  $('chosen').textContent = prettyDate($('date').value) + ' at ' + prettyTime(slot.time);
  $('book-form').hidden = false;
  $('patient-name').focus();
}

async function loadAppointments() {
  const doctorId = $('doctor').value;
  const date = $('date').value;
  const rows = await api('/api/appointments?doctorId=' + doctorId + '&date=' + date);
  const body = $('appointments');
  if (rows.length === 0) {
    body.innerHTML = '<tr><td colspan="4" class="muted">No appointments yet.</td></tr>';
    return;
  }
  body.innerHTML = '';
  for (const a of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + a.displayTime + '</td>' +
      '<td>' + a.patientName + '</td>' +
      '<td class="status-' + a.status + '">' + a.status + '</td>' +
      '<td></td>';
    if (a.status === 'booked') {
      const cancel = document.createElement('button');
      cancel.className = 'small ghost';
      cancel.textContent = 'Cancel';
      cancel.onclick = () => cancelAppointment(a.id);
      tr.lastChild.appendChild(cancel);
    }
    body.appendChild(tr);
  }
}

async function refresh() {
  try {
    await Promise.all([loadSlots(), loadAppointments()]);
  } catch (err) {
    showMessage(err.message, 'error');
  }
}

async function cancelAppointment(id) {
  try {
    await api('/api/appointments/' + id, { method: 'DELETE' });
    showMessage('Appointment cancelled.', 'ok');
    await refresh();
  } catch (err) {
    showMessage(err.message, 'error');
  }
}

$('book-form').onsubmit = async (e) => {
  e.preventDefault();
  if (!chosen) return;
  try {
    const appt = await api('/api/appointments', {
      method: 'POST',
      body: JSON.stringify({
        doctorId: Number($('doctor').value),
        startsAt: chosen.startsAt,
        patientName: $('patient-name').value,
        patientPhone: $('patient-phone').value,
      }),
    });
    showMessage('Booked ' + appt.patientName + ' at ' + appt.displayTime + '.', 'ok');
    $('patient-name').value = '';
    $('patient-phone').value = '';
    await refresh();
  } catch (err) {
    showMessage(err.message, 'error');
  }
};

$('cancel-choice').onclick = () => {
  chosen = null;
  $('book-form').hidden = true;
  document.querySelectorAll('.slot.chosen').forEach((el) => el.classList.remove('chosen'));
};

$('doctor').onchange = refresh;
$('date').onchange = refresh;

(async function start() {
  $('date').value = nextWeekday();
  await loadDoctors();
  await refresh();
})();
