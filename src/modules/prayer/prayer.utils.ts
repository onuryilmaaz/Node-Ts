export function getNextPrayer(prayers: Record<string, Date>) {
  const now = new Date();

  for (const [name, time] of Object.entries(prayers)) {
    if (time > now) {
      const diffMs = time.getTime() - now.getTime();

      return {
        name,
        time,
        remaining: {
          hours: Math.floor(diffMs / 1000 / 60 / 60),
          minutes: Math.floor((diffMs / 1000 / 60) % 60),
          totalMinutes: Math.floor(diffMs / 1000 / 60),
        },
      };
    }
  }

  return null;
}
