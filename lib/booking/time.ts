/**
 * Wall-clock ↔ UTC conversions for the business timezone.
 * Schedules are defined in local wall time ("09:00"), so all availability
 * math happens in wall-clock minutes and converts at the edges.
 */

export type Interval = { start: number; end: number }; // minutes of day

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export function weekdayKey(weekday: number): (typeof WEEKDAY_KEYS)[number] {
  return WEEKDAY_KEYS[weekday] ?? "sun";
}

export function parseHHMM(value: string): number {
  const [h, m] = value.split(":").map(Number);
  if (
    Number.isNaN(h) ||
    Number.isNaN(m) ||
    h < 0 ||
    h > 24 ||
    m < 0 ||
    m > 59 ||
    (h === 24 && m > 0)
  ) {
    throw new Error(`Invalid time: ${value}`);
  }
  return h * 60 + m;
}

export function formatHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) {
    parts[p.type] = p.value;
  }
  // Hour "24" can appear in some runtimes with hour12: false.
  const hour = parts.hour === "24" ? 0 : Number(parts.hour);
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour,
    minute: Number(parts.minute),
  };
}

function tzOffsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  // formatToParts drops milliseconds, so compare against the second-floored instant.
  return asUtc - (date.getTime() - date.getMilliseconds());
}

/** Convert a wall-clock moment in `timeZone` to a UTC Date. */
export function zonedToUtc(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const offset1 = tzOffsetMs(new Date(guess), timeZone);
  let timestamp = guess - offset1;
  const offset2 = tzOffsetMs(new Date(timestamp), timeZone);
  if (offset2 !== offset1) {
    timestamp = guess - offset2;
  }
  return new Date(timestamp);
}

/** Current wall-clock parts at the given timezone. */
export function nowZoned(timeZone: string): ZonedParts {
  return zonedParts(new Date(), timeZone);
}

/** Weekday (0=Sun..6=Sat) of a UTC instant, in the given timezone. */
export function weekdayInTz(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  return new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
}

/** Convert a UTC instant to minutes-of-day in the timezone. */
export function utcToWallMinutes(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  return p.hour * 60 + p.minute;
}

/**
 * Convert a UTC interval [start,end) into wall-minute intervals clipped to a
 * specific calendar day (identified by any instant during that day).
 * Intervals spanning midnight are clipped; callers evaluate adjacent days
 * separately so nothing is lost.
 */
export function utcIntervalToWallMinutes(
  startAt: Date,
  endAt: Date,
  timeZone: string,
  dayInstant: Date,
): Interval[] {
  const dayStart = zonedParts(dayInstant, timeZone);
  const dayStartUtc = zonedToUtc(
    dayStart.year,
    dayStart.month,
    dayStart.day,
    0,
    0,
    timeZone,
  );
  const DAY_MS = 86_400_000;

  const s = Math.max(
    0,
    Math.floor((startAt.getTime() - dayStartUtc.getTime()) / 60_000),
  );
  const e = Math.min(
    1440,
    Math.ceil((endAt.getTime() - dayStartUtc.getTime()) / 60_000),
  );

  if (endAt.getTime() <= dayStartUtc.getTime() || s >= 1440 || s >= e) {
    return [];
  }
  return [{ start: s, end: e }];
}

/** Subtract a set of intervals from another set. */
export function subtractIntervals(
  base: Interval[],
  remove: Interval[],
): Interval[] {
  let result = [...base].sort((a, b) => a.start - b.start);
  for (const r of [...remove].sort((a, b) => a.start - b.start)) {
    const next: Interval[] = [];
    for (const i of result) {
      if (r.end <= i.start || r.start >= i.end) {
        next.push(i); // no overlap
        continue;
      }
      if (r.start > i.start) next.push({ start: i.start, end: r.start });
      if (r.end < i.end) next.push({ start: r.end, end: i.end });
    }
    result = next;
  }
  return result.filter((i) => i.end > i.start);
}

/** Intersect two sets of intervals. */
export function intersectIntervals(a: Interval[], b: Interval[]): Interval[] {
  const out: Interval[] = [];
  for (const ia of a) {
    for (const ib of b) {
      const start = Math.max(ia.start, ib.start);
      const end = Math.min(ia.end, ib.end);
      if (start < end) out.push({ start, end });
    }
  }
  return out;
}
