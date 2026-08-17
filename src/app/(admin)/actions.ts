"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { InterviewStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { generatePublicToken, hashToken } from "@/lib/tokens";

function str(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optional(value: string) {
  return value.length ? value : null;
}

function lines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function createCompany(form: FormData) {
  await requireAdmin();
  const company = await prisma.company.create({
    data: {
      name: str(form, "name"),
      legalName: optional(str(form, "legalName")),
      website: optional(str(form, "website")),
      vertical: str(form, "vertical") || "unknown",
      employeeRange: optional(str(form, "employeeRange")),
      notes: optional(str(form, "notes")),
      verifiedFacts: lines(str(form, "verifiedFacts")),
      hypotheses: lines(str(form, "hypotheses")),
    },
  });
  revalidatePath("/companies");
  redirect(`/companies/${company.id}`);
}

export async function updateCompany(form: FormData) {
  await requireAdmin();
  const id = str(form, "id");
  await prisma.company.update({
    where: { id },
    data: {
      name: str(form, "name"),
      legalName: optional(str(form, "legalName")),
      website: optional(str(form, "website")),
      vertical: str(form, "vertical") || "unknown",
      employeeRange: optional(str(form, "employeeRange")),
      notes: optional(str(form, "notes")),
      verifiedFacts: lines(str(form, "verifiedFacts")),
      hypotheses: lines(str(form, "hypotheses")),
    },
  });
  revalidatePath(`/companies/${id}`);
}

export async function createContact(form: FormData) {
  await requireAdmin();
  const contact = await prisma.contact.create({
    data: {
      companyId: str(form, "companyId"),
      firstName: str(form, "firstName"),
      lastName: optional(str(form, "lastName")),
      role: str(form, "role") || "unknown",
      email: optional(str(form, "email")),
      linkedinUrl: optional(str(form, "linkedinUrl")),
      phone: optional(str(form, "phone")),
      preferredLanguage: str(form, "preferredLanguage") || "hy",
    },
  });
  revalidatePath("/contacts");
  redirect(`/contacts/${contact.id}`);
}

export async function updateContact(form: FormData) {
  await requireAdmin();
  const id = str(form, "id");
  await prisma.contact.update({
    where: { id },
    data: {
      firstName: str(form, "firstName"),
      lastName: optional(str(form, "lastName")),
      role: str(form, "role") || "unknown",
      email: optional(str(form, "email")),
      linkedinUrl: optional(str(form, "linkedinUrl")),
      phone: optional(str(form, "phone")),
      preferredLanguage: str(form, "preferredLanguage") || "hy",
    },
  });
  revalidatePath(`/contacts/${id}`);
}

export async function createInvitation(form: FormData) {
  await requireAdmin();
  const contactId = str(form, "contactId");
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) throw new Error("Contact not found");
  const token = generatePublicToken();
  const interview = await prisma.interview.create({
    data: {
      companyId: contact.companyId,
      contactId: contact.id,
      publicTokenHash: hashToken(token),
      language: contact.preferredLanguage,
    },
  });
  revalidatePath("/interviews");
  redirect(`/interviews/${interview.id}?token=${token}`);
}

export async function markReviewed(form: FormData) {
  await requireAdmin();
  const id = str(form, "id");
  await prisma.interview.update({
    where: { id },
    data: {
      status: InterviewStatus.REVIEWED,
      reviewNotes: optional(str(form, "reviewNotes")),
    },
  });
  revalidatePath(`/interviews/${id}`);
}

export async function deleteInterview(form: FormData) {
  await requireAdmin();
  const id = str(form, "id");
  await prisma.interview.delete({ where: { id } });
  revalidatePath("/interviews");
  redirect("/interviews");
}
