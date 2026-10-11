import type { Store } from "express-rate-limit"
import { pool } from "./db.js"
export function rateStore(prefix: string): Store {
  let windowMs = 60000
  return {
    init(options) {
      windowMs = options.windowMs
    },
    async increment(key) {
      const result = await pool.query(
        'INSERT INTO "RateLimit" (key, hits, reset) VALUES ($1, 1, NOW() + $2 * INTERVAL \'1 millisecond\') ON CONFLICT (key) DO UPDATE SET hits = CASE WHEN "RateLimit".reset < NOW() THEN 1 ELSE "RateLimit".hits + 1 END, reset = CASE WHEN "RateLimit".reset < NOW() THEN NOW() + $2 * INTERVAL \'1 millisecond\' ELSE "RateLimit".reset END RETURNING hits, reset',
        [prefix + key, windowMs]
      )
      return { totalHits: result.rows[0].hits, resetTime: result.rows[0].reset }
    },
    async decrement(key) {
      await pool.query(
        'UPDATE "RateLimit" SET hits = GREATEST(hits - 1, 0) WHERE key = $1',
        [prefix + key]
      )
    },
    async resetKey(key) {
      await pool.query('DELETE FROM "RateLimit" WHERE key = $1', [prefix + key])
    },
  }
}
