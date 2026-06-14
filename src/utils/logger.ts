/**
 * Basit yapılandırılmış logger. Çıplak console.* yerine bunu kullan.
 * - debug: yalnızca production dışında yazar
 * - info/warn/error: her zaman, seviye etiketi + ISO zaman damgasıyla
 */
const isProd = process.env.NODE_ENV === "production";

const ts = () => new Date().toISOString();

export const logger = {
  info: (...args: unknown[]) => console.log(`[info] ${ts()}`, ...args),
  warn: (...args: unknown[]) => console.warn(`[warn] ${ts()}`, ...args),
  error: (...args: unknown[]) => console.error(`[error] ${ts()}`, ...args),
  debug: (...args: unknown[]) => {
    if (!isProd) console.log(`[debug] ${ts()}`, ...args);
  },
};
