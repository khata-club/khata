# Kaat: browser-only video editor, product specification (summary)

Condensed from the engineering grooming specification. Section numbers (§) match the original.

## Goal (§1–2)

Build the best professional video editor technically possible in **latest desktop Chrome**, with
**no backend**. All import, analysis, preview, editing, persistence and export happen on the user's
device, and keep working offline once the app has loaded.

P0 principles:

- **Performance is a core requirement.** Fast startup, import, seeking, scrubbing, timeline
  interaction and playback; bounded memory; efficient export; background work never interrupts
  editing.
- **User media never leaves the device.**
- **Editing starts before preprocessing finishes.** Drop a file, read minimum metadata, show the
  asset, allow placement and editing, and do the rest in the background.
- **Expensive work never blocks interaction.**
- **Work is prioritised around what the user is doing:** playhead (critical) → visible timeline
  (high) → nearby (medium) → rest of project (low) → analysis (idle). Interaction can cancel or
  deprioritise background work.

## Platform (§3)

Latest stable desktop Chrome on macOS and Windows. Other browsers and mobile are non-goals.

## Performance targets (§4)

| Area                 | Target                                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Warm / cold startup  | < 1 s / < 3 s to an interactive shell                                                                                       |
| Import               | asset visible < 500 ms, metadata < 1 s, placeable before thumbnails exist                                                   |
| Timeline interaction | 60 fps drag, trim, playhead, scroll, zoom, select, and no slowdown as projects grow                                         |
| Interaction latency  | < 16 ms; no UI task > 50 ms during normal editing                                                                           |
| Playback             | 1080p at a stable 30 fps (60 where possible), no A/V drift; 4K where hardware allows, reducing preview resolution if needed |
| Scrubbing            | visible response < 100 ms                                                                                                   |
| Memory               | bounded; never proportional to duration, frame count, seek count or previews                                                |

## MVP scope (§5)

- **Media:** local video, audio and images; multi-file drag and drop; metadata; missing-source
  detection; relinking; import progress.
- **Timeline:** multiple video and audio tracks; place, move, trim start/end, split, delete,
  ripple delete, snapping, linked A/V, scroll, zoom, playhead, markers, in/out points.
- **Video properties:** position, scale, rotation, opacity, crop, layer order.
- **Audio:** multi-track playback, gain, mute, solo, fade in/out, waveforms, master level.
- **Text:** content, font family, size, weight, alignment, colour, position, scale, rotation,
  opacity, animation.
- **Animation:** keyframes on position, scale, rotation and opacity, with linear and hold
  interpolation.
- **Transitions (§30):** dissolve, slide, wipe, fade through colour; adjustable duration.
- **Playback:** play, pause, seek, scrub, previous/next frame, reverse/forward shuttle, loop range.
- **Persistence:** automatic local save, restore after reload or browser restart, project
  export/import, relinking.
- **Export:** a broadly compatible format; resolution, frame rate, quality and audio-quality
  choices; progress, cancellation, saved locally.

Non-goals (§6): accounts, cloud, collaboration, server rendering or transcoding, mobile, other
browsers, generative video, plugin marketplace.

## Architecture requirements

- **Project model (§8) independent of the UI:** Project → Settings, Assets, Sequences → Tracks →
  Clips (timing, transform, effects, animation) and Markers.
- **Time (§9):** deterministic integer or rational units, never floating-point seconds. Preview
  and export interpret time identically.
- **Commands (§10):** every edit is a discrete command with apply, undo and redo. This is the
  foundation for autosave and recovery.
- **Import (§11):** never copy multi-GB files into memory; never modify originals; clear errors
  for unsupported media.
- **Playback (§12–13):** independent of UI frame rate; stale requests cancelled or ignored; smart
  seeking (decode from the nearest keyframe, keep nearby frames); no leaks from repeated
  scrubbing.
- **Composition (§14):** one pipeline (tracks → clips → source time → transforms → animation →
  effects → composite) drives both preview and export.
- **Timeline (§15–18):** usable at 1,000+ clips; virtualised, so only visible content costs
  anything; thumbnails and waveforms are asynchronous, prioritised, cached and zoom-aware.
- **Scheduling (§19):** user interaction always wins over background work.
- **Persistence (§20–23):** asynchronous, frequent autosave with no visible pauses; crash
  recovery; a missing source never destroys edits; versioned, migratable project files.
- **Proxies (§24):** lower-cost editing copies for difficult media, built without blocking editing.
  Export uses the originals.
- **Adaptation (§25–27):** monitor render/decode time, dropped frames and memory; lower preview
  quality to keep playback smooth; render full quality when paused. Quality modes: Auto, Full,
  Medium, Low. Every cache has an explicit limit.
- **Export (§32–35):** deterministic and independent of realtime; written progressively to disk;
  output may be larger than memory; cancellation frees resources and removes partial output.
- **Storage pressure (§36):** critical data (project, autosave) is never evicted; rebuildable
  data (thumbnails, waveforms, proxies, temp output) is evicted first. Source files are never
  deleted.
- **Offline (§38):** editing, playback, autosave, restore and export need no network.
- **Errors (§39):** categorised (UNSUPPORTED_MEDIA, DECODE_FAILED, RENDER_FAILED, SOURCE_MISSING,
  SOURCE_PERMISSION_LOST, OUT_OF_MEMORY, OUT_OF_STORAGE, EXPORT_FAILED, ANALYSIS_FAILED). Each
  message answers: what failed, is my project safe, is my media safe, what next.
- **Diagnostics (§40):** an internal panel showing FPS, dropped frames, decode and render
  latency, preview quality, active frames, cache hit rate, queues, storage, memory and recent
  errors.

## Quality bar (§41–49)

- Performance-sensitive changes carry before/after measurements.
- Benchmark projects A–E.
- Unit tests for timeline maths, trim, ripple, snapping, time conversion, interpolation,
  undo/redo, serialisation and migration.
- Integration tests for import → timeline → preview → export, save/reload, relink and A/V sync.
- Visual regression tests at fixed timestamps.
- MVP release gate (§48): open, drop 1080p and 4K files, edit before processing finishes,
  multi-track editing, scrub, synchronised playback, trim, split, move, ripple delete, text,
  transform, animation, transition, close, reopen, restore, relink, export, with media never
  leaving the device.
- Performance gate (§49): smooth 1080p, responsive drag/trim, a navigable 1,000-clip timeline,
  no freezes from import, thumbnails, waveforms or autosave, flat memory under scrubbing and
  export, and 4K that degrades gracefully.
