import { z } from "zod";
import { createInterviewInvitation } from "@/lib/interview/invite";
import { SITE_URL } from "@/lib/site";

export const invitationSchema = z.object({
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
  verifiedFacts: z
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
    .default([]),
  hypotheses: z
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
    .default([]),
});

export type InvitationPayload = z.infer<typeof invitationSchema>;

export type InvitationResult = {
  interviewUrl: string;
  interviewId: string;
  companyId: string;
  contactId: string;
  companyName: string;
  respondentName: string;
  language: string;
};

function emptyToNull(value?: string) {
  return value?.trim() ? value.trim() : null;
}

export function interviewPublicBaseUrl(requestOrigin?: string) {
  const configured = process.env.APP_URL?.replace(/\/$/, "");
  if (configured && !/localhost|127\.0\.0\.1/i.test(configured)) return configured;
  if (requestOrigin && !/localhost|127\.0\.0\.1/i.test(requestOrigin)) {
    return requestOrigin.replace(/\/$/, "");
  }
  if (configured) return configured;
  return SITE_URL.replace(/\/$/, "");
}

export async function issueInterviewInvitation(
  payload: InvitationPayload,
  requestOrigin?: string,
): Promise<InvitationResult> {
  const created = await createInterviewInvitation({
    firstName: payload.firstName,
    lastName: emptyToNull(payload.lastName),
    role: payload.role,
    email: emptyToNull(payload.email),
    phone: emptyToNull(payload.phone),
    linkedinUrl: emptyToNull(payload.linkedinUrl),
    language: payload.language,
    companyName: payload.companyName,
    legalName: emptyToNull(payload.legalName),
    website: emptyToNull(payload.website),
    vertical: emptyToNull(payload.vertical),
    employeeRange: emptyToNull(payload.employeeRange),
    notes: emptyToNull(payload.notes),
    verifiedFacts: payload.verifiedFacts,
    hypotheses: payload.hypotheses,
  });

  return {
    interviewUrl: `${interviewPublicBaseUrl(requestOrigin)}/i/${created.token}`,
    interviewId: created.interview.id,
    companyId: created.company.id,
    contactId: created.contact.id,
    companyName: created.company.name,
    respondentName: created.contact.firstName,
    language: created.interview.language,
  };
}
