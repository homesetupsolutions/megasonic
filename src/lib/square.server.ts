// Server-only Square Catalog sync.
// Requires SQUARE_ACCESS_TOKEN env var. Optional SQUARE_ENV=sandbox|production (default production).

const baseUrl = () =>
  (process.env.SQUARE_ENV ?? "production") === "sandbox"
    ? "https://connect.squareupsandbox.com"
    : "https://connect.squareup.com";

type SyncArgs = { serviceId: string; organizationId: string; ownerId: string };

export async function syncServiceToSquareInternal({ serviceId, organizationId, ownerId }: SyncArgs) {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) return { synced: false, skipped: true, reason: "No SQUARE_ACCESS_TOKEN configured" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("square_enabled, square_location_id")
    .eq("id", organizationId)
    .single();
  if (!org?.square_enabled) {
    return { synced: false, skipped: true, reason: "Square disabled for this organization" };
  }

  const { data: svc, error: svcErr } = await supabaseAdmin
    .from("services")
    .select("*")
    .eq("id", serviceId)
    .single();
  if (svcErr || !svc) return { synced: false, error: "Service not found" };

  // Build the item object. If square_catalog_id exists, fetch latest version.
  let itemId = svc.square_catalog_id as string | null;
  let itemVersion: number | undefined;
  let variationId: string | undefined;
  let variationVersion: number | undefined;

  if (itemId) {
    try {
      const res = await fetch(`${baseUrl()}/v2/catalog/object/${itemId}?include_related_objects=true`, {
        headers: { Authorization: `Bearer ${token}`, "Square-Version": "2024-10-17" },
      });
      if (res.ok) {
        const body = await res.json();
        itemVersion = body?.object?.version;
        const v = body?.object?.item_data?.variations?.[0];
        if (v) {
          variationId = v.id;
          variationVersion = v.version;
        }
      } else {
        // stale id — reset and create fresh
        itemId = null;
      }
    } catch {
      itemId = null;
    }
  }

  const tempItemId = itemId ?? "#item";
  const tempVarId = variationId ?? "#var";

  const object: any = {
    type: "ITEM",
    id: tempItemId,
    ...(itemVersion ? { version: itemVersion } : {}),
    item_data: {
      name: svc.name,
      description: svc.description ?? undefined,
      variations: [
        {
          type: "ITEM_VARIATION",
          id: tempVarId,
          ...(variationVersion ? { version: variationVersion } : {}),
          item_variation_data: {
            item_id: tempItemId,
            name: "Regular",
            pricing_type: "FIXED_PRICING",
            price_money: {
              amount: svc.price_cents,
              currency: svc.currency || "CAD",
            },
            sku: svc.sku ?? undefined,
          },
        },
      ],
    },
  };

  const res = await fetch(`${baseUrl()}/v2/catalog/object`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Square-Version": "2024-10-17",
    },
    body: JSON.stringify({ idempotency_key: crypto.randomUUID(), object }),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    await supabaseAdmin.from("square_sync_log").insert({
      owner_id: ownerId,
      organization_id: organizationId,
      service_id: serviceId,
      action: "upsert_item",
      status: `error_${res.status}`,
      response: json,
    });
    return { synced: false, error: json?.errors?.[0]?.detail || `Square error ${res.status}` };
  }

  const newId = json?.catalog_object?.id;
  if (newId && newId !== svc.square_catalog_id) {
    await supabaseAdmin.from("services").update({ square_catalog_id: newId }).eq("id", serviceId);
  }

  await supabaseAdmin.from("square_sync_log").insert({
    owner_id: ownerId,
    organization_id: organizationId,
    service_id: serviceId,
    action: "upsert_item",
    status: "ok",
    response: { id: newId, version: json?.catalog_object?.version },
  });

  return { synced: true, squareId: newId };
}
