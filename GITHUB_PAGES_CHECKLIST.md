# GitHub Pages Checklist for kabirlab.org

## 1. Create the GitHub repository

Create a public repository, for example:

```text
kabirlab.org
```

Upload every file in this folder to the repository root. Keep `CNAME` in the root next to `index.html`.

## 2. Enable GitHub Pages

In the repository:

1. Open `Settings`.
2. Open `Pages`.
3. Under `Build and deployment`, choose `Deploy from a branch`.
4. Select branch `main` and folder `/root`.
5. Save.
6. In `Custom domain`, enter:

```text
kabirlab.org
```

7. Save and wait for GitHub to check DNS.
8. Turn on `Enforce HTTPS` when GitHub allows it.

## 3. Set DNS records at Porkbun

For the apex domain `kabirlab.org`, add these `A` records:

```text
Host: @    Type: A    Answer: 185.199.108.153
Host: @    Type: A    Answer: 185.199.109.153
Host: @    Type: A    Answer: 185.199.110.153
Host: @    Type: A    Answer: 185.199.111.153
```

Optional but recommended IPv6 records:

```text
Host: @    Type: AAAA    Answer: 2606:50c0:8000::153
Host: @    Type: AAAA    Answer: 2606:50c0:8001::153
Host: @    Type: AAAA    Answer: 2606:50c0:8002::153
Host: @    Type: AAAA    Answer: 2606:50c0:8003::153
```

For `www.kabirlab.org`, add one `CNAME` record:

```text
Host: www    Type: CNAME    Answer: YOUR-GITHUB-USERNAME.github.io
```

Replace `YOUR-GITHUB-USERNAME` with your GitHub username or organization name.

## 4. Verify

After DNS propagates, check:

```text
https://kabirlab.org
https://www.kabirlab.org
```

GitHub may take a few minutes to several hours to finish DNS and HTTPS validation.

## Official References

- GitHub Pages custom domains: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site
- GitHub Pages setup: https://docs.github.com/articles/creating-project-pages-manually
- Porkbun GitHub Pages DNS guide: https://kb.porkbun.com/article/64-how-to-connect-your-domain-to-github-pages
