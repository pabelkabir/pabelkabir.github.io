# Deployment Migration To Version 2

This branch does not deploy Version 2. It prepares a rendered review build in `docs/` while the current root site remains live.

## Human Switch Steps After Approval

1. Review the draft pull request and rendered preview.
2. Confirm the unresolved content items in `CONTENT_NEEDED.md`.
3. Merge the approved Version 2 branch.
4. Open GitHub repository settings for `pabelkabir/pabelkabir.github.io`.
5. Go to `Settings -> Pages`.
6. Keep the custom domain as:

```text
kabirlab.org
```

7. Change the publishing source from branch `master`, folder `/root` to branch `master`, folder `/docs`.
8. Confirm `docs/CNAME` contains only:

```text
kabirlab.org
```

9. Wait for Pages to build.
10. Verify:

```text
https://kabirlab.org
https://www.kabirlab.org
```

11. Enable `Enforce HTTPS` when GitHub allows it.
12. Verify the homepage, research pages, publications, people, software, join, contact, sitemap, and 404 page.

Only after Version 2 is live and verified should the old root static files be archived or removed in a separate commit.
