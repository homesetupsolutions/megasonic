# In-App Backup & Export Page

A one-tap "Backup" page you can open from your phone that downloads every bit of your business data as files you can keep, email to yourself, or drop in Google Drive.

## What you get

A new **Backup & Export** page in the sidebar with:

- **One big "Download Everything" button** — grabs all your data as a single `.json` backup file, named with today's date (e.g. `megasonic-backup-2026-08-10.json`).
- **Individual table downloads** — a tidy list of cards, one per data set, each with a **CSV** button (opens in Excel / Google Sheets) and a **JSON** button:
  - Bookings
  - Customers
  - Leads
  - Services & Inventory (catalog)
  - Call Scripts
  - Phone Calls & Voice Calls
  - Phone Devices & SIP Trunks
  - IVR / AI Settings
  - Linked Projects
  - Investors, Grants, Ideas
  - Activity Log
  - Price Change Requests
- **Row counts** shown on each card so you can see at a glance what's in there.
- **Last backup date** remembered on the device, so you know when you last pulled one.

Everything downloads straight to your phone or computer — no email step, no waiting.

## What is NOT included (and why)

- **Card numbers** — those live only in Square, never in this system. The backup includes the Square customer/card reference IDs, not card data.
- **Secrets/API keys** — deliberately excluded so a backup file is safe to store.
- **Uploaded knowledge files** — the backup lists their names and links, not the raw file bytes.

## How it works (technical)

1. **`src/lib/backup.functions.ts`** — new server functions:
   - `getBackupCounts()` — returns row counts per table for the UI cards.
   - `exportTable({ table })` — validated against an allow-list of table names; returns rows for that table.
   - `exportAll()` — returns one object keyed by table name with every row.
   - All use `.middleware([requireSupabaseAuth])`, so RLS scopes results to your account only. Sensitive columns (`sip_password`, `api_key` on `linked_projects`) are stripped from the output before returning.

2. **`src/routes/_authenticated/backup.tsx`** — new page:
   - `useServerFn` + `useQuery` for counts (no protected calls in loaders).
   - Client-side helpers to convert rows to CSV and trigger a `Blob` download.
   - Mobile-first card layout matching the existing shadcn/Tailwind design tokens already used across the app.
   - `head()` with its own title and description.

3. **`src/routes/_authenticated/route.tsx`** — add `{ title: "Backup & Export", url: "/backup", icon: Download }` to the nav list.

No database migration and no new dependencies needed.
