---
description: Plan and build one module/function from docs/MODULES.md (e.g. /build-module Add Blood Sugar Log)
argument-hint: <module or function name>
---
Build: **$ARGUMENTS**

Step 1 — Understand (no code yet):
- Read the matching section in docs/MODULES.md, related rows in docs/FIRESTORE_SCHEMA.md, any
  related item in docs/DECISIONS.md, and the Figma node(s) listed in docs/FIGMA_MAP.md.
- If the Figma MCP is available, fetch the design for those nodes. If not, say so and continue from the spec.
- Read the existing code this will touch (services, navigation, theme, similar screens).
- If an OPEN decision blocks this, stop and ask me about it.

Step 2 — Plan and wait:
Present a short plan: screens/components to create or edit, service functions, exact Firestore
reads/writes (collection, fields, doc IDs), new fields that need a schema/manuscript update, new
dependencies (with reason), and how I'll test it on my phone. **Wait for my "go".**

Step 3 — Build:
- Follow CLAUDE.md conventions (theme tokens, services layer, serverTimestamp, no secrets).
- Handle loading, empty and error states, and the exact validation messages from MODULES.md.
- Run lint/typecheck; fix issues you introduced.

Step 4 — Wrap up:
- Give me a numbered manual test script mapped to the manuscript test IDs (UT-/IT-) for this module.
- Tick the item in docs/ROADMAP.md and append to docs/PROGRESS.md.
- List anything the team must update in the manuscript (data dictionary, screenshots).
