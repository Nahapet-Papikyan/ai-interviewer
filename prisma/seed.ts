import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "crypto";

const prisma = new PrismaClient();

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function token() {
  return randomBytes(24).toString("base64url");
}

async function main() {
  await prisma.opportunity.deleteMany();
  await prisma.processEvidence.deleteMany();
  await prisma.processSystem.deleteMany();
  await prisma.processStep.deleteMany();
  await prisma.process.deleteMany();
  await prisma.interviewAnalysis.deleteMany();
  await prisma.interviewFact.deleteMany();
  await prisma.interviewEvent.deleteMany();
  await prisma.interviewMessage.deleteMany();
  await prisma.interview.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.company.deleteMany();

  const mega = await prisma.company.create({
    data: {
      name: "MegaFood",
      legalName: "MegaFood LLC",
      website: "https://megafood.example",
      vertical: "FMCG distribution",
      employeeRange: "50-120",
      notes: "Seed company for local testing.",
      hypotheses: [
        "customer order intake may involve manual work",
        "supplier invoice processing may be high-volume",
      ],
      contacts: {
        create: {
          firstName: "Armine",
          lastName: "Sargsyan",
          role: "CEO",
          email: "armine@megafood.example",
          preferredLanguage: "hy",
        },
      },
    },
    include: { contacts: true },
  });

  const logistic = await prisma.company.create({
    data: {
      name: "Ararat Logistics",
      legalName: "Ararat Logistics CJSC",
      vertical: "Transportation / 3PL",
      employeeRange: "20-40",
      hypotheses: ["dispatch and documentation may still live in Excel and WhatsApp"],
      contacts: {
        create: {
          firstName: "Karen",
          lastName: "Petrosyan",
          role: "Operations Director",
          email: "karen@araratlog.example",
          preferredLanguage: "hy",
        },
      },
    },
    include: { contacts: true },
  });

  const studio = await prisma.company.create({
    data: {
      name: "Yerevan Accounting Studio",
      vertical: "Accounting / bookkeeping",
      employeeRange: "8-15",
      hypotheses: ["AP invoice processing is the likely bottleneck"],
      contacts: {
        create: {
          firstName: "Nune",
          lastName: "Hakobyan",
          role: "CFO",
          email: "nune@yas.example",
          preferredLanguage: "hy",
        },
      },
    },
    include: { contacts: true },
  });

  const companies = [mega, logistic, studio];
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  console.log("Seeded companies. Invitation links:");
  for (const company of companies) {
    const contact = company.contacts[0];
    const publicToken = token();
    await prisma.interview.create({
      data: {
        companyId: company.id,
        contactId: contact.id,
        publicTokenHash: hashToken(publicToken),
        language: contact.preferredLanguage,
      },
    });
    console.log(`  ${company.name} / ${contact.firstName}: ${appUrl}/i/${publicToken}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
