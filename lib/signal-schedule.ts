export interface ScheduleSlot {
  minutesOfDay: number;
  label: string;
  slotType: 'REGULAR' | 'ADDITIONAL';
}

export type FixedScheduleStatus =
  | {
      status: 'OPEN';
      slotLabel: string;
      endsAtLabel: string;
      slotType: 'REGULAR' | 'ADDITIONAL';
      remainingMs: number;
      timezone: string;
    }
  | {
      status: 'UPCOMING';
      nextSlotLabel: string;
      slotType: 'REGULAR' | 'ADDITIONAL';
      startsInMs: number;
      timezone: string;
    };

export function formatMinutesAs12h(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const h24 = Math.floor(normalized / 60);
  const mins = normalized % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(mins).padStart(2, '0')} ${period}`;
}

export function parseTimeTokenToMinutes(token: string): number | null {
  const clean = token.trim().toUpperCase();
  if (!clean) return null;

  const amPmMatch = clean.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
  if (amPmMatch) {
    let hour = Number(amPmMatch[1]);
    const minute = Number(amPmMatch[2] || '0');
    const period = amPmMatch[3];
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
    if (period === 'AM') {
      hour = hour === 12 ? 0 : hour;
    } else {
      hour = hour === 12 ? 12 : hour + 12;
    }
    return hour * 60 + minute;
  }

  const h24Match = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (h24Match) {
    const hour = Number(h24Match[1]);
    const minute = Number(h24Match[2]);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return hour * 60 + minute;
  }

  return null;
}

export function parseScheduleSlots(
  regularTimes: string,
  extraTime: string,
  includeExtra: boolean
): ScheduleSlot[] {
  const slots: ScheduleSlot[] = [];
  const seen = new Set<number>();

  for (const part of regularTimes.split(',')) {
    const mins = parseTimeTokenToMinutes(part);
    if (mins !== null && !seen.has(mins)) {
      seen.add(mins);
      slots.push({
        minutesOfDay: mins,
        label: formatMinutesAs12h(mins),
        slotType: 'REGULAR',
      });
    }
  }

  if (includeExtra && extraTime) {
    const extraMins = parseTimeTokenToMinutes(extraTime);
    if (extraMins !== null && !seen.has(extraMins)) {
      seen.add(extraMins);
      slots.push({
        minutesOfDay: extraMins,
        label: formatMinutesAs12h(extraMins),
        slotType: 'ADDITIONAL',
      });
    }
  }

  slots.sort((a, b) => a.minutesOfDay - b.minutesOfDay);
  return slots;
}

export function getZonedDayOffsetMs(nowMs: number, timeZone: string): {
  resolvedTimeZone: string;
  msIntoDay: number;
} {
  let resolvedTimeZone = timeZone || 'Asia/Karachi';
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: resolvedTimeZone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    resolvedTimeZone = 'Asia/Karachi';
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: resolvedTimeZone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  const parts = formatter.formatToParts(new Date(nowMs));
  const map: Record<string, number> = {};
  for (const p of parts) {
    if (p.type === 'hour' || p.type === 'minute' || p.type === 'second') {
      map[p.type] = Number(p.value);
    }
  }
  const hour = (map.hour ?? 0) % 24;
  const minute = map.minute ?? 0;
  const second = map.second ?? 0;
  const msRemainder = ((nowMs % 1000) + 1000) % 1000;
  const msIntoDay = ((hour * 60 + minute) * 60 + second) * 1000 + msRemainder;

  return { resolvedTimeZone, msIntoDay };
}

/**
 * Computes window status purely from the fixed configured daily schedule.
 * Admin-generated test or ad-hoc signals never alter or trigger this countdown.
 */
export function computeFixedScheduleWindow(params: {
  regularTimes: string;
  extraTime: string;
  timezone: string;
  validityMinutes: number;
  includeExtra: boolean;
  nowMs?: number;
}): FixedScheduleStatus {
  const nowMs = params.nowMs ?? Date.now();
  const validityMs = Math.max(1, params.validityMinutes) * 60 * 1000;
  const slots = parseScheduleSlots(params.regularTimes, params.extraTime, params.includeExtra);
  const { resolvedTimeZone, msIntoDay } = getZonedDayOffsetMs(nowMs, params.timezone);

  if (slots.length === 0) {
    return {
      status: 'UPCOMING',
      nextSlotLabel: '4:00 PM',
      slotType: 'REGULAR',
      startsInMs: 0,
      timezone: resolvedTimeZone,
    };
  }

  // Check if currently inside any fixed window (handles standard same-day windows)
  for (const slot of slots) {
    const startMs = slot.minutesOfDay * 60 * 1000;
    const endMs = startMs + validityMs;
    if (msIntoDay >= startMs && msIntoDay < endMs) {
      return {
        status: 'OPEN',
        slotLabel: `${slot.label} ${slot.slotType === 'ADDITIONAL' ? 'Additional' : 'Regular'} Slot`,
        endsAtLabel: formatMinutesAs12h(slot.minutesOfDay + params.validityMinutes),
        slotType: slot.slotType,
        remainingMs: endMs - msIntoDay,
        timezone: resolvedTimeZone,
      };
    }
  }

  // Otherwise find next upcoming slot today or wrap to tomorrow's first slot
  for (const slot of slots) {
    const startMs = slot.minutesOfDay * 60 * 1000;
    if (startMs > msIntoDay) {
      return {
        status: 'UPCOMING',
        nextSlotLabel: `${slot.label} ${slot.slotType === 'ADDITIONAL' ? 'Additional' : 'Regular'} Slot`,
        slotType: slot.slotType,
        startsInMs: startMs - msIntoDay,
        timezone: resolvedTimeZone,
      };
    }
  }

  const firstTomorrow = slots[0];
  const dayMs = 24 * 60 * 60 * 1000;
  return {
    status: 'UPCOMING',
    nextSlotLabel: `${firstTomorrow.label} ${firstTomorrow.slotType === 'ADDITIONAL' ? 'Additional' : 'Regular'} Slot`,
    slotType: firstTomorrow.slotType,
    startsInMs: dayMs - msIntoDay + firstTomorrow.minutesOfDay * 60 * 1000,
    timezone: resolvedTimeZone,
  };
}
