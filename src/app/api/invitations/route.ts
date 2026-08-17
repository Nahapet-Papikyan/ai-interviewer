import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireIngestApiKey } from "@/lib/ingest-auth";
import { createInterviewInvitation } from "@/lib/interview/invite";
import { rateLimit } from "@/lib/rate-limit";

const stringList = z
  .union([
    z.array(z.string()),
    z.string().transform((value) =>
      value
        .split(/\n|,/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ])
  .optional()
  .default([]);

const schema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().max(80).optional(),
  role: z.string().trim().min(1).max(120),
  email: z.union([z.literal(""), z.string().trim().email().max(160)]).optional(),
  phone: z.string().trim().max(40).optional(),
  linkedinUrl: z.string().trim().max(240).optional(),
  language: z.enum(["hy", "en", "ru"]).optional().default("hy"),
  companyName: z.string().trim().min(1).max(160),
  legalName: z.string().trim().max(160).optional(),
  website: z.string().trim().max(240).optional(),
  vertical: z.string().trim().max(120).optional(),
  employeeRange: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(2000).optional(),
  verifiedFacts: stringList,
  hypotheses: stringList,
});

function publicAppUrl(request: NextRequest) {
  const configured = process.env.APP_URL?.replace(/\/$/, "");
  if (configured && !configured.includes("localhost")) return configured;
  return request.nextUrl.origin;
}

function emptyToNull(value?: string) {
  return value?.trim() ? value.trim() : null;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, X-API-Key",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

export async function POST(request: NextRequest) {
  const auth = requireIngestApiKey(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!rateLimit("ingest:invitations", 40, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const created = await createInterviewInvitation({
    firstName: data.firstName,
    lastName: emptyToNull(data.lastName),
    role: data.role,
    email: emptyToNull(data.email),
    phone: emptyToNull(data.phone),
    linkedinUrl: emptyToNull(data.linkedinUrl),
    language: data.language,
    companyName: data.companyName,
    legalName: emptyToNull(data.legalName),
    website: emptyToNull(data.website),
    vertical: emptyToNull(data.vertical),
    employeeRange: emptyToNull(data.employeeRange),
    notes: emptyToNull(data.notes),
    verifiedFacts: data.verifiedFacts,
    hypotheses: data.hypotheses,
  });

  const interviewUrl = `${publicAppUrl(request)}/i/${created.token}`;

  return NextResponse.json({
    interviewUrl,
    interviewId: created.interview.id,
    companyId: created.company.id,
    contactId: created.contact.id,
    companyName: created.company.name,
    respondentName: created.contact.firstName,
    language: created.interview.language,
  });
}
