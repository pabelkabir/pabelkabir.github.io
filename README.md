# Kabir Lab Website

This repository hosts the Kabir Lab website for `kabirlab.org`.

## Production Status

The design-reference V2 review build is live for `kabirlab.org` as of 2026-07-19 so the site owner can review it and suggest changes. The Quarto source renders to `docs/`, and the rendered output is mirrored at the repository root for GitHub Pages user-site compatibility.

## Source Layout

- `site/_quarto.yml` configures the Quarto website and renders to root-level `docs/`.
- `site/index.qmd`, `site/research/`, `site/publications/`, `site/people/`, `site/software/`, `site/join/`, and `site/contact/` are the public pages.
- `data/publications.bib` and `data/publications.yml` are the canonical publication seed and curation layer.
- `scripts/build_publications.py` generates `site/generated/publications.qmd` and `site/generated/publications.json`.
- `scripts/validate_content.py` checks rendered public files for placeholders, unverified contact content, missing image alt text, duplicate DOI values, and deployment safety.
- `CONTENT_NEEDED.md` tracks PI-supplied details that can be added after confirmation.

## Local Preview

Install Quarto, then run:

```bash
python scripts/build_publications.py
rm -rf docs
cd site
quarto render
cd ..
python scripts/validate_content.py
python scripts/check_rendered_links.py
python scripts/check_accessibility_static.py
```

Open `docs/index.html` or serve `docs/` with a local static server to preview the staged site.

## Publication Updates

See `PUBLICATIONS_WORKFLOW.md`. The safe update path is to export corrected Google Scholar entries as BibTeX into `data/google-scholar-export.bib`, run the publication generator, and review the generated diff before publishing.

## Deployment

See `DEPLOYMENT_MIGRATION.md`. Future content changes should be made in `site/`, rendered into `docs/`, mirrored to root, validated, committed, and pushed.
