import { Coordinates, CalculationMethod, PrayerTimes, Madhab } from "adhan";
import { toZonedTime } from "date-fns-tz";

const TIME_ZONE = "Europe/Istanbul";

export async function getDailyPrayerTimes(
  lat: Number,
  lng: Number,
  date: Date = new Date()
) {
  const coordinates = new Coordinates(lat as number, lng as number);

  const params = CalculationMethod.MuslimWorldLeague();
  params.madhab = Madhab.Shafi;

  const prayerTimes = new PrayerTimes(coordinates, date, params);

  const toLocal = (d: Date) => toZonedTime(d, TIME_ZONE);

  return {
    fajr: toLocal(prayerTimes.fajr),
    sunrise: toLocal(prayerTimes.sunrise),
    dhuhr: toLocal(prayerTimes.dhuhr),
    asr: toLocal(prayerTimes.asr),
    maghrib: toLocal(prayerTimes.maghrib),
    isha: toLocal(prayerTimes.isha),
  };
}
