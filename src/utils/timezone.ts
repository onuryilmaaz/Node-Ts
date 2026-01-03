import { toZonedTime, format } from "date-fns-tz";

const TR_TIMEZONE = "Europe/Istanbul";

export function toTRTimeString(date: Date, withSeconds = false): string {
  const zoned = toZonedTime(date, TR_TIMEZONE);

  return format(zoned, withSeconds ? "HH:mm:ss" : "HH:mm", {
    timeZone: TR_TIMEZONE,
  });
}
