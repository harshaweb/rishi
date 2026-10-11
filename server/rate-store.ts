import type { Store } from "express-rate-limit"
import { mongo, pool } from "./db.js"
type Counter = { _id: string; hits: number; reset: Date }
export function rateStore(prefix: string): Store {
  let windowMs = 60000
  return {
    init(options) {
      windowMs = options.windowMs
    },
    async increment(key) {
      if (mongo) {
        // One atomic pipeline resets expired windows and increments live ones.
        const expired = {
          $lte: [{ $ifNull: ["$reset", new Date(0)] }, "$$NOW"],
        }
        const result = await mongo
          .collection<Counter>("RateLimit")
          .findOneAndUpdate(
            { _id: prefix + key },
            [
              {
                $set: {
                  hits: { $cond: [expired, 1, { $add: ["$hits", 1] }] },
                  reset: {
                    $cond: [expired, { $add: ["$$NOW", windowMs] }, "$reset"],
                  },
                },
              },
            ],
            { upsert: true, returnDocument: "after" }
          )
        if (!result) throw new Error("Rate limit counter was not saved.")
        return { totalHits: result.hits, resetTime: result.reset }
      }
      const result = await pool.query(
        'INSERT INTO "RateLimit" (key, hits, reset) VALUES ($1, 1, NOW() + $2 * INTERVAL \'1 millisecond\') ON CONFLICT (key) DO UPDATE SET hits = CASE WHEN "RateLimit".reset < NOW() THEN 1 ELSE "RateLimit".hits + 1 END, reset = CASE WHEN "RateLimit".reset < NOW() THEN NOW() + $2 * INTERVAL \'1 millisecond\' ELSE "RateLimit".reset END RETURNING hits, reset',
        [prefix + key, windowMs]
      )
      return { totalHits: result.rows[0].hits, resetTime: result.rows[0].reset }
    },
    async decrement(key) {
      if (mongo) {
        await mongo
          .collection<Counter>("RateLimit")
          .updateOne({ _id: prefix + key }, [
            { $set: { hits: { $max: [0, { $subtract: ["$hits", 1] }] } } },
          ])
        return
      }
      await pool.query(
        'UPDATE "RateLimit" SET hits = GREATEST(hits - 1, 0) WHERE key = $1',
        [prefix + key]
      )
    },
    async resetKey(key) {
      if (mongo) {
        await mongo
          .collection<Counter>("RateLimit")
          .deleteOne({ _id: prefix + key })
        return
      }
      await pool.query('DELETE FROM "RateLimit" WHERE key = $1', [prefix + key])
    },
  }
}
