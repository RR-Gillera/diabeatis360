---
description: Implement a single screen from Figma in the mobile app (e.g. /figma-screen 194:264)
argument-hint: <Figma node id or screen name from docs/FIGMA_MAP.md>
---
Implement the screen **$ARGUMENTS** from the DIABEATIS360 Figma file (fileKey zg94UJ7h9nxktg8Sf8mTJ3).

- Look up the node in docs/FIGMA_MAP.md (resolve a name to its node ID).
- Use the Figma MCP to get the design context and screenshot for that node. Treat the returned
  React/Tailwind code as a visual reference only — rebuild it with this app's React Native components,
  theme tokens, and styling approach. No absolute pixel positioning unless truly needed; use flex layout
  so it works on different phone sizes.
- Reuse existing shared components (buttons, cards, headers, bottom nav) before creating new ones.
  If a pattern appears on 2+ screens, make it a shared component.
- Replace Figma sample data (names, 2023 dates, numbers) with real data from services, or clearly
  marked props if the service doesn't exist yet.
- If it's a legacy teal frame, keep its layout but apply the green theme.
- Show me what you built and list any visual differences you couldn't match.
