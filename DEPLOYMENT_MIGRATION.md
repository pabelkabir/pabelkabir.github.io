# Deployment Migration Notes

This branch is a review branch. It must not be deployed, merged, or used to change DNS or GitHub Pages settings until the site owner approves the staged build.

## What This Branch Does

- Builds the Quarto review site into `docs/`.
- Preserves the current root-level production site.
- Preserves the root `CNAME` value:

```text
kabirlab.org
```

- Keeps all deployment steps as human review instructions only.

## Review Steps

1. Review the draft pull request.
2. Inspect the rendered `docs/` site locally or through a branch preview.
3. Review `CONTENT_NEEDED.md` for unresolved identity, people, opportunities, and publication-link items.
4. Confirm that no unverified News, Gallery, Alumni, Collaborators, domain email, office room, phone number, or private repository content is rendered.
5. Confirm desktop and mobile screenshots in `review-screenshots/`.

## Human Deployment Steps After Approval

Do not perform these steps from Codex unless the owner explicitly asks for deployment later.

1. Merge the approved review pull request.
2. Open GitHub repository settings for `pabelkabir/pabelkabir.github.io`.
3. Go to `Settings -> Pages`.
4. Confirm the custom domain remains:

```text
kabirlab.org
```

5. Confirm the publishing source matches the approved rendered folder.
6. Confirm `docs/CNAME` contains only:

```text
kabirlab.org
```

7. Wait for Pages to build.
8. Verify:

```text
https://kabirlab.org
https://www.kabirlab.org
```

9. Enable `Enforce HTTPS` only when GitHub has issued the certificate and the checkbox is available.
10. Verify the homepage, research pages, publications, people, software/resources, join, contact, sitemap, and 404 page.

Move or remove old root-level production files only in a later, separate commit after the approved `docs/` site is live and verified.
