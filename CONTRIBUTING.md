# Contributing

## Setup

Requirements: Node.js 18+, ffmpeg + ffprobe.

```bash
git clone https://github.com/arjav1181/video-to-site.git
cd video-to-site
npm install   # or: bun install
```

## Workflow

```bash
npm run dev -- my-video.mp4 out-dir --no-install --no-build  # iterate via tsx
npm run check   # typecheck (tsc --noEmit)
npm run test    # vitest (unit + e2e; e2e needs ffmpeg)
npm run build   # compile to dist/
```

## Rules

- Keep runtime dependencies near zero (today: just `sharp`). New deps need
  justification in the PR.
- Every pure helper gets unit tests; pipeline changes get e2e coverage.
- Update `CHANGELOG.md` (Unreleased section) and `docs/` with behavior changes.
- `install.sh` must stay POSIX-shellcheck clean: `shellcheck -S warning install.sh`.
- The generated site template (`src/template/`, `src/scaffold.ts`) must keep
  building — e2e asserts scaffold output, add assertions for new files.
- Conventional commits preferred (`feat:`, `fix:`, `docs:`, `chore:`).
