---
name: web-interface-guidelines
description: Review UI code (React/TSX/CSS) for compliance with Vercel's Web Interface Guidelines — accessibility, focus management, forms, animation, layout, performance, and design quality. Use when building or reviewing UI components, or when the user asks for a UI/accessibility review.
---

# Web Interface Guidelines

Concise MUST/SHOULD/NEVER rules for building accessible, fast, delightful web UIs, maintained by Vercel.

## How to use

1. Read [AGENTS.md](AGENTS.md) — the full rule set (interactions, keyboard, forms, animation, layout, content, performance, design).
2. When asked to review specific files, follow the review procedure in [command.md](command.md): read the target files, check them against the rules, and report violations concisely with high signal-to-noise.
3. When writing new UI code, apply the rules proactively — especially focus visibility, hit-target sizes (≥24px, mobile ≥44px), `<button>` vs `<a>` semantics, labels on form controls, and honoring `prefers-reduced-motion`.
