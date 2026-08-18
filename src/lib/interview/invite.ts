import { prisma } from "@/lib/db/prisma";
import { generatePublicToken, hashToken } from "@/lib/tokens";
import { INTERVIEWER_PROMPT_VERSION } from "@/lib/versions";

export type InvitationInput = {
  firstName: string;
  lastName?: string | null;
  role: string;
  email?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
  language: string;
  companyName: string;
  legalName?: string | null;
  website?: string | null;
  vertical?: string | null;
  employeeRange?: string | null;
  notes?: string | null;
  verifiedFacts: string[];
  hypotheses: string[];
};

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export async function createInterviewInvitation(input: InvitationInput) {
  const token = generatePublicToken();
  const language = input.language || "hy";
  const verifiedFacts = uniqueStrings(input.verifiedFacts);
  const hypotheses = uniqueStrings(input.hypotheses);

  const result = await prisma.$transaction(async (tx) => {
    let company = await tx.company.findFirst({
      where: { name: { equals: input.companyName, mode: "insensitive" } },
    });

    if (!company) {
      company = await tx.company.create({
        data: {
          name: input.companyName,
          legalName: input.legalName || null,
          website: input.website || null,
          vertical: input.vertical || "unknown",
          employeeRange: input.employeeRange || null,
          notes: input.notes || null,
          verifiedFacts,
          hypotheses,
        },
      });
    } else if (verifiedFacts.length || hypotheses.length || input.notes) {
      const existingFacts = Array.isArray(company.verifiedFacts)
        ? company.verifiedFacts.filter((item): item is string => typeof item === "string")
        : [];
      const existingHypotheses = Array.isArray(company.hypotheses)
        ? company.hypotheses.filter((item): item is string => typeof item === "string")
        : [];
      company = await tx.company.update({
        where: { id: company.id },
        data: {
          notes: input.notes || company.notes,
          vertical: input.vertical && company.vertical === "unknown" ? input.vertical : company.vertical,
          verifiedFacts: uniqueStrings([...existingFacts, ...verifiedFacts]),
          hypotheses: uniqueStrings([...existingHypotheses, ...hypotheses]),
        },
      });
    }

    let contact =
      (input.email
        ? await tx.contact.findFirst({
            where: { companyId: company.id, email: { equals: input.email, mode: "insensitive" } },
          })
        : null) ??
      (await tx.contact.findFirst({
        where: {
          companyId: company.id,
          firstName: { equals: input.firstName, mode: "insensitive" },
          lastName: input.lastName ? { equals: input.lastName, mode: "insensitive" } : undefined,
        },
      }));

    if (!contact) {
      contact = await tx.contact.create({
        data: {
          companyId: company.id,
          firstName: input.firstName,
          lastName: input.lastName || null,
          role: input.role,
          email: input.email || null,
          phone: input.phone || null,
          linkedinUrl: input.linkedinUrl || null,
          preferredLanguage: language,
        },
      });
    } else {
      contact = await tx.contact.update({
        where: { id: contact.id },
        data: {
          role: input.role || contact.role,
          email: input.email || contact.email,
          phone: input.phone || contact.phone,
          linkedinUrl: input.linkedinUrl || contact.linkedinUrl,
          preferredLanguage: language || contact.preferredLanguage,
        },
      });
    }

    const interview = await tx.interview.create({
      data: {
        companyId: company.id,
        contactId: contact.id,
        publicTokenHash: hashToken(token),
        language,
        promptVersion: INTERVIEWER_PROMPT_VERSION,
      },
    });

    return { company, contact, interview };
  });

  return { ...result, token };
}
