"""Build Harshaweb's original silent process video. Optional asset-authoring tool.

Requires Pillow and imageio-ffmpeg. These are not application runtime dependencies.
"""
from pathlib import Path
import math
import subprocess
import sys

root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root / ".data/video-tools"))
import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont

width, height, fps, duration = 960, 540, 24, 24
font_path = "C:/Windows/Fonts/segoeui.ttf"
bold_path = "C:/Windows/Fonts/segoeuib.ttf"
font = lambda size, bold=False: ImageFont.truetype(bold_path if bold else font_path, size)
slides = [
    ("YOUR NEXT CHAPTER", "From idea to launch.", "A clearer path to a dependable digital experience."),
    ("01 / DISCOVER", "Start with the right questions.", "Your audience. Your goals. Your constraints."),
    ("02 / DESIGN", "Make every interaction count.", "Clear structure. Thoughtful interfaces. Accessible experiences."),
    ("03 / BUILD", "Connect design and engineering.", "Reviewable stages. Dependable foundations."),
    ("04 / LAUNCH", "Ready for what comes next.", "Review. Document. Plan the next step."),
    ("LET'S BUILD YOUR NEXT CHAPTER", "Your idea starts a conversation.", "harshaweb.com  /  Discuss your project"),
]
out = root / "public/videos/harshaweb-process.mp4"
out.parent.mkdir(parents=True, exist_ok=True)
proc = subprocess.Popen([imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-f", "rawvideo", "-vcodec", "rawvideo", "-s", f"{width}x{height}", "-pix_fmt", "rgb24", "-r", str(fps), "-i", "-", "-an", "-vcodec", "libx264", "-crf", "23", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(out)], stdin=subprocess.PIPE, stderr=subprocess.DEVNULL)
for frame in range(duration * fps):
    t = frame / fps
    phase = t % 4
    index = min(int(t // 4), len(slides) - 1)
    fade = min(1.0, phase / .35, (4 - phase) / .35)
    image = Image.new("RGB", (width, height), "#0b1226")
    d = ImageDraw.Draw(image)
    for x in range(0, width, 48):
        d.line((x, 0, x, height), fill="#111c37")
    for y in range(0, height, 48):
        d.line((0, y, width, y), fill="#111c37")
    cx, cy = 815, 135
    for radius in [55, 85, 115]:
        d.ellipse((cx-radius, cy-radius, cx+radius, cy+radius), outline="#263c74", width=2)
    angle = t * .9
    px, py = cx + math.cos(angle)*85, cy + math.sin(angle)*85
    d.ellipse((px-7, py-7, px+7, py+7), fill="#7795ff")
    d.text((58, 35), "harshaweb.", font=font(25, True), fill="#ffffff")
    layer = Image.new("RGB", (width, height), "#0b1226")
    ld = ImageDraw.Draw(layer)
    offset = int((1-fade) * 12)
    ld.text((58, 198+offset), slides[index][0], font=font(15, True), fill="#809cff")
    ld.text((55, 244+offset), slides[index][1], font=font(39, True), fill="#ffffff")
    ld.text((58, 307+offset), slides[index][2], font=font(20), fill="#aab8d8")
    image.paste(Image.blend(Image.new("RGB", (width, height), "#0b1226"), layer, max(0, fade)).crop((40, 185, 950, 375)), (40, 185))
    d = ImageDraw.Draw(image)
    d.text((58, 454), "THOUGHTFUL DESIGN. DEPENDABLE ENGINEERING.", font=font(12), fill="#9babcc")
    d.rectangle((58, 495, 902, 498), fill="#253354")
    d.rectangle((58, 495, 58 + int(844 * frame / (duration*fps-1)), 498), fill="#557bff")
    proc.stdin.write(image.tobytes())
proc.stdin.close()
if proc.wait() != 0:
    raise SystemExit("Video encoding failed")
print(f"Created original 24-second video: {out.name} ({out.stat().st_size} bytes)")
