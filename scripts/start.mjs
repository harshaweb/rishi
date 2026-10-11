import { app, disconnect } from "../dist-server/http.js"
const server = app.listen(
  Number(process.env.PORT || 3001),
  process.env.HOST || "127.0.0.1",
  () =>
    console.log(
      `Harshaweb server listening on port ${process.env.PORT || 3001}`
    )
)
function stop() {
  server.close(async () => {
    await disconnect()
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10000).unref()
}
process.on("SIGINT", stop)
process.on("SIGTERM", stop)
