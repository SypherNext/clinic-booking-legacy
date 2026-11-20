import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.ts';
import { createDaysOffStore } from '../src/store/days-off.ts';

function freshStore() {
  return createDaysOffStore(openDb(':memory:'));
}

test('a day off can be added, found and listed', () => {
  const store = freshStore();
  const row = store.add(3, '2030-03-06', 'Conference');
  assert.ok(row);
  assert.deepEqual(
    { doctorId: row.doctor_id, date: row.date, reason: row.reason },
    { doctorId: 3, date: '2030-03-06', reason: 'Conference' },
  );
  assert.deepEqual(store.findById(row.id), row);
  assert.equal(store.isAway(3, '2030-03-06'), true);
  assert.equal(store.isAway(3, '2030-03-07'), false);
  assert.equal(store.isAway(1, '2030-03-06'), false);
});

test('the same doctor and date cannot be added twice', () => {
  const store = freshStore();
  assert.ok(store.add(3, '2030-03-06', ''));
  assert.equal(store.add(3, '2030-03-06', 'again'), null);
  assert.ok(store.add(1, '2030-03-06', ''), 'another doctor on the same day is fine');
});

test('list gives days off on or after a date, sorted by date', () => {
  const store = freshStore();
  store.add(1, '2030-03-08', '');
  store.add(2, '2030-03-01', '');
  store.add(3, '2030-03-06', '');
  store.add(2, '2030-03-05', '');
  assert.deepEqual(
    store.list('2030-03-05').map((r) => r.date),
    ['2030-03-05', '2030-03-06', '2030-03-08'],
  );
});

test('remove deletes one day off and says whether it existed', () => {
  const store = freshStore();
  const row = store.add(3, '2030-03-06', '');
  assert.ok(row);
  assert.equal(store.remove(row.id), true);
  assert.equal(store.findById(row.id), undefined);
  assert.equal(store.isAway(3, '2030-03-06'), false);
  assert.equal(store.remove(row.id), false);
});
