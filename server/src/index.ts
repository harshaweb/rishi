import { app } from "./http.js"
import { disconnect } from "./db.js"
const server = app.listen(
  Number(process.env.PORT || 3001),
  process.env.HOST || "127.0.0.1",
  () =>
    console.log(
      `Harshaweb API ready at http://127.0.0.1:${process.env.PORT || 3001}`
    )
)
async function stop() {
  server.close(async () => {
    await disconnect()
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10000).unref()
}
process.on("SIGINT", stop)
process.on("SIGTERM", stop)
