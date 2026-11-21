import test from 'node:test';
import assert from 'node:assert/strict';
import { computeFixedScheduleWindow, formatMinutesAs12h, parseTimeTokenToMinutes } from './signal-schedule';

test('parses 24h and 12h time tokens accurately', () => {
  assert.equal(parseTimeTokenToMinutes('16:00'), 960);
  assert.equal(parseTimeTokenToMinutes('9:00 PM'), 1260);
  assert.equal(parseTimeTokenToMinutes('12:00 AM'), 0);
  assert.equal(formatMinutesAs12h(960), '4:00 PM');
  assert.equal(formatMinutesAs12h(1260), '9:00 PM');
});

test('computeFixedScheduleWindow detects open 4:00 PM regular slot with remaining expiry time', () => {
  // 16:10 Asia/Karachi (UTC+5) = 11:10 UTC
  const nowMs = Date.UTC(2026, 4, 10, 11, 10, 0);
  const res = computeFixedScheduleWindow({
    regularTimes: '16:00, 18:00, 20:00',
    extraTime: '21:00',
    timezone: 'Asia/Karachi',
    validityMinutes: 30,
    includeExtra: false,
    nowMs,
  });
  assert.equal(res.status, 'OPEN');
  if (res.status === 'OPEN') {
    assert.equal(res.slotLabel, '4:00 PM Regular Slot');
    assert.equal(res.endsAtLabel, '4:30 PM');
    assert.equal(res.remainingMs, 20 * 60 * 1000);
  }
});

test('computeFixedScheduleWindow hides 9:00 PM extra slot when includeExtra is false and includes when true', () => {
  // 20:45 Asia/Karachi (UTC+5) = 15:45 UTC (after 20:00–20:30 window closes)
  const nowMs = Date.UTC(2026, 4, 10, 15, 45, 0);

  const regularOnly = computeFixedScheduleWindow({
    regularTimes: '16:00, 18:00, 20:00',
    extraTime: '21:00',
    timezone: 'Asia/Karachi',
    validityMinutes: 30,
    includeExtra: false,
    nowMs,
  });
  assert.equal(regularOnly.status, 'UPCOMING');
  if (regularOnly.status === 'UPCOMING') {
    assert.equal(regularOnly.nextSlotLabel, '4:00 PM Regular Slot');
  }

  const withExtra = computeFixedScheduleWindow({
    regularTimes: '16:00, 18:00, 20:00',
    extraTime: '21:00',
    timezone: 'Asia/Karachi',
    validityMinutes: 30,
    includeExtra: true,
    nowMs,
  });
  assert.equal(withExtra.status, 'UPCOMING');
  if (withExtra.status === 'UPCOMING') {
    assert.equal(withExtra.nextSlotLabel, '9:00 PM Additional Slot');
    assert.equal(withExtra.startsInMs, 15 * 60 * 1000);
  }
});
