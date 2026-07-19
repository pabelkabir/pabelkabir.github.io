# Deployment Notes For Version 2

Version 2 was merged and deployed for `kabirlab.org` on 2026-07-19.

GitHub Pages is configured for the custom domain `kabirlab.org`. The Quarto source renders to `docs/`, and the rendered output is also mirrored at the repository root because GitHub Pages user-site repositories can serve root output even when the Pages API reports `/docs`.

## Current Source Layout

- Quarto source: `site/`
- Rendered build: `docs/`
- Live fallback mirror: repository root
- Custom domain file: `docs/CNAME` and root `CNAME`

## Update Workflow

1. Update source content in `site/`, `data/`, or the supporting scripts.
2. Rebuild publication pages:

```bash
python scripts/build_publications.py
```

3. Render a clean Quarto build:

```bash
rm -rf docs
cd site
quarto render
cd ..
```

4. Run validation:

```bash
python scripts/validate_content.py
python scripts/check_rendered_links.py
python scripts/check_accessibility_static.py
```

5. Mirror the rendered site to the repository root:

```bash
rsync -a docs/ ./
```

6. Commit and push to `master`.
7. Wait for GitHub Pages to rebuild, then verify:

```text
https://kabirlab.org
https://www.kabirlab.org
```

Enable `Enforce HTTPS` in GitHub Pages settings once GitHub has issued the certificate and the checkbox becomes available.
