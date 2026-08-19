import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { createInvitation, updateContact } from "../../actions";
import { notFound } from "next/navigation";
import {
  Breadcrumb,
  Card,
  FormField,
  PageHeader,
  PendingButton,
  StatusBadge,
  Surface,
  TextInput,
} from "@/components/shared";

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
            <Link href={`/companies/${contact.company.id}`} className="hover:text-foreground hover:underline">
              {contact.company.name}
            </Link>
          </>
        }
      />

      <form action={updateContact}>
        <Surface>
          <input type="hidden" name="id" value={contact.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="First name">
              <TextInput name="firstName" defaultValue={contact.firstName} required />
            </FormField>
            <FormField label="Last name">
              <TextInput name="lastName" defaultValue={contact.lastName ?? ""} />
            </FormField>
            <FormField label="Role">
              <TextInput name="role" defaultValue={contact.role} required />
            </FormField>
            <FormField label="Preferred language">
              <TextInput name="preferredLanguage" defaultValue={contact.preferredLanguage} />
            </FormField>
            <FormField label="Email" className="sm:col-span-2">
              <TextInput name="email" defaultValue={contact.email ?? ""} />
            </FormField>
            <FormField label="LinkedIn">
              <TextInput name="linkedinUrl" defaultValue={contact.linkedinUrl ?? ""} />
            </FormField>
            <FormField label="Phone">
              <TextInput name="phone" defaultValue={contact.phone ?? ""} />
            </FormField>
          </div>
          <PendingButton type="submit" loadingText="Saving…">
            Update
          </PendingButton>
        </Surface>
      </form>

      <form action={createInvitation}>
        <Surface>
          <input type="hidden" name="contactId" value={contact.id} />
          <h2 className="font-medium">Create interview invitation</h2>
          <p className="text-sm text-muted-foreground">
            Generates an opaque /i/token link. The plaintext token is shown once.
          </p>
          <PendingButton type="submit" loadingText="Creating…">
            Create invitation
          </PendingButton>
        </Surface>
      </form>

      {contact.interviews.length ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Interviews</h2>
          <Card className="gap-0 overflow-hidden py-0 ring-foreground/8">
            <ul className="divide-y">
              {contact.interviews.map((interview) => (
                <li key={interview.id}>
                  <Link
                    href={`/interviews/${interview.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50"
                  >
                    <div className="text-sm text-muted-foreground">{interview._count.messages} turns</div>
                    <StatusBadge status={interview.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
