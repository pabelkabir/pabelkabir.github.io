# Deployment Notes

The design-reference V2 review build was brought live for owner review on 2026-07-19. No DNS changes were made.

## Current Layout

- Quarto source: `site/`
- Rendered build: `docs/`
- Live root mirror: repository root
- GitHub Pages custom domain: `kabirlab.org`
- Root `CNAME` and `docs/CNAME` contain:

```text
kabirlab.org
```

## Review Steps

1. Inspect the live site at `kabirlab.org`.
2. Review the rendered `docs/` site and screenshots if local comparison is needed.
3. Review `CONTENT_NEEDED.md` for unresolved identity, people, opportunities, and publication-link items.
4. Confirm that no unverified News, Gallery, Alumni, Collaborators, domain email, office room, phone number, or private repository content is rendered.
5. Send suggested changes before considering the review complete.

## Update Workflow

1. Update source content in `site/`, `data/`, or supporting scripts.
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

5. Mirror the rendered site to root:

```bash
rsync -a docs/ ./
```

6. Commit and push to `master`.
7. Wait for Pages to rebuild, then verify the homepage, research pages, publications, people, software/resources, join, contact, sitemap, and 404 page.

Enable `Enforce HTTPS` only when GitHub has issued the certificate and the checkbox is available.
