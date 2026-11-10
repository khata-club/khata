#!/usr/bin/env bash
# Generate small, deterministic test media with ffmpeg (VP9/Opus WebM: headless Chromium lacks H.264).
set -euo pipefail
out="$(dirname "$0")/../e2e/fixtures"
mkdir -p "$out"
ff() { ffmpeg -hide_banner -loglevel error -y "$@"; }
[ -f "$out/clip-a.webm" ] || ff -f lavfi -i "testsrc2=size=1280x720:rate=30:duration=4" -f lavfi -i "sine=frequency=440:duration=4:sample_rate=48000" \
  -c:v libvpx-vp9 -b:v 1M -g 30 -deadline realtime -cpu-used 8 -c:a libopus -b:a 96k -shortest "$out/clip-a.webm"
[ -f "$out/clip-b.webm" ] || ff -f lavfi -i "smptebars=size=1280x720:rate=30:duration=4" -f lavfi -i "sine=frequency=660:duration=4:sample_rate=48000" \
  -c:v libvpx-vp9 -b:v 1M -g 30 -deadline realtime -cpu-used 8 -c:a libopus -b:a 96k -shortest "$out/clip-b.webm"
[ -f "$out/clip-1440.webm" ] || ff -f lavfi -i "testsrc=size=2560x1440:rate=30:duration=2" \
  -c:v libvpx-vp9 -b:v 2M -g 30 -deadline realtime -cpu-used 8 -an "$out/clip-1440.webm"
[ -f "$out/tone.wav" ] || ff -f lavfi -i "sine=frequency=220:duration=3:sample_rate=48000" -ac 2 "$out/tone.wav"
[ -f "$out/still.png" ] || ff -f lavfi -i "color=c=0x2457d6:size=640x360,drawbox=x=40:y=40:w=200:h=120:color=white:t=fill" -frames:v 1 "$out/still.png"
[ -f "$out/not-media.txt" ] || echo "hello" > "$out/not-media.txt"
ls -la "$out"
