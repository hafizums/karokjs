# KaroksJS

Browser karaoke app with a mock create flow (Phase 3A) and an optional real
processing pipeline (Phase 3B alpha).

## Run

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

- Create: [http://localhost:3000/create](http://localhost:3000/create)
- Demo player: [http://localhost:3000/karaoke/demo](http://localhost:3000/karaoke/demo)
- Demo editor: [http://localhost:3000/karaoke/demo/edit](http://localhost:3000/karaoke/demo/edit)
- Generated result editor: [http://localhost:3000/karaoke/result/edit](http://localhost:3000/karaoke/result/edit)

## Environment

Copy `.env.local.example` to `.env.local`. Defaults to mock processing.

```env
KAROKS_PROCESSING_MODE=mock
WAVESPEED_API_KEY=
ELEVENLABS_API_KEY=
KAROKS_JOB_SIGNING_SECRET=
```

Set `KAROKS_PROCESSING_MODE=real` and fill all secrets to enable WaveSpeed +
ElevenLabs. Keys never use `NEXT_PUBLIC_`. Real mode is an internal alpha until
auth, rate limits, and spend protection exist.

## Test & build

```bash
npm run lint
npm test
npm run build
```

Automated tests never contact real providers.

## Demo assets

- Audio: `public/demo/instrumental.wav` (see `public/demo/README.md`)
- Transcript (single source of truth): `src/data/demo-transcript.json`
- Local demo draft key: `karoks:demo-draft:v1`
- Generated results: IndexedDB `karoks-generated-result` (instrumental + transcript only)
