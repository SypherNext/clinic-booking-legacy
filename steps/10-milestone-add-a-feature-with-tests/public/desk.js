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

el('date').value = new Date().toISOString().slice(0, 10);
