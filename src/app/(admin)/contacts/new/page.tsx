import { prisma } from "@/lib/db/prisma";
import { createContact } from "../../actions";
import { Breadcrumb, Button, FormField, FormSelect, PageHeader, Surface, TextInput } from "@/components/shared";

export default async function NewContactPage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string }>;
}) {
  const { companyId } = await searchParams;
  const companies = await prisma.company.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader eyebrow={<Breadcrumb href="/contacts">Contacts</Breadcrumb>} title="New contact" />
      <form action={createContact}>
        <Surface>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Company" className="sm:col-span-2">
              <FormSelect
                name="companyId"
                defaultValue={companyId ?? ""}
                placeholder="Select company"
                required
                items={companies.map((company) => ({ value: company.id, label: company.name }))}
              />
            </FormField>
            <FormField label="First name">
              <TextInput name="firstName" required />
            </FormField>
            <FormField label="Last name">
              <TextInput name="lastName" />
            </FormField>
            <FormField label="Role">
              <TextInput name="role" placeholder="CEO" required />
            </FormField>
            <FormField label="Preferred language">
              <TextInput name="preferredLanguage" defaultValue="hy" />
            </FormField>
            <FormField label="Email" className="sm:col-span-2">
              <TextInput name="email" type="email" />
            </FormField>
            <FormField label="LinkedIn">
              <TextInput name="linkedinUrl" />
            </FormField>
            <FormField label="Phone">
              <TextInput name="phone" />
            </FormField>
          </div>
          <Button type="submit">Save</Button>
        </Surface>
      </form>
    </div>
  );
}
