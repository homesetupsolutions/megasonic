// Server-only: pulls Square Locations + Catalog into our DB.
// Maps location -> organization heuristically (FeelBass vs HSS).

const baseUrl = () =>
  (process.env.SQUARE_ENV ?? "production") === "sandbox"
    ? "https://connect.squareupsandbox.com"
    : "https://connect.squareup.com";

const headers = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
  "Square-Version": "2024-10-17",
});

function pickOrgIdForLocation(locName: string, orgs: Array<{ id: string; kind: string; name: string }>) {
  const lower = locName.toLowerCase();
  const feel = orgs.find((o) => o.kind === "feelbass" || o.kind === "sonicfeel");
  const hss = orgs.find((o) => o.kind === "hss" || o.kind === "homesetup");
  if (lower.includes("hss") || lower.includes("home setup")) return hss?.id ?? null;
  if (lower.includes("feel") || lower.includes("sonic") || lower.includes("bass")) return feel?.id ?? null;
  // default to FeelBass if ambiguous
  return feel?.id ?? hss?.id ?? null;
}

export async function pullSquareForUser({ userId }: { userId: string }) {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) return { ok: false, error: "SQUARE_ACCESS_TOKEN not set" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: orgs } = await supabaseAdmin
    .from("organizations")
    .select("id, kind, name")
    .eq("owner_id", userId);
  if (!orgs?.length) return { ok: false, error: "No organizations for user" };

  // 1. Locations
  const locRes = await fetch(`${baseUrl()}/v2/locations`, { headers: headers(token) });
  const locJson = await locRes.json().catch(() => ({}));
  if (!locRes.ok) return { ok: false, error: `Square locations ${locRes.status}: ${JSON.stringify(locJson?.errors)}` };

  const locations = (locJson?.locations ?? []) as any[];
  let locCount = 0;
  for (const loc of locations) {
    const orgId = pickOrgIdForLocation(loc.name ?? "", orgs as any);
    const addr = loc.address
      ? [loc.address.address_line_1, loc.address.locality, loc.address.administrative_district_level_1].filter(Boolean).join(", ")
      : null;
    const { error } = await (supabaseAdmin.from("square_locations") as any).upsert(
      {
        owner_id: userId,
        organization_id: orgId,
        square_location_id: loc.id,
        name: loc.name ?? "Unnamed",
        address: addr,
        currency: loc.currency ?? null,
        status: loc.status ?? null,
        timezone: loc.timezone ?? null,
        raw: loc,
      },
      { onConflict: "owner_id,square_location_id" },
    );
    if (!error) locCount++;
  }

  // 2. Catalog items (paginate)
  let cursor: string | undefined;
  let svcCount = 0;
  do {
    const url = new URL(`${baseUrl()}/v2/catalog/list`);
    url.searchParams.set("types", "ITEM");
    if (cursor) url.searchParams.set("cursor", cursor);
    const res = await fetch(url.toString(), { headers: headers(token) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) break;
    const objects = (json?.objects ?? []) as any[];
    for (const item of objects) {
      const itemData = item.item_data ?? {};
      const variation = itemData.variations?.[0];
      const priceMoney = variation?.item_variation_data?.price_money;
      const presentAt = (item.present_at_location_ids ?? []) as string[];
      const orgId = presentAt.length
        ? pickOrgIdForLocation(
            locations.find((l) => l.id === presentAt[0])?.name ?? "",
            orgs as any,
          )
        : (orgs as any[])[0].id;
      if (!orgId) continue;

      // upsert by square_catalog_id
      const { data: existing } = await supabaseAdmin
        .from("services")
        .select("id")
        .eq("owner_id", userId)
        .eq("square_catalog_id", item.id)
        .maybeSingle();

      const payload = {
        owner_id: userId,
        organization_id: orgId,
        name: itemData.name ?? "Unnamed",
        description: itemData.description ?? null,
        price_cents: priceMoney?.amount ?? 0,
        currency: priceMoney?.currency ?? "CAD",
        sku: variation?.item_variation_data?.sku ?? null,
        active: !(item.is_deleted ?? false),
        square_catalog_id: item.id,
        imported_from_square: true,
        square_location_id: presentAt[0] ?? null,
      };

      if (existing?.id) {
        await (supabaseAdmin.from("services") as any).update(payload).eq("id", existing.id);
      } else {
        await (supabaseAdmin.from("services") as any).insert(payload);
      }
      svcCount++;
    }
    cursor = json?.cursor;
  } while (cursor);

  // Mark connection as connected
  await (supabaseAdmin.from("external_connections") as any).upsert(
    {
      owner_id: userId,
      provider: "square",
      status: "connected",
      label: "Square POS",
      last_synced_at: new Date().toISOString(),
      config: { last_pull: { locations: locCount, items: svcCount } },
    },
    { onConflict: "owner_id,provider" },
  );

  return { ok: true, locations: locCount, services: svcCount };
}
