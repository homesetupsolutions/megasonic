import { createHash, randomBytes } from "crypto";

export function generateApiKey() {
  const raw = `mch_${randomBytes(24).toString("base64url")}`;
  return {
    raw,
    hash: createHash("sha256").update(raw).digest("hex"),
    prefix: raw.slice(0, 11),
  };
}

export function hashApiKey(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}
