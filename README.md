# Kabir Lab Website

This repository hosts the live Kabir Lab site at `kabirlab.org`.

## Production Status

Version 2 is live for `kabirlab.org`. The Quarto source lives in `site/`, renders to `docs/`, and the rendered output is also mirrored at the repository root so the GitHub Pages user-site repo serves the same V2 site regardless of whether Pages reads `/root` or `/docs`.

## Version 2 Source

- `site/_quarto.yml` configures the Quarto website and renders to root-level `docs/`.
- `site/index.qmd`, `site/research/`, `site/publications/`, `site/people/`, `site/software/`, `site/join/`, and `site/contact.qmd` are the public pages.
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
```

Open `docs/index.html` to preview the rendered site. To deploy in this user-site repository, mirror the rendered output to the repository root:

```bash
rsync -a docs/ ./
```

## Publication Updates

See `PUBLICATIONS_WORKFLOW.md`. The safe update path is to export corrected Google Scholar entries as BibTeX into `data/google-scholar-export.bib`, run the publication generator, and review the generated diff before publishing.

## Deployment

See `DEPLOYMENT_MIGRATION.md`. Current production uses the rendered V2 output, mirrored in both `docs/` and the repository root.
