import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { updateCompany } from "../../actions";

function asLines(value: unknown) {
  return Array.isArray(value) ? value.join("\n") : "";
}

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const company = await prisma.company.findUnique({
    where: { id },
    include: { contacts: true, interviews: true },
  });
  if (!company) notFound();

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">{company.name}</h1>
        <form action={updateCompany} className="card space-y-4">
          <input type="hidden" name="id" value={company.id} />
          <div className="field">
            <label>Name</label>
            <input name="name" defaultValue={company.name} required />
          </div>
          <div className="field">
            <label>Legal name</label>
            <input name="legalName" defaultValue={company.legalName ?? ""} />
          </div>
          <div className="field">
            <label>Website</label>
            <input name="website" defaultValue={company.website ?? ""} />
          </div>
          <div className="field">
            <label>Vertical</label>
            <input name="vertical" defaultValue={company.vertical} required />
          </div>
          <div className="field">
            <label>Employee range</label>
            <input name="employeeRange" defaultValue={company.employeeRange ?? ""} />
          </div>
          <div className="field">
            <label>Notes</label>
            <textarea name="notes" rows={3} defaultValue={company.notes ?? ""} />
          </div>
          <div className="field">
            <label>Verified facts</label>
            <textarea name="verifiedFacts" rows={3} defaultValue={asLines(company.verifiedFacts)} />
          </div>
          <div className="field">
            <label>Hypotheses</label>
            <textarea name="hypotheses" rows={3} defaultValue={asLines(company.hypotheses)} />
          </div>
          <button className="btn" type="submit">
            Update
          </button>
        </form>
      </div>
      <aside className="space-y-4">
        <div className="card">
          <h2 className="font-medium">Contacts</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {company.contacts.map((contact) => (
              <li key={contact.id}>
                <Link href={`/contacts/${contact.id}`} className="hover:underline">
                  {contact.firstName} {contact.lastName} · {contact.role}
                </Link>
              </li>
            ))}
          </ul>
          <Link href={`/contacts/new?companyId=${company.id}`} className="btn-secondary mt-4 inline-flex">
            Add contact
          </Link>
        </div>
      </aside>
    </div>
  );
}
