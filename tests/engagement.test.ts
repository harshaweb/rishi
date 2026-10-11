import { describe, expect, it } from "vitest"
import {
  configuredVideos,
  videoSource,
  whatsappUrl,
} from "../shared/engagement"
import { siteSettingsSchema } from "../server/settings"
import { settings } from "../shared/content"

describe("Contact and video configuration", () => {
  it("normalizes supported video URLs without accepting arbitrary embeds", () => {
    expect(videoSource("https://youtu.be/abcdefghijk?t=10")?.src).toBe(
      "https://www.youtube-nocookie.com/embed/abcdefghijk?rel=0"
    )
    expect(videoSource("https://vimeo.com/123456789")?.src).toBe(
      "https://player.vimeo.com/video/123456789?dnt=1"
    )
    expect(videoSource("/videos/harshaweb-process.mp4")?.kind).toBe("file")
    for (const unsafe of [
      "javascript:alert(1)",
      "https://attacker.example/embed/abcdefghijk",
      "https://youtube.com.attacker.example/watch?v=abcdefghijk",
      "//attacker.example/x.mp4",
      "/videos/../private.mp4",
      "https://user:pass@youtube.com/watch?v=abcdefghijk",
    ])
      expect(videoSource(unsafe), unsafe).toBeNull()
  })
  it("rejects unsafe contact settings and accepts optional unconfigured channels", () => {
    expect(siteSettingsSchema.safeParse(settings).success).toBe(true)
    for (const invalid of [
      { bookingUrl: "javascript:alert(1)" },
      { whatsappPhone: "123" },
      { contactEmail: "bad" },
      { video2Url: "https://example.com/embed" },
      { linkedinUrl: "http://example.com" },
    ])
      expect(
        siteSettingsSchema.safeParse({ ...settings, ...invalid }).success
      ).toBe(false)
  })
  it("uses only configured videos with titles and constructs WhatsApp safely", () => {
    expect(configuredVideos(settings)).toHaveLength(1)
    expect(configuredVideos({ ...settings, video1Url: "" })).toHaveLength(0)
    expect(whatsappUrl("+91 (98765) 43210")).toContain(
      "https://wa.me/919876543210?"
    )
  })
})
