import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { updateCompany } from "../../actions";
import {
  Breadcrumb,
  Button,
  ButtonLink,
  Card,
  CardContent,
  Eyebrow,
  FormField,
  PageHeader,
  StatusBadge,
  Surface,
  TextArea,
  TextInput,
} from "@/components/shared";

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
        <form action={updateCompany}>
          <Surface>
            <input type="hidden" name="id" value={company.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Name">
                <TextInput name="name" defaultValue={company.name} required />
              </FormField>
              <FormField label="Legal name">
                <TextInput name="legalName" defaultValue={company.legalName ?? ""} />
              </FormField>
              <FormField label="Website">
                <TextInput name="website" defaultValue={company.website ?? ""} />
              </FormField>
              <FormField label="Vertical">
                <TextInput name="vertical" defaultValue={company.vertical} required />
              </FormField>
              <FormField label="Employee range" className="sm:col-span-2">
                <TextInput name="employeeRange" defaultValue={company.employeeRange ?? ""} />
              </FormField>
              <FormField label="Notes" className="sm:col-span-2">
                <TextArea name="notes" rows={3} defaultValue={company.notes ?? ""} />
              </FormField>
              <FormField label="Verified facts">
                <TextArea name="verifiedFacts" rows={4} defaultValue={asLines(company.verifiedFacts)} />
              </FormField>
              <FormField label="Hypotheses">
                <TextArea name="hypotheses" rows={4} defaultValue={asLines(company.hypotheses)} />
              </FormField>
            </div>
            <Button type="submit">Update</Button>
          </Surface>
        </form>

        <aside className="space-y-4">
          <Card className="py-5 ring-foreground/8">
            <CardContent>
              <Eyebrow>Contacts</Eyebrow>
              <ul className="mt-4 space-y-2 text-sm">
                {company.contacts.length === 0 ? (
                  <li className="text-muted-foreground">No contacts yet.</li>
                ) : (
                  company.contacts.map((contact) => (
                    <li key={contact.id}>
                      <Link href={`/contacts/${contact.id}`} className="hover:text-primary">
                        {contact.firstName} {contact.lastName} · {contact.role}
                      </Link>
                    </li>
                  ))
                )}
              </ul>
              <ButtonLink href={`/contacts/new?companyId=${company.id}`} variant="outline" className="mt-4">
                Add contact
              </ButtonLink>
            </CardContent>
          </Card>
        </aside>
      </div>

      {company.interviews.length ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Interviews</h2>
          <Card className="gap-0 overflow-hidden py-0 ring-foreground/8">
            <ul className="divide-y">
              {company.interviews.map((interview) => (
                <li key={interview.id}>
                  <Link
                    href={`/interviews/${interview.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50"
                  >
                    <div>
                      <div className="text-sm font-medium">
                        {interview.contact.firstName} {interview.contact.lastName}
                      </div>
                      <div className="text-xs text-muted-foreground">{interview._count.messages} turns</div>
                    </div>
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
