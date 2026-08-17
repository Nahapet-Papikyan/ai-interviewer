import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/auth-token";

const PROTECTED = ["/dashboard", "/companies", "/contacts", "/interviews", "/processes"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  if (!isProtected) return NextResponse.next();

  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  if (await verifySessionToken(token)) return NextResponse.next();

  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/companies",
    "/companies/:path*",
    "/contacts",
    "/contacts/:path*",
    "/interviews",
    "/interviews/:path*",
    "/processes",
    "/processes/:path*",
  ],
};
