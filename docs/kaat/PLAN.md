# Kaat — browser-only video editor: build plan

> Status (5 Nov 2026): milestones 0–12 are built and on `develop`. See **As built** and
> **Grooming answers** at the end, and [`BENCHMARKS.md`](./BENCHMARKS.md) for measurements.

## Context

The spec asks for a professional video editor that runs entirely in desktop Chrome with no backend. Everything stays on the user's device: import, preview, analysis, persistence and export. Performance and bounded memory are acceptance criteria, not polish to add later.

It is built in the `khata-club/khata` monorepo (on `origin/develop`): pnpm + Turbo, Vue 3 + Vite 8, TypeScript 6, and `@khata/ui` (the Calm Kit: Tailwind v4, Reka UI, Lucide, Storybook, vitest). The app consumes `@khata/ui` the same way `apps/web` does. My local `develop` was behind `origin/develop`, so step 0 is a fast-forward.

**Name: Kaat** (काट, "cut"). It follows the naming style of Dak and Khata.

| Path                 | Package            | Role                                                                                                                                                                                                             |
| -------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/kaat`          | `@khata/kaat`      | Vue 3 editor app: shell, panels, canvas timeline, preview, workers, service worker                                                                                                                               |
| `packages/kaat-core` | `@khata/kaat-core` | Pure TS with no DOM: time model, project schema, commands, undo/redo, the composition resolver shared by preview and export, keyframes, audio mix model, scheduler, LRU caches, migrations, benchmark generators |
| `packages/ui`        | `@khata/ui`        | New dense editor components, each with stories and tests: `KSlider`, `KNumberField` (drag-to-scrub), `KColorField`, `KKbd`, `KSplitter` (Reka Splitter)                                                          |

Docs go in `docs/kaat/PLAN.md` (this plan), `docs/kaat/product-spec.md` (the spec) and `docs/kaat/BENCHMARKS.md`.

## Locked technical decisions

- **Media I/O: Mediabunny** (MPL-2.0, zero-dependency, built on WebCodecs). It handles demuxing and decoding (`Input` + `BlobSource` over `File`, which reads lazily so multi-GB files are never fully loaded) and muxing to MP4/WebM through `StreamTarget`.
- **Time: integer ticks at 1 tick = 1/705,600,000 s** (flicks). Every common frame rate (23.976 as a rational, 24, 25, 30, 50, 60, 120) and the 44.1/48 kHz sample rates divide evenly. Numbers stay safe up to about 147 days. Frame rates are rationals `{num, den}`. Floating-point seconds appear only at the API edges (WebCodecs µs and WebAudio seconds), converted by one module.
- **Threads.** The main thread holds the UI only. A **render worker** owns an `OffscreenCanvas` (via `transferControlToOffscreen`), the WebGL2 compositor and the per-asset decoders, so `VideoFrame`s never cross threads during preview. A **media worker pool** (2–4 workers) handles metadata, thumbnails, waveforms and proxies. An **export worker** runs the same compositor module against its own canvas. Messaging uses typed `postMessage` RPC with request IDs and cancellation.
- **Compositor: WebGL2.** Per layer it applies transform, crop and opacity. Effects are shaders: color adjust (brightness, contrast, saturation) and blur. Transitions are dissolve, slide, wipe and fade through color. Text is rasterised with an OffscreenCanvas 2D context into a texture, cached by text-props hash, with fonts loaded in the worker through `self.fonts`. Preview and export both call `resolveFrame(project, tick) → RenderList` from kaat-core, so there is one interpretation of the project.
- **Audio.** Preview uses one `AudioContext`, which is also the master clock: video follows `ctx.currentTime`. Each clip is decoded in chunks via Mediabunny `AudioBufferSink` and scheduled as `AudioBufferSourceNode → Gain (clip gain + fade automation) → track gain (mute/solo) → master`. The gain curves come from the kaat-core mix model. Export renders 10 s windows with `OfflineAudioContext` built from the same graph-builder, which bounds memory and keeps the mix equivalent to preview.
- **Export.** The export worker steps through output frames by tick and runs resolve → decode → composite → `VideoSampleSource`/`AudioBufferSource` → Mediabunny `Output`. The output is a `StreamTarget` that writes to a `FileSystemWritableFileStream` from `showSaveFilePicker`, so data is written progressively and memory stays bounded. The default is **MP4 H.264 + AAC**. **WebM VP9 + Opus** is used where `isConfigSupported` rejects H.264/AAC, which includes headless Chromium in tests. Options: resolution, frame rate, quality preset or manual bitrate, and audio bitrate. Progress and cancellation are supported. Cancelling aborts the writable stream, so the partial file is discarded.
- **Seeking.** One decoder session per asset in the render worker. Mediabunny finds the nearest prior keyframe and decodes forward to the target. A frame cache keeps a byte-bounded LRU of `VideoFrame`s per asset and closes each frame on eviction. A generation counter drops stale requests. While scrubbing, each asset has at most one decode in flight plus the latest pending target, and intermediate targets are coalesced. For decode-ahead during playback, an iterator runs about 1 s ahead. Reverse shuttle decodes a GOP forward into the cache and shows it backwards, also bounded.
- **Timeline UI: one `<canvas>`** redrawn by rAF only when dirty. Track headers are DOM built from `@khata/ui`. Each track keeps clips sorted by start, so visible clips are found by binary search, which keeps the cost proportional to the viewport rather than to project size. Hit-testing works the same way. During a drag, the preview state lives in a plain object outside Vue reactivity, and one command is committed on pointerup. Thumbnails and waveforms draw from caches at a zoom-appropriate level of detail. The playhead and timecode update by direct canvas or DOM writes and never pass through Vue state.
- **State.** The kaat-core `ProjectStore` holds immutable project snapshots, a command stack (apply, invert, merge for continuous drags) and an event emitter. Vue sees a `shallowRef(version)` plus selectors, and the inspector re-renders only for its selected clip.
- **Scheduler** (kaat-core, also used inside the workers). Priority levels are CRITICAL, HIGH, MEDIUM, LOW and IDLE. Tasks carry abort signals. Visible-range changes re-prioritise the queue. IDLE and LOW work pauses during playback and scrubbing. Thumbnail and waveform tasks are keyed so the same work is never generated twice.
- **Adaptive preview.** Quality modes are Auto, Full, ½ and ¼. Auto watches render and decode time and dropped frames, then steps resolution down and throttles background work. On pause it re-renders the frame at full quality. Users can override it.
- **Proxies.** A proxy is recommended when a source is above 1080p or above 60 fps, or when a decode benchmark comes in slower than realtime. Proxy creation is a background Mediabunny `Conversion` to 540p in the media worker, and the result is written to OPFS. Preview uses the proxy when one is ready. Export always uses the original.
- **Persistence.** IndexedDB stores projects, preferences, autosave slots and the `FileSystemFileHandle` of each source, taken via `DataTransferItem.getAsFileSystemHandle()` so media is never copied. OPFS stores rebuildable caches: waveform peaks, thumbnail strips and proxies. Autosave is debounced at 750 ms after a command and written in `requestIdleCallback`, alternating between two A/B slots with a checksum. Restore loads the last good slot. If a source handle has lost permission, the user gets a "Reconnect media" gesture button. If a source is missing, its clips are marked offline but keep their edits, and a relink picker matches files by name, size and duration. Project files are exported and imported as a versioned `.kaat.json`, migrated on load by a chain in kaat-core.
- **Storage pressure.** `navigator.storage.estimate()` plus `persist()`. The cache store classifies entries as critical or rebuildable and evicts rebuildable ones LRU first. If space is still short, a warning is shown. Original files are never deleted.
- **Offline.** A small Vite plugin writes a precache manifest, and a hand-rolled service worker serves the app cache-first. The app makes no network calls after load, and fonts are self-hosted by `@khata/ui`.
- **Capability gate.** On boot the app checks WebCodecs, OffscreenCanvas + WebGL2, File System Access, OPFS, AudioWorklet, and codec support via `isConfigSupported`. A browser missing any of these gets a clear unsupported screen.
- **Errors.** A typed `KaatError` with the codes from §39, each mapped to copy that answers what failed, whether the project is safe, whether the media is safe, and what to do next. Errors are shown in a toast stack built from `KAlert`.
- **Diagnostics panel** (`Ctrl+Shift+D`). Shows FPS, dropped frames, decode and render latency at p50 and p95, quality level, live `VideoFrame` count, cache hit rate, queue depths, storage use, `performance.memory`, and recent errors.
- **Look.** Calm Kit light chrome with small control sizes, and a dark preview stage only. The workspace follows §7, with resizable panels from `KSplitter`.

## Delivery: commits on `develop` by milestone (pushed to `origin/develop`)

0. **Workspace.** Fast-forward `develop`. Scaffold `apps/kaat` and `packages/kaat-core` (vitest), add Mediabunny, and add the turbo, eslint and prettier wiring and the docs.
1. **Core engine (kaat-core) with unit tests.** Ticks and rationals, the schema (Project → Settings, Assets, Sequences → Tracks → Clips with timing, transform, effects and keyframes, plus Markers), and the commands: AddClip, MoveClip, TrimStart, TrimEnd, Split, Delete, RippleDelete, SetProps, Add/Update/RemoveKeyframe, Add/RemoveEffect, Add/RemoveTransition, track operations and markers. Also undo/redo, snapping, linked A/V, the keyframe interpolators (linear and hold), `resolveFrame`, the mix model, serialization and migration, LRU/byte-bounded caches, the scheduler, and benchmark generators for projects A–E.
2. **UI kit additions.** `KSlider`, `KNumberField`, `KColorField`, `KKbd` and `KSplitter` in `packages/ui`, each with stories and tests.
3. **Shell, capability gate, service worker, diagnostics and worker RPC.**
4. **Import.** Drag/drop and the file picker. Assets appear in under 500 ms using a placeholder plus a fast metadata probe in the media worker. Validation and `UNSUPPORTED_MEDIA`. Background thumbnail and waveform jobs.
5. **Render worker.** Decoder sessions, seeking, the frame cache, the WebGL compositor (layers, transform, crop, opacity, order) and the preview canvas.
6. **Playback.** The AudioContext clock, decode-ahead, play/pause, frame step, J/K/L shuttle, loop range, multi-track audio mixing and adaptive quality.
7. **Timeline.** Canvas tracks, virtualization, zoom and scroll, selection, drag, trim, split, ripple, snapping, markers, in/out, mute/solo/lock, plus thumbnails and waveforms at level of detail.
8. **Inspector and creative tools.** Transform and crop, text layers, keyframe controls (with diamonds on clips), effects and transitions.
9. **Persistence.** Autosave, recovery, relink, and project export/import.
10. **Export.** The dialog, the export worker, progressive writes, progress, cancel and the format fallback.
11. **Proxies, storage pressure and the error-copy pass.**
12. **Tests and benchmarks.** Playwright integration tests and the benchmark runner, with results written into `BENCHMARKS.md`.

## Verification

- `pnpm lint`, `format:check`, `typecheck`, `test` and `build` must be green after every milestone.
- **kaat-core unit tests** cover time math, trim, ripple, snapping, interpolation, undo/redo, serialization round-trips and migration.
- **Playwright with the preinstalled Chromium** runs against `vite preview`. Fixtures are generated with `ffmpeg` (VP9/Opus WebM plus a PNG, since headless Chromium has no H.264). The tests cover: import shows the asset → placed on the timeline → preview frame rendered; split, trim, ripple and undo; reload restores the project; a revoked or missing file is offline and then relinked; export produces a file that `ffprobe` reports with the expected duration and streams; and the service worker serves the app offline (`context.setOffline(true)`).
- **Visual regression.** A fixed project rendered at fixed ticks through the render worker is compared to golden PNGs with a tolerance. Covers transform, text, effects, transitions and keyframes.
- **Benchmarks.** Generated projects A–E (including 1,200 clips and a 120-minute timeline) are measured for timeline frame time while scrolling, zooming and dragging (target p95 < 16 ms), seek latency (median and p95), heap growth after 500 random seeks (it should stay flat), autosave duration, and export memory. Numbers go in `docs/kaat/BENCHMARKS.md`.
- **Privacy.** A Playwright test asserts that no network requests occur after load during import, edit and export.

Hardware-specific 4K measurements and real phone VFR footage need real Macs and Windows machines, so they are listed in `BENCHMARKS.md` as open spike items rather than claimed.

## As built: deviations from the plan

- **Audio decodes in the media worker as Float32 PCM.** `AudioBuffer` and WebAudio don't exist
  in workers. Preview turns the PCM into `AudioBuffer`s on the main thread and schedules them on
  the AudioContext clock. Export mixes with the pure-TS `mixBlock` in kaat-core, which reads the
  same gain model (`clipGainAt`) as the preview's WebAudio automation, instead of using
  `OfflineAudioContext`.
- **Textures, not decoded frames, are cached.** Each decoded `VideoSample` is uploaded to a
  WebGL texture and closed right away, so hardware decoder pools never stall. Sources larger
  than the preview canvas are downscaled on upload (4K → preview size), which bounds VRAM.
- **MP4 is offered only when both H.264 and AAC encode.** Otherwise export uses WebM VP9/Opus,
  so audio is never silently dropped. This is the case in Playwright Chromium.
- **The export worker is created per export and terminated afterwards.** Cancelling or
  finishing frees every decoder, encoder and texture it held.
- **Text keyframes are on the clip** like any layer. Text is rasterised at bucketed scales
  (0.25–4×), so animated scale doesn't re-rasterise every frame.

## Grooming answers (spec §51)

These are the defaults built in. Each can be revisited.

| #     | Question                                  | Answer as built                                                                                                                                                                                                 |
| ----- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1–2   | Minimum Mac / Windows hardware            | Any machine with current desktop Chrome, WebCodecs and WebGL2 (enforced by the capability gate). Official minimums wait on the baseline-machine runs (see BENCHMARKS open spikes).                              |
| 3     | 4K: guarantee or best-effort?             | Best-effort. Preview adapts resolution, proxies are recommended for > 1080p, and export is always full quality.                                                                                                 |
| 4–5   | Project length                            | Ticks are exact to ~147 days. Tested: 120-minute Benchmark E (autosave 14 ms p95, restore < 1 s).                                                                                                               |
| 6     | Largest tested source                     | The design streams via `BlobSource`; 5/20 GB runs are an open spike.                                                                                                                                            |
| 7     | Mandatory source formats                  | Whatever Chrome's WebCodecs decodes in MP4/MOV/WebM/MKV/MPEG-TS, MP3/WAV/FLAC/OGG/AAC, and PNG/JPEG/WebP/GIF/AVIF. Undecodable codecs get UNSUPPORTED_MEDIA at import.                                          |
| 8     | Mandatory export format                   | MP4 (H.264 + AAC) where both encoders exist, otherwise WebM (VP9 + Opus).                                                                                                                                       |
| 9     | Source becomes unavailable                | The asset goes offline, its clips stay with every edit, they render empty, and relink works by picker or drop (name/size match).                                                                                |
| 10    | Storage full                              | Evict exports temp → waveform cache → proxies (oldest first), keep the project, then warn (OUT_OF_STORAGE / SAVE_FAILED copy).                                                                                  |
| 11–12 | When are proxies made, and automatically? | Recommended automatically for > 1.2× 1080p pixels or > 61 fps, built on one click (`prefs.autoProxy` enables automatic builds). Builds run at LOW priority and pause during playback.                           |
| 13–14 | Adaptation aggressiveness / override      | Auto steps 1 → 0.75 → 0.5 → 0.33 → 0.25 when p75 frame time exceeds 90% of the frame budget, and steps back up after 3 s below 45%. A still frame is always full quality. Users can pick Full / Half / Quarter. |
| 15    | Decoded-frame cache size                  | Texture budget = clamp(deviceMemory × 48 MB, 192 MB, 768 MB); thumbnails 96 MB; audio blocks 256 MB.                                                                                                            |
| 16    | Detecting memory pressure                 | Budgets are fixed and bounded up front; `performance.memory` and render stats show in diagnostics; `trimMemory()` clears rebuildable caches.                                                                    |
| 17    | Background prioritisation                 | `PriorityScheduler`: thumbnails for the visible range HIGH, re-queued LOW when out of view; waveforms MEDIUM; proxies LOW; benchmarks IDLE; everything below HIGH paused during playback.                       |
| 18    | 4K seek latency target                    | Proposed < 150 ms with hardware decode, < 100 ms with a proxy. To be measured (open spike).                                                                                                                     |
| 19    | Machine can't sustain realtime            | Auto quality steps down; frames are dropped (latest-wins), never queued; the audio clock keeps sync.                                                                                                            |
| 20    | Official baseline machine                 | To be chosen; the bench script is ready to run on it.                                                                                                                                                           |

## Running it

```bash
pnpm --filter @khata/kaat dev        # http://localhost:5174
pnpm --filter @khata/kaat e2e        # build + Playwright end-to-end suite (needs ffmpeg for fixtures)
pnpm --filter @khata/kaat bench      # build + benchmarks → docs/kaat/benchmarks.json
UPDATE_GOLDEN=1 pnpm --filter @khata/kaat e2e   # refresh visual-regression goldens after intended changes
```
