import type { Request, Response } from "express";
import type { PrayerDailyQuery } from "./prayer.schema";
import { CITIES_TR } from "../../constants/cities.tr";
import { getDailyPrayerTimes } from "./prayer.service";
import { getNextPrayer } from "./prayer.utils";
import { toTRTimeString } from "../../utils/timezone";

export async function getDailyPrayer(
  req: Request<{}, {}, {}, PrayerDailyQuery>,
  res: Response
) {
  try {
    const city = req.query.city?.toLowerCase();

    if (!city || !CITIES_TR[city]) {
      return res.status(400).json({
        success: false,
        message: "Geçerli bir şehir giriniz",
      });
    }

    const { lat, lng } = CITIES_TR[city];

    const prayers = await getDailyPrayerTimes(lat, lng);
    const nextPrayer = getNextPrayer(prayers);

    return res.json({
      success: true,
      data: {
        city,
        date: new Date().toISOString().split("T")[0],
        prayers: {
          sabah: toTRTimeString(prayers.fajr),
          imsak: toTRTimeString(prayers.sunrise),
          öğle: toTRTimeString(prayers.dhuhr),
          ikindi: toTRTimeString(prayers.asr),
          akşam: toTRTimeString(prayers.maghrib),
          yatsı: toTRTimeString(prayers.isha),
        },
        nextPrayer: nextPrayer
          ? {
              name: nextPrayer.name,
              time: toTRTimeString(nextPrayer.time),
              remaining: nextPrayer.remaining,
            }
          : null,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Namaz vakitleri hesaplanamadı",
    });
  }
}
