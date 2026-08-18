import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { generatePublicToken, hashToken } from "@/lib/tokens";
import { INTERVIEWER_PROMPT_VERSION } from "@/lib/versions";

const schema = z.object({
  firstName: z.string().trim().min(1).max(80),
  companyName: z.string().trim().min(1).max(120),
  role: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(160).optional().or(z.literal("")),
  language: z.enum(["hy", "en"]).default("hy"),
});

function clientKey(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export async function POST(request: NextRequest) {
  if (!rateLimit(`assessment:${clientKey(request)}`, 6, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please fill in name, company and role." }, { status: 400 });
  }

  const { firstName, companyName, role, email, language } = parsed.data;
  const token = generatePublicToken();

  await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name: companyName,
        vertical: "public-assessment",
        notes: "Created from public /assessment",
      },
    });
    const contact = await tx.contact.create({
      data: {
        companyId: company.id,
        firstName,
        role,
        email: email || null,
        preferredLanguage: language,
      },
    });
    await tx.interview.create({
      data: {
        companyId: company.id,
        contactId: contact.id,
        publicTokenHash: hashToken(token),
        language,
        promptVersion: INTERVIEWER_PROMPT_VERSION,
      },
    });
  });

  return NextResponse.json({ token });
}
