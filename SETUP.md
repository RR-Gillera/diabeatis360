# Diabeatis360 × Claude Code — Setup Guide

## 1. Copy the kit into your project
Copy everything in this folder into your `CAPSTONE/` folder so it looks like:
```
CAPSTONE/
├─ CLAUDE.md                 ← shared project memory (new)
├─ SETUP.md
├─ .claude/
│  ├─ settings.json          ← blocks Claude from reading .env / service account key
│  └─ commands/              ← /audit, /build-module, /figma-screen, /check-module, /session-end
├─ docs/                     ← MODULES, FIRESTORE_SCHEMA, FIGMA_MAP, DECISIONS, ROADMAP, PROGRESS
├─ diabeatis360-admin/CLAUDE.md.new
└─ diabeatis360-mobile/CLAUDE.md.new
```
**You already have a CLAUDE.md in each app — don't overwrite it.** Rename the kit's versions to
`CLAUDE.md.new` when copying (the zip already names them that way), then let Claude merge them (step 4).

## 2. Connect Figma to Claude Code (so it can read your screens)
In a terminal:
```
claude mcp add --transport http figma https://mcp.figma.com/mcp
```
Then start `claude`, type `/mcp`, select **figma**, and log in with the account that can open the
DIABEATIS360 file. (If this command has changed, check Figma's "Remote MCP server" help page.)

## 3. Always launch Claude Code from the CAPSTONE root
```
cd CAPSTONE
claude
```
That way it sees both apps, the docs, and the slash commands.

## 4. First prompts (run in order)
**Prompt 1 — merge memory files**
> Merge each app's existing CLAUDE.md with its CLAUDE.md.new. Keep every fact from the old file that
> is still true, adopt the new structure, show me the merged result for approval, then replace
> CLAUDE.md and delete the .new file.

**Prompt 2 — audit**
> /audit

**Prompt 3 — close decisions** (talk this through as a team first)
> Walk me through the OPEN items in docs/DECISIONS.md one at a time with a recommendation for a
> student capstone. Update each to CLOSED once I answer.

**Prompt 4 — security first**
> Based on the audit, fix the secrets hygiene issues and write firestore.rules following
> docs/FIRESTORE_SCHEMA.md. Explain each rule in one line so we can defend it. Tell me how to deploy.

**Then build tier by tier from docs/ROADMAP.md**, e.g.
> /build-module Create Account and Login (Patient + Doctor, with role routing)
> /figma-screen 194:264
> /check-module Blood Sugar Monitoring
> /session-end

## 5. Team workflow tips
- Use Plan Mode (Shift+Tab) for anything bigger than one screen.
- One teammate per module/branch; `/session-end` before pushing so PROGRESS.md tells the next person
  where things stand.
- Start a fresh session (`/clear`) between unrelated modules — CLAUDE.md and docs reload automatically,
  and a clean context gives better code.
- If Claude drifts from the rules, say "re-read CLAUDE.md" or add the missing rule to CLAUDE.md.
- Commit before letting Claude do big changes, so you can always roll back.
