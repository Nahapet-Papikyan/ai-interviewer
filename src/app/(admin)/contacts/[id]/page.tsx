import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { createInvitation, updateContact } from "../../actions";
import { notFound } from "next/navigation";
import { Breadcrumb, PageHeader, StatusBadge } from "@/components/admin/ui";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contact = await prisma.contact.findUnique({
    where: { id },
    include: { company: true, interviews: { orderBy: { createdAt: "desc" }, include: { _count: { select: { messages: true } } } } },
  });
  if (!contact) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        eyebrow={<Breadcrumb href="/contacts">Contacts</Breadcrumb>}
        title={`${contact.firstName} ${contact.lastName ?? ""}`.trim()}
        description={
          <>
            {contact.role} at{" "}
            <Link href={`/companies/${contact.company.id}`} className="hover:text-ink hover:underline">
              {contact.company.name}
            </Link>
          </>
        }
      />

      <form action={updateContact} className="card space-y-4">
        <input type="hidden" name="id" value={contact.id} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="field">
            <label>First name</label>
            <input name="firstName" defaultValue={contact.firstName} required />
          </div>
          <div className="field">
            <label>Last name</label>
            <input name="lastName" defaultValue={contact.lastName ?? ""} />
          </div>
          <div className="field">
            <label>Role</label>
            <input name="role" defaultValue={contact.role} required />
          </div>
          <div className="field">
            <label>Preferred language</label>
            <input name="preferredLanguage" defaultValue={contact.preferredLanguage} />
          </div>
          <div className="field sm:col-span-2">
            <label>Email</label>
            <input name="email" defaultValue={contact.email ?? ""} />
          </div>
          <div className="field">
            <label>LinkedIn</label>
            <input name="linkedinUrl" defaultValue={contact.linkedinUrl ?? ""} />
          </div>
          <div className="field">
            <label>Phone</label>
            <input name="phone" defaultValue={contact.phone ?? ""} />
          </div>
        </div>
        <button className="btn" type="submit">
          Update
        </button>
      </form>

      <form action={createInvitation} className="card space-y-3">
        <input type="hidden" name="contactId" value={contact.id} />
        <h2 className="font-medium">Create interview invitation</h2>
        <p className="text-sm text-zinc-500">
          Generates an opaque /i/token link. The plaintext token is shown once.
        </p>
        <button className="btn" type="submit">
          Create invitation
        </button>
      </form>

      {contact.interviews.length ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-ink">Interviews</h2>
          <ul className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white">
            {contact.interviews.map((interview) => (
              <li key={interview.id}>
                <Link href={`/interviews/${interview.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-sky-50/40">
                  <div className="text-sm text-zinc-600">{interview._count.messages} turns</div>
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
