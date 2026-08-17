import { createHash, randomBytes } from "crypto";

export function generatePublicToken() {
  return randomBytes(24).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
