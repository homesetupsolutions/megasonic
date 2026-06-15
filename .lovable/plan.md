
# Master Command Center — Web Hub + Cross-Project Link

A signed-in web hub on this Lovable project that links **only the FeelBass family + every new project you build from now on**. SonicFeel and Home Setup Solutions stay completely isolated — the hub never reads or writes their data.

## How "all linked and updated" actually works

Lovable projects are independent codebases. To make them feel like one system, this hub owns a single shared backend (Lovable Cloud), and every linked project talks to it. Two mechanisms, used together:

1. **Shared backend for new projects (cleanest)**
   When you start a new project on Lovable, you give me one line: *"link this to the hub."* I drop in a small `hub-client.ts` file pointing at the hub's Lovable Cloud URL + a publishable key, plus a per-project API key. From that moment, anything the new project captures (leads, ideas, scans, sales, inventory moves, etc.) writes directly into the hub's tables and shows up live in the dashboard. No copy-paste, no manual sync. Future projects you haven't built yet get linked the same way at creation time.

2. **Webhook bridge for existing projects (feelbasspos, feelbass.vip when it's back)**
   I add a public endpoint on the hub (`/api/public/ingest`) that accepts signed events. In each existing FeelBass project I drop a 20-line helper that POSTs `{ type, payload }` whenever something happens (new scan, new lead, new sale). The hub stores it in the same tables as new projects. One-way for now; we can promote any of them to full shared-backend later.

**Excluded by your rule:** sonicfeel.tech, sonicfeel family, homesetupsolutions.ca. I won't add the client or webhook to those, and the hub UI won't show their data. If you ever change your mind, it's one paste per project.

## Hub modules (what you actually see)

Sidebar dashboard, signed in via email+password and Google:

- **Projects** — list of linked projects, last-seen timestamp, event count, link-out, per-project API key + revoke. Adding a future project = "+ New project" → copy the snippet.
- **Unified feed** — every event from every linked project, filterable by project / type / date.
- **Leads / CRM** — leads from any project flow in here; stage pipeline, notes, follow-up.
- **Customers** — deduped across projects by email/phone.
- **Ideas** — quick capture + auto-tag by project, stage (Idea → Validating → Building → Launched).
- **Inventory** — live view of FeelBass POS items via webhook ingest; manual entry fallback.
- **Activity log** — audit trail of every write.
- **Settings** — your profile, project keys, webhook secret, integration placeholders (Call Centric, M365, Ads — wired later when you have keys).

## Technical plan

- **Backend:** enable Lovable Cloud. Tables: `profiles`, `linked_projects` (id, name, api_key_hash, created_at, last_seen_at), `events` (project_id, type, payload jsonb, created_at), `leads`, `customers`, `ideas`, `inventory_items`, `activity_log`, plus `user_roles` + `has_role()` for future team access. RLS scoped to `auth.uid()` on owner data; `events` writes go through the public ingest route using the project API key, never RLS-bypass from the client.
- **Public ingest route:** `src/routes/api/public/ingest.ts` — POST `{ project_key, type, payload }`, verifies the key, writes the event, fans out to the right table (lead/idea/inventory/etc.) via a small dispatcher. HMAC-signed bodies, timing-safe compare.
- **Hub-client snippet** (what gets pasted into other projects): a 30-line module exporting `hub.emit(type, payload)` and `hub.lead(...)`, `hub.idea(...)` helpers. Uses fetch to the hub's public URL. No SDK install required.
- **Frontend:** TanStack Start, shadcn sidebar, all module pages under `_authenticated/`. TanStack Query + `createServerFn` with `requireSupabaseAuth` for hub reads/writes. PWA manifest so you can install it on Windows/phone.
- **Realtime:** Supabase realtime subscription on `events` so the unified feed updates the moment another project emits.

## What I'll do this round (phase 1)

1. Enable Lovable Cloud + auth (email + Google).
2. Schema + RLS + public ingest endpoint + project-key system.
3. Sidebar shell + Projects page + Unified Feed (realtime) + Ideas Tracker (so you can use it immediately).
4. Generate the `hub-client.ts` snippet and show it on the Projects page with copy-button + per-project key.

Phase 2 (next message): Leads, Customers, Inventory, Activity log.
Phase 3: Settings polish, PWA install, integration stubs.

## What I need from you after phase 1 lands

- Paste the snippet into **feelbasspos** (and feelbass.vip when GoDaddy is back). I can do it for you if you @mention the projects in chat — that lets me edit them directly.
- Any new project you create from now on: just say "link this to the hub" in its first chat and I'll wire it in 30 seconds.

Approve and I'll start building phase 1.
