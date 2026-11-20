// Booking page. Plain browser JavaScript, no build step.

const $ = (id) => document.getElementById(id);
let chosen = null; // the slot the user clicked
let moving = null; // the appointment being moved: { id, patientName }

async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'content-type': 'application/json' },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Request failed (' + res.status + ')');
  return body;
}

// the first day after today (clinic time) that is not a Sunday
async function nextWeekday() {
  const today = await api('/api/today');
  const d = new Date(today.date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
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
    b.dataset.startsAt = slot.startsAt;
    b.onclick = () => (moving ? moveTo(slot) : choose(slot, b));
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
      '<td></td>' +
      '<td class="status-' + a.status + '">' + a.status + '</td>' +
      '<td></td>';
    tr.children[1].textContent = a.patientName;
    if (a.status === 'booked') {
      const move = document.createElement('button');
      move.className = 'small ghost';
      move.textContent = 'Move';
      move.onclick = () => startMoving(a);
      tr.lastChild.append(move, ' ');
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

function startMoving(appt) {
  moving = { id: appt.id, patientName: appt.patientName };
  chosen = null;
  $('book-form').hidden = true;
  document.querySelectorAll('.slot.chosen').forEach((el) => el.classList.remove('chosen'));
  $('move-text').textContent = 'Choose a new time for ' + appt.patientName;
  $('move-bar').hidden = false;
}

function stopMoving() {
  moving = null;
  $('move-bar').hidden = true;
}

async function moveTo(slot) {
  try {
    const appt = await api('/api/appointments/' + moving.id, {
      method: 'PATCH',
      body: JSON.stringify({ startsAt: slot.startsAt }),
    });
    stopMoving();
    showMessage('Moved ' + appt.patientName + ' to ' + appt.displayTime + '.', 'ok');
    await refresh();
  } catch (err) {
    showMessage(err.message, 'error');
  }
}

async function cancelAppointment(id) {
  try {
    await api('/api/appointments/' + id, { method: 'DELETE' });
    if (moving && moving.id === id) stopMoving();
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

$('stop-moving').onclick = stopMoving;

// jumps the date picker to the doctor's first free slot from the picked date on, and highlights it
$('next-free').onclick = async () => {
  try {
    const data = await api('/api/slots/next?doctorId=' + $('doctor').value + '&date=' + $('date').value);
    if (!data.slot) {
      showMessage('No free time in the next 14 days.', 'error');
      return;
    }
    $('date').value = data.slot.date;
    showMessage('');
    await refresh();
    const button = document.querySelector('.slot[data-starts-at="' + data.slot.startsAt + '"]');
    if (button) {
      button.classList.add('next-free');
      button.focus();
    }
  } catch (err) {
    showMessage(err.message, 'error');
  }
};

// a move keeps the same doctor, so switching doctor ends it; switching date does not
$('doctor').onchange = () => {
  stopMoving();
  refresh();
};
$('date').onchange = refresh;

(async function start() {
  $('date').value = await nextWeekday();
  await loadDoctors();
  await refresh();
})();
