# Demo audio assets

Phase 1 ships a short **original synthetic** instrumental bed:

```text
public/demo/instrumental.wav
```

It is generated locally (soft pad tones + pulse) and is not commercial copyrighted music.

## Transcript

Timed lyrics live in one place:

```text
src/data/demo-transcript.json
```

Imported via `src/data/demo-transcript.ts`.

## Replacing the audio

1. Use only audio you own or have permission to use.
2. Do **not** download copyrighted commercial music for this demo.
3. Replace `instrumental.wav`, or add `instrumental.mp3` and update `audioUrl` in `src/data/demo-transcript.json`.
4. A short 20–40 second instrumental is enough for Phase 1.

## Behavior without audio

If the audio file is removed, the karaoke player still loads.
Controls show a clear status message, and the seek bar can still scrub lyrics for inspection.

## Timing

The included transcript covers roughly 0–26.5 seconds of timed lyrics.
The synthetic bed is about 28 seconds long.
