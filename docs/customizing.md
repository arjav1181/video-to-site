# Customizing a generated site

> Agent version: see `skills/customize-site/SKILL.md`.

## Add real content

Open `src/app/page.tsx`. Content lives in plain arrays at the top —
`PROJECTS`, `SKILLS`, `EXPERIENCE`, `SOCIALS`. Replace the placeholders, update
the hero `<h1>` + tagline, point `mailto:` links at your email, set the tab
title in `src/app/layout.tsx`. Rebuild, done.

## Add a section

Copy the established pattern:

```tsx
<section className="relative z-10">
  <div className="mx-auto max-w-6xl px-5 py-24 md:py-40">
    <h2 className="reveal ...">Heading</h2>
    {/* ... */}
  </div>
</section>
```

- `relative z-10` floats above the fixed canvas.
- `reveal` (observed by the built-in IntersectionObserver) animates content in.
- Wrap grids in `stagger` for cascading delays.

## Demo videos on cards

Prefer MP4 over GIF (30fps, sharper, smaller):

```tsx
<video className="h-full w-full object-cover" autoPlay muted loop playsInline preload="metadata" poster="/demos/x-poster.jpg">
  <source src="/demos/x.mp4" type="video/mp4" />
</video>
```

## Swap fonts

`layout.tsx` uses `next/font/google`. Replace `Space_Grotesk` with any family —
weights flow through automatically. Keep one display + one mono face.

## Tune the animation

- **Speed/feel**: the `ease` constant in the `animate()` loop (0.18 default).
- **Quality**: canvas DPR comes from `getOptimalDPR()` — raise caps on desktop.
- **Frame count**: baked in as `FRAME_COUNT`; if you re-extract with different
  settings, update it (or regenerate with the CLI).

## Deploy

Push to GitHub → import in Vercel → deploy. Checklist from real breakages:

- Lockfile registry must be public (`registry.npmjs.org`, not a local mirror).
- Configs as `.js` CommonJS; `autoprefixer` in devDependencies.
- `bun run build` green locally first.
