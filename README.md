# ayushbuilds.dev

Source for [ayushbuilds.dev](https://ayushbuilds.dev), a static site.

## Pipeline

1. Open a pull request. GitHub Actions (`.github/workflows/lint.yml`) validates the HTML with `html-validate`.
2. Merge to `main`. Cloudflare's GitHub integration builds and deploys the site automatically.

## Run locally

```bash
npx --yes serve public
```

## Lint locally

```bash
npx --yes html-validate@9 "public/**/*.html"
```

## Layout

- `public/` holds the site files that get uploaded: `index.html` (home), `projects/` (one page per project) and `assets/` (shared CSS and JS).
- `wrangler.jsonc` tells Cloudflare the Worker name and that `public/` is the static assets directory.

## 3D prototype

`public/lab/rover.html` is an unlisted prototype (`noindex`) of a 3D rover tour. It runs without a build step: `public/assets/rover.js` imports a tree-shaken, minified Three.js bundle from `public/assets/vendor/`.

Rebuild that bundle after changing `scripts/three-lite.js` or upgrading Three.js:

```bash
./scripts/build-vendor.sh
```

This is a local step only; Cloudflare just serves the files in `public/`. Three.js is MIT licensed (`public/assets/vendor/three.LICENSE`).
