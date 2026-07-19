# Kabir Lab Website

This repository hosts the live Kabir Lab site at `kabirlab.org`.

## Production Status

The current production site is still served from the repository root. Version 2 is staged as Quarto source and a rendered preview in `docs/` on the `codex/site-v2` branch. Do not switch GitHub Pages from `/root` to `/docs` until the review checklist is complete.

## Version 2 Source

- `site/_quarto.yml` configures the Quarto website and renders to root-level `docs/`.
- `site/index.qmd`, `site/research/`, `site/publications/`, `site/people/`, `site/software/`, `site/join/`, and `site/contact.qmd` are the public pages.
- `data/publications.bib` and `data/publications.yml` are the canonical publication seed and curation layer.
- `scripts/build_publications.py` generates `site/generated/publications.qmd` and `site/generated/publications.json`.
- `scripts/validate_content.py` checks rendered public files for placeholders, unverified contact content, missing image alt text, duplicate DOI values, and deployment safety.
- `CONTENT_NEEDED.md` tracks PI-supplied details needed before final public launch.

## Local Preview

Install Quarto, then run:

```bash
python scripts/build_publications.py
rm -rf docs
cd site
quarto render
cd ..
python scripts/validate_content.py
```

Open `docs/index.html` to preview the rendered site.

## Publication Updates

See `PUBLICATIONS_WORKFLOW.md`. The safe update path is to export corrected Google Scholar entries as BibTeX into `data/google-scholar-export.bib`, run the publication generator, and review the generated diff before publishing.

## Deployment

See `DEPLOYMENT_MIGRATION.md`. The short version is: review the V2 branch, merge only after content is verified, then manually change GitHub Pages from `/root` to `/docs`.
