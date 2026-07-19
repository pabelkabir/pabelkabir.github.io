# Publications Workflow

This site uses `data/publications.bib` as the canonical seed and `data/publications.yml` for curated fields such as featured status, summaries, research area, and related links.

## Safe Google Scholar Handoff

1. The owner opens the public Google Scholar profile and corrects duplicates or incorrect entries there.
2. The owner exports selected or all profile entries in BibTeX format.
3. The export is saved as `data/google-scholar-export.bib`.
4. Run:

```bash
python scripts/build_publications.py
```

5. The script normalizes and deduplicates records, but it never silently deletes a curated item.
6. The generated output appears in `site/generated/publications.qmd` and `site/generated/publications.json`.
7. The owner reviews the generated diff before publication.

## Deduplication Rules

- Match normalized DOI first.
- If DOI is absent, match normalized title.
- Prefer peer-reviewed journal versions over preprints.
- Keep preprints as secondary links when useful.
- Keep theses separate from peer-reviewed journal articles.
- Keep software, datasets, protocols, and presentations outside peer-reviewed articles.
- Flag uncertain metadata instead of guessing.

## Display Rules

- Group by year, newest first.
- Bold Mohammad Pabel Kabir in author lists.
- Use DOI links as the default external link.
- Show legal open-access PDF, code, data, preprint, and supporting-information links only when verified.
- Do not display citation counts.
