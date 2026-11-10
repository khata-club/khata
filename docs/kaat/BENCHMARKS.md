# Kaat — performance benchmarks

Measured with `pnpm --filter @khata/kaat bench`. It builds the app, runs `e2e/perf.bench.ts`
in Chromium against the production build, and writes the raw numbers to
[`benchmarks.json`](./benchmarks.json).

## Environment for the numbers below

|         |                                                                                          |
| ------- | ---------------------------------------------------------------------------------------- |
| Browser | Playwright Chromium 1.63, headless                                                       |
| GPU     | **none**: WebGL2 runs on SwiftShader (software)                                          |
| CPU     | 4 vCPU cloud container                                                                   |
| Media   | generated fixtures: 1280×720 30 fps VP9/Opus WebM, WAV, PNG (`scripts/make-fixtures.sh`) |

Every GPU-bound number here (render, seek, export) is a pessimistic floor. Desktop Chrome on
real hardware has a hardware decoder and a GPU, and should be much faster. This environment
cannot measure real Mac or Windows hardware, 4K hardware decode, or H.264/AAC export. Those rows
are listed as open spikes at the end.

## Results (5 Nov 2026)

| Area                                                       | Spec target                          | Measured                                                          | Status                             |
| ---------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------- | ---------------------------------- |
| Startup, first load                                        | < 3 s cold                           | 565 ms                                                            | ✅                                 |
| Startup, reload (warm)                                     | < 1 s                                | 360 ms                                                            | ✅                                 |
| Import: asset visible                                      | < 500 ms                             | 31 ms (median of 3)                                               | ✅                                 |
| Import: metadata ready                                     | < 1 s                                | 59 ms                                                             | ✅                                 |
| Edit before preprocessing finishes                         | required                             | clips placed while thumbnails and waveforms are queued (e2e test) | ✅                                 |
| Random seek, request → frame shown                         | < 100 ms typical                     | median 78 ms, p95 116 ms (software GL)                            | ✅ median, p95 over on software GL |
| Scrub: 400 seeks at 60 Hz                                  | no runaway work                      | 197 frames rendered (latest-wins drops the rest)                  | ✅                                 |
| Scrub: memory                                              | flat                                 | JS heap 12.7 → 12.0 MB; GPU textures 154 MB with a 768 MB budget  | ✅ bounded                         |
| Playback, 30 fps project                                   | stable 30 fps                        | **30.0 fps, 0 dropped** over 5 s, A/V clock 4.96 s                | ✅                                 |
| Playback adaptation                                        | lower preview resolution when behind | auto stepped to 75% on software GL                                | ✅                                 |
| Timeline, 1,200 clips: scroll draw                         | 60 fps (< 16 ms)                     | p95 2.4 ms                                                        | ✅                                 |
| Timeline, 1,200 clips: zoom draw                           | < 16 ms                              | p95 0.4 ms                                                        | ✅                                 |
| Timeline, 1,200 clips: zoomed out with all visible         | < 16 ms                              | p95 6.4 ms (was 14.8 ms before the LOD change, see below)         | ✅                                 |
| Timeline, 1,200 clips: rAF interval while scrolling        | ~16.7 ms                             | p95 17.5 ms                                                       | ✅                                 |
| Edit commands on 1,200 clips (trim/move/split/ripple/undo) | < 16 ms                              | slowest 3.1 ms                                                    | ✅                                 |
| Open 1,200-clip project                                    |                                      | 734 ms                                                            | ✅                                 |
| 120-min project: autosave serialise (main thread)          | no visible pause                     | p95 13.7 ms, 0 long tasks > 50 ms, 620 KB project                 | ✅                                 |
| 120-min project: reload + restore                          |                                      | 907 ms                                                            | ✅                                 |
| Export, 8 s at 1280×720, VP9 + Opus                        | progressive, bounded memory          | 23.8 s (10 fps, 0.3× realtime) on software GL + software VP9      | ✅ correct, slow on this host      |

### Before/after for changes found by benchmarking

| Change                                                                                    | Before                                    | After               |
| ----------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------- |
| Render only when the playback frame number changes (rAF runs at 60 Hz, the project at 30) | 45.5 "fps" (duplicate frames), 69 dropped | 30.0 fps, 0 dropped |
| Timeline LOD: clips under 6 px draw as a plain bar                                        | 14.8 ms p95 with all 1,200 clips in view  | 6.4 ms p95          |

## How each number is taken

- **Seek**: 120 deterministic pseudo-random frame-aligned seeks, one at a time, timed from
  `transport.seek()` to the render worker's `frame` event for that exact time.
- **Scrub**: 4 sweeps of 100 seeks, one per animation frame, then render-worker texture stats and
  `performance.memory` (Chromium with `--enable-precise-memory-info`).
- **Playback**: 5 s from 0 s. FPS comes from presented-frame intervals. A frame is dropped when a
  newer play frame replaced one that was still pending.
- **Timeline**: the `timelineDrawMs` ring in telemetry while scrolling and zooming
  generated Benchmark D (`generateBenchmarkProject('D')`, 1,200 clips on 6 tracks).
- **Autosave**: main-thread serialise time over 5 edit → flush cycles on Benchmark E (120 min),
  with a `longtask` PerformanceObserver running.
- **Export**: wall time from the Export click to the download event.

## Standard benchmark projects (spec §42)

`@khata/kaat-core` generates synthetic, deterministic projects with `generateBenchmarkProject`:

| Id  | Contents                                                  | Used for                                                                                    |
| --- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| A   | 3 × 1080p clips, 1 audio track, text, a transition        | basic playback, seek, export. The bench uses an equivalent project built from real fixtures |
| B   | 100 clips, 3 audio tracks, overlays, text, colour effects | serialisation round-trip and timeline tests                                                 |
| C   | 4K sources, 3 visual layers, text, colour, transitions    | structure only; needs real 4K media (open spike)                                            |
| D   | 1,200 clips across 6 tracks                               | timeline scroll, zoom, edit, memory                                                         |
| E   | 120-minute sequence                                       | autosave, restore, seek on long timelines                                                   |

Synthetic assets have no source file, so they show as offline media. That's deliberate: these
projects measure the timeline, model and persistence paths in isolation.

## Open spikes (need real hardware or media)

These can't be measured honestly in a headless, GPU-less container. They need runs on the
baseline machines once those are chosen (spec §51, Q20):

1. **4K performance (spike 3)**: 3 simultaneous 4K layers, hardware decode, seek latency, and
   whether the proxy is needed. The proxy path itself works and is tested with a 1440p fixture.
2. **Large files (spike 2)**: 5 GB and 20 GB sources, and output larger than RAM. The design
   reads lazily (`BlobSource`) and writes progressively (`StreamTarget` straight to the file),
   but it hasn't been measured at those sizes.
3. **Variable frame rate (spike 4)**: real phone and screen recordings. Frame lookup uses
   decoded timestamps and durations, not a constant-rate assumption, but no real VFR footage has
   been tested yet.
4. **Export formats on Chrome stable (spike 1)**: MP4 H.264/AAC is only offered when both
   encoders are present. Playwright Chromium has H.264 but no AAC, so the tests use WebM
   VP9/Opus.
5. **Mac and Windows baselines**: pick the official baseline machines and record this table on
   them.
