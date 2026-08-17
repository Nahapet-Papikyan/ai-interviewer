import { cookies } from "next/headers";
import {
  checkAdminPassword,
  createSessionToken,
  verifySessionToken,
  ADMIN_COOKIE,
} from "@/lib/auth-token";

export { checkAdminPassword, verifySessionToken, ADMIN_COOKIE };
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export async function setAdminCookie() {
  const store = await cookies();
  store.set(ADMIN_COOKIE, await createSessionToken(MAX_AGE_SECONDS * 1000), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearAdminCookie() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}

export async function isAdmin() {
  const store = await cookies();
  return verifySessionToken(store.get(ADMIN_COOKIE)?.value);
}

export async function requireAdmin() {
  const ok = await isAdmin();
  if (!ok) {
    throw new Error("Unauthorized");
  }
}
