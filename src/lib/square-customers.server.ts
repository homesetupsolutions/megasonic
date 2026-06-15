// Look up a Square customer by phone number. Returns { id, name, email, phone } or null.
// Used by the desk-phone webhook to enrich incoming-call leads.
const baseUrl = () =>
  (process.env.SQUARE_ENV ?? "production") === "sandbox"
    ? "https://connect.squareupsandbox.com"
    : "https://connect.squareup.com";

function normalize(p: string) {
  return p.replace(/[^\d+]/g, "");
}

export async function findSquareCustomerByPhone(phone: string | null | undefined) {
  if (!phone) return null;
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) return null;
  const normalized = normalize(phone);
  if (!normalized) return null;

  try {
    const res = await fetch(`${baseUrl()}/v2/customers/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Square-Version": "2024-10-17",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: { filter: { phone_number: { fuzzy: normalized } } },
        limit: 1,
      }),
    });
    if (!res.ok) return null;
    const body = await res.json();
    const c = body?.customers?.[0];
    if (!c) return null;
    return {
      id: c.id as string,
      name: [c.given_name, c.family_name].filter(Boolean).join(" ").trim() || c.company_name || null,
      email: c.email_address ?? null,
      phone: c.phone_number ?? phone,
      company: c.company_name ?? null,
      note: c.note ?? null,
    };
  } catch {
    return null;
  }
}
