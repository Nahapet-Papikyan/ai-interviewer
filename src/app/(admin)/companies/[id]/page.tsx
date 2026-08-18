import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { updateCompany } from "../../actions";
import { Breadcrumb, Eyebrow, PageHeader, StatusBadge } from "@/components/admin/ui";

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
    include: {
      contacts: true,
      interviews: { orderBy: { createdAt: "desc" }, include: { contact: true, _count: { select: { messages: true } } } },
    },
  });
  if (!company) notFound();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={<Breadcrumb href="/companies">Companies</Breadcrumb>}
        title={company.name}
        description={company.vertical}
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <form action={updateCompany} className="card space-y-4">
          <input type="hidden" name="id" value={company.id} />
          <div className="grid gap-4 sm:grid-cols-2">
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
            <div className="field sm:col-span-2">
              <label>Employee range</label>
              <input name="employeeRange" defaultValue={company.employeeRange ?? ""} />
            </div>
            <div className="field sm:col-span-2">
              <label>Notes</label>
              <textarea name="notes" rows={3} defaultValue={company.notes ?? ""} />
            </div>
            <div className="field">
              <label>Verified facts</label>
              <textarea name="verifiedFacts" rows={4} defaultValue={asLines(company.verifiedFacts)} />
            </div>
            <div className="field">
              <label>Hypotheses</label>
              <textarea name="hypotheses" rows={4} defaultValue={asLines(company.hypotheses)} />
            </div>
          </div>
          <button className="btn" type="submit">
            Update
          </button>
        </form>

        <aside className="space-y-4">
          <div className="card">
            <Eyebrow>Contacts</Eyebrow>
            <ul className="mt-4 space-y-2 text-sm">
              {company.contacts.length === 0 ? (
                <li className="text-zinc-500">No contacts yet.</li>
              ) : (
                company.contacts.map((contact) => (
                  <li key={contact.id}>
                    <Link href={`/contacts/${contact.id}`} className="hover:text-brand">
                      {contact.firstName} {contact.lastName} · {contact.role}
                    </Link>
                  </li>
                ))
              )}
            </ul>
            <Link href={`/contacts/new?companyId=${company.id}`} className="btn-secondary mt-4 inline-flex">
              Add contact
            </Link>
          </div>
        </aside>
      </div>

      {company.interviews.length ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-ink">Interviews</h2>
          <ul className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white">
            {company.interviews.map((interview) => (
              <li key={interview.id}>
                <Link href={`/interviews/${interview.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-sky-50/40">
                  <div>
                    <div className="text-sm font-medium">
                      {interview.contact.firstName} {interview.contact.lastName}
                    </div>
                    <div className="text-xs text-zinc-400">{interview._count.messages} turns</div>
                  </div>
                  <StatusBadge status={interview.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
