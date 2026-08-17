import { prisma } from "@/lib/db/prisma";
import { createInvitation, updateContact } from "../../actions";
import { notFound } from "next/navigation";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contact = await prisma.contact.findUnique({
    where: { id },
    include: { company: true, interviews: true },
  });
  if (!contact) notFound();

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">
        {contact.firstName} {contact.lastName}
      </h1>
      <p className="text-sm text-zinc-500">
        {contact.role} at {contact.company.name}
      </p>
      <form action={updateContact} className="card space-y-4">
        <input type="hidden" name="id" value={contact.id} />
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
        <div className="field">
          <label>Preferred language</label>
          <input name="preferredLanguage" defaultValue={contact.preferredLanguage} />
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
    </div>
  );
}
