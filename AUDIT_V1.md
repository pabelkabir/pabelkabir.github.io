# Audit Of Current Production Site

Date: 2026-07-19  
Repository: `pabelkabir/pabelkabir.github.io`  
Base branch: `master` at `953966f40526940cb283d6e32bfac4b491e343c9`

## Current State

- The repository currently contains a live Kabir Lab site at the root and a Quarto-rendered site in `docs/`.
- Root production files are intentionally preserved by this review branch.
- The root `CNAME` contains exactly `kabirlab.org`.
- The Quarto source lives in `site/`, with publication data in `data/` and validation helpers in `scripts/`.
- The newest supplied specification asks for a staged review branch and no deployment, merge, GitHub Pages settings change, or DNS change.

## Main Gaps Against The New Brief

- Several research-topic pages used `.html` output paths rather than stable directory URLs.
- Research explanations needed more Gozem-style scientific prose: question, overview, methods, systems, evidence, and related workflows.
- The homepage needed stronger evidence links under the three research pillars and complete author metadata for featured publications.
- The People page needed a clearer principal-investigator profile, recruitment focus, and no empty student/alumni/collaborator placeholders.
- The Join page needed explicit categories for Savannah State undergraduates, external collaborators, graduate/postdoc paths, and research collaborators.
- The deployment notes needed to distinguish this review branch from actual production deployment.

## Reference Comparison

| Reference site | Useful pattern adopted | Pattern intentionally not copied | Kabir Lab implementation |
| --- | --- | --- | --- |
| Acharya Lab | Compact academic homepage, visible research topics, team/resources/openings structure | Google Sites layout, wording, images, gallery, colors, and news-first emphasis | Original Kabir Lab homepage with research before news, PI profile, resources page, and explicit recruitment guidance |
| Gozem Group | Conventional multi-page academic architecture and substantive research explanations | Source code, text, images, logos, publication styling, and visual identity | Original Quarto structure with dedicated research pages, generated publications, and restrained Kabir Lab visual system |

No source code, wording, images, logos, colors, or distinctive visual styling from either reference site is copied.

## Production Preservation Check

This review branch stages changes in Quarto source and `docs/`. It does not mirror the rendered output to the repository root, does not push to `master`, and does not change GitHub Pages, DNS, CNAME, or HTTPS settings.
