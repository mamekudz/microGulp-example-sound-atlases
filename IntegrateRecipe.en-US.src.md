# IntegrateRecipe

Integrate this recipe into the selected web application or browser game. Inspect its audio lifecycle, module system, UI and i18x conventions first. Copy AtlasPlayer.mjs with its license, provide explicit JSON/audio URLs, and connect activation, playback, mute and cleanup to the existing UI. Reuse the application AudioContext only after deciding who owns and closes it: this player currently closes its context in Dispose(). Do not silently replace existing microLib Sounds calls; their callback API and filename derivation differ.

Inputs: target project path, target browsers, audio sources and their rights, configuration preferences, existing localization method. Read README.md, config.schema.json, src/AtlasPlayer.mjs, tools/Build.mjs and tests before changes. Verify the actual installed APIs; the recipe uses gulp-mu-gulp-api 0.7.0 and supports µGulp 1.1.1. Keep PascalCase public functions and underscore-prefixed parameters where the project uses them. Keep source prompts as en-US.src.md; additional translations remain deferred until final editorial approval. Preserve the independent RELEASES.json, validate configuration, reject out-of-range cues and prevent stale asynchronous loads from restoring old data. Do not publish, push or change unrelated projects. Report changes, tests, limitations and remaining decisions.

## Example project identity

Each standalone example uses microgulp.config.json with project.title (a distinct example name), project.description and project.logo. Bundle the provided µGulp logo inside each repository at assets/microgulp-logo.png. Merge existing settings; do not introduce absolute paths or a dependency on the parent checkout. Open the example as its own workspace: identity is workspace-wide, not per Gulp task. Verify it with the actual host API. Do not invent Gulpfile metadata; further translations remain deferred until completion.


## Audio semantics and measured evidence

Treat filename .ls.<sample>.le.<sample> markers as the build source for loop metadata. Infer playback looping from atlas JSON, play attack once, repeat only the loop, and explicitly stop to permit release. Preserve a force-stop path. Isolate complete loop cues to avoid leaking into the next atlas sound. Test repeated graceful stop, forced stop, stop during attack, cancellation, load failures and cleanup. Do not reintroduce a caller-supplied loop flag.

Read references/sources.json and references/README.md. Original microLib/FlyEx/Oxyd snapshots are reference material, not standalone runtimes or parallel editable masters. Preserve Dongleware notices; do not relabel Oxyd as MIT. Explain FlyEx state transitions with code and Unity DSP scheduling (AudioSettings.dspTime, PlayScheduled, SetScheduledEndTime) with actual source excerpts. Do not claim a Unity runtime test without executing it.

Always include concrete code examples for key steps. Compare identical sources as individual WAV, atlas WAV, individual WebA and atlas WebA; distinguish compression from request/decode-count effects. Record browser, network conditions, concurrency, cold/no-store policy, raw timings and PCM memory estimate. Never equate overlapping decode duration with CPU time, compressed bytes with PCM memory, or synthetic-network measurements with production performance. Keep additional translations deferred.

Verify matching decoded frame counts and cue alignment across WAV/WebA before publishing benchmark numbers. The example uses FFmpeg/libopus; do not substitute @audio/encode-webm 1.1.2 without checking its fixed 80 ms pre-skip and flushing.
