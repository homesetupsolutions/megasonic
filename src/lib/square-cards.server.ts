// Square card-on-file + cancellation-fee helpers. Server-only.
// Cards are stored ONLY in Square; we keep references (customer_id, card_id, brand, last4) in our DB.

const baseUrl = () =>
  (process.env.SQUARE_ENV ?? "production") === "sandbox"
    ? "https://connect.squareupsandbox.com"
    : "https://connect.squareup.com";

const SQUARE_VERSION = "2024-10-17";

function authHeaders() {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) throw new Error("SQUARE_ACCESS_TOKEN missing");
  return {
    Authorization: `Bearer ${token}`,
    "Square-Version": SQUARE_VERSION,
    "Content-Type": "application/json",
  } as Record<string, string>;
}

function normPhone(p?: string | null) {
  if (!p) return null;
  const s = p.replace(/[^\d+]/g, "");
  return s || null;
}

async function squareFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${baseUrl()}${path}`, { ...init, headers: { ...authHeaders(), ...(init.headers || {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.errors?.[0]?.detail || body?.errors?.[0]?.code || res.statusText;
    throw new Error(`Square ${path}: ${msg}`);
  }
  return body;
}

export async function findOrCreateCustomer(opts: {
  name: string;
  email?: string | null;
  phone?: string | null;
}): Promise<string> {
  const phone = normPhone(opts.phone);
  const email = opts.email?.trim() || null;

  // Try phone first, then email
  if (phone) {
    const r = await squareFetch("/v2/customers/search", {
      method: "POST",
      body: JSON.stringify({ query: { filter: { phone_number: { fuzzy: phone } } }, limit: 1 }),
    });
    if (r?.customers?.[0]?.id) return r.customers[0].id as string;
  }
  if (email) {
    const r = await squareFetch("/v2/customers/search", {
      method: "POST",
      body: JSON.stringify({ query: { filter: { email_address: { fuzzy: email } } }, limit: 1 }),
    });
    if (r?.customers?.[0]?.id) return r.customers[0].id as string;
  }

  // Create
  const [given_name, ...rest] = (opts.name || "Guest").trim().split(/\s+/);
  const created = await squareFetch("/v2/customers", {
    method: "POST",
    body: JSON.stringify({
      given_name,
      family_name: rest.join(" ") || undefined,
      email_address: email || undefined,
      phone_number: phone || undefined,
    }),
  });
  return created.customer.id as string;
}

export async function attachCardToCustomer(opts: {
  customerId: string;
  sourceId: string;
  cardholderName: string;
  verificationToken?: string | null;
}) {
  const idem = `card-${opts.customerId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const r = await squareFetch("/v2/cards", {
    method: "POST",
    body: JSON.stringify({
      idempotency_key: idem,
      source_id: opts.sourceId,
      verification_token: opts.verificationToken || undefined,
      card: {
        customer_id: opts.customerId,
        cardholder_name: opts.cardholderName,
      },
    }),
  });
  const c = r.card;
  return {
    cardId: c.id as string,
    brand: c.card_brand as string,
    last4: c.last_4 as string,
  };
}

export async function chargeSavedCard(opts: {
  customerId: string;
  cardId: string;
  amountCents: number;
  currency?: string;
  note?: string;
  idempotencyKey?: string;
}) {
  const r = await squareFetch("/v2/payments", {
    method: "POST",
    body: JSON.stringify({
      idempotency_key: opts.idempotencyKey || `chg-${opts.cardId}-${Date.now()}`,
      source_id: opts.cardId,
      customer_id: opts.customerId,
      amount_money: { amount: Math.round(opts.amountCents), currency: opts.currency || "CAD" },
      note: opts.note,
      autocomplete: true,
    }),
  });
  return { paymentId: r.payment.id as string, status: r.payment.status as string };
}
