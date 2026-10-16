# Personal Website & Notebook

A fast, content-first personal website and notebook inspired by [Evan Chen's blog](https://blog.evanchen.cc/), built with modern web standards and zero bloat.

## Features

- **Purely Functional & Fast:** Zero client-side JavaScript framework overhead. Static HTML and CSS pre-rendered at build time.
- **Server-Side Math Rendering:** Full LaTeX math support (`$inline$` and `$$display$$`) via KaTeX rendered ahead of time.
- **Syntax Highlighting:** Dual-theme code blocks (GitHub Light / GitHub Dark) via Shiki.
- **Academic Callout Blocks:** Built-in theorem, proof, and note boxes (`.callout.theorem`, `.callout.proof`, `.callout.note`).
- **Archive & Tagging:** Reverse-chronological archive grouped by year, plus tag filtering.
- **RSS Feed:** Valid Atom/RSS 2.0 feed generated at `/rss.xml`.
- **Clean Theme Support:** Respects system `prefers-color-scheme` with a zero-flash toggle button.

## Getting Started

### Start Development Server
```bash
npm run dev
```
Navigate to `http://localhost:4321`.

### Build for Production
```bash
npm run build
```
The static site is exported to the `dist/` directory, ready to deploy to GitHub Pages, Cloudflare Pages, Vercel, or any static host.

### Adding New Posts
Add a `.md` or `.mdx` file to `src/content/blog/`:

```markdown
---
title: "Your Post Title"
description: "A short summary of your post"
pubDate: 2026-10-15
tags: ["math", "notes"]
draft: false
---

Your content goes here. You can write math like $\sum_{n=1}^\infty \frac{1}{n^2}$ and code blocks!
```
