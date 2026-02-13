import { DateTime } from "luxon";

export function dateInTimezone(tz: string, offsetDays = 0): string {
  return DateTime.now().setZone(tz).plus({ days: offsetDays }).toFormat("yyyy-LL-dd");
}

export function dayBoundsUtc(date: string, tz: string): { start: Date; end: Date } {
  const start = DateTime.fromISO(date, { zone: tz }).startOf("day");
  const end = start.plus({ days: 1 });
  return { start: start.toUTC().toJSDate(), end: end.toUTC().toJSDate() };
}

export function weekBoundsUtc(startDate: string, tz: string): { start: Date; end: Date } {
  const start = DateTime.fromISO(startDate, { zone: tz }).startOf("day");
  const end = start.plus({ days: 7 });
  return { start: start.toUTC().toJSDate(), end: end.toUTC().toJSDate() };
}
