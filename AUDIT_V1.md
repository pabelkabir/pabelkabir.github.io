# Audit Of Current Production Site

Date: 2026-07-19  
Repository: `pabelkabir/pabelkabir.github.io`  
Base branch: `master` at `46535a221119e2a2199ac4a77416c740ee777ff7`

## Current State

- The production root is a polished one-page static prototype served by GitHub Pages.
- The root `CNAME` contains exactly `kabirlab.org`.
- The root site includes `index.html`, `styles.css`, `script.js`, `404.html`, `robots.txt`, `sitemap.xml`, `.nojekyll`, and `assets/hero-molecular-map.png`.
- The visual direction is strong, but the information architecture is broad and includes sections that need verified content before a durable academic launch.

## Main Content Risks

- Research areas are currently too broad for the evidence supplied in the V2 brief.
- People, publications, resources, contact details, and opportunities include generic or placeholder-style copy.
- `contact@kabirlab.org` appears in the prototype, but the supplied content checklist says this mailbox must be confirmed before public use.
- News and project language can imply active programs before public evidence has been supplied.

## V2 Strategy

- Preserve the root production site during review.
- Add Quarto source and a rendered preview in `docs/`.
- Build research around three supported pillars: photophysics, multiscale workflows, and interaction mapping.
- Hide News, Teaching, Alumni, Funding, Outreach, student cards, and unverified contact details until content is supplied.
- Generate a real publications page from curated BibTeX and metadata.

## Production Preservation Check

This V2 branch intentionally leaves the current root `index.html`, `styles.css`, `script.js`, `assets/hero-molecular-map.png`, and root `CNAME` in place. The deployment switch to `/docs` is documented separately and should happen only after human review.
