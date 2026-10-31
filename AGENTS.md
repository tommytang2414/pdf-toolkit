# PDF Toolkit agent guidance

Read CLAUDE.md and AI_HANDOFF.md. Follow C:/Users/User/AGENTS.md.

- Client-side Next.js PDF processing; preserve existing UI and browser-only document handling.
- Authorized GPT security pilot runs on local branch security/gpt-typescript-pilot. No production deployment or main-branch push is part of that pilot. Do not read local .env files or user PDFs.
- tests/pdf-renderer-security.cjs exercises committed renderer source with mocked PDF.js/canvas via DevOps-Scanner's pinned TypeScript compiler and Node VM modules. This tests scheduling and worker URL choice, not complete PDF memory bounds; verify actual worker bundling with a local build/browser as well.

## Changelog

### 2026-10-31 — GPT TypeScript security regression harness

- Added offline before/after renderer tests for runtime worker origin, actual concurrency and output order. Trusted DevOps-Scanner adapter supplies the runtime; no new application dependency.

### 2026-10-31 — Bound renderer work and bundle PDF worker

- Create rendering promises only inside the current batch; validate positive integer concurrency. The old implementation started all pages before awaiting batches.
- Resolve the matching installed PDF worker with import.meta.url so Next bundles a same-origin asset; no runtime CDN worker.
- Nine offline regression checks pass locally. Full committed before/after evidence and local build/browser checks are recorded in AI_HANDOFF.md. Remaining document/result memory is not globally capped.
