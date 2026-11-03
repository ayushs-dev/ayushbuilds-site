# ayushbuilds.dev

Source for [ayushbuilds.dev](https://ayushbuilds.dev), a static site.

## Pipeline

1. Open a pull request. GitHub Actions (`.github/workflows/lint.yml`) validates the HTML with `html-validate`.
2. Merge to `main`. Cloudflare's GitHub integration builds and deploys the site automatically.

## Run locally

```bash
npx --yes serve .
```

## Lint locally

```bash
npx --yes html-validate@9 "*.html"
```
