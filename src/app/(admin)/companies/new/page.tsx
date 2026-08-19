import { createCompany } from "../../actions";
import { Breadcrumb, FormField, PageHeader, PendingButton, Surface, TextArea, TextInput } from "@/components/shared";

export default function NewCompanyPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader eyebrow={<Breadcrumb href="/companies">Companies</Breadcrumb>} title="New company" />
      <form action={createCompany}>
        <Surface>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Name">
              <TextInput name="name" required />
            </FormField>
            <FormField label="Legal name">
              <TextInput name="legalName" />
            </FormField>
            <FormField label="Website">
              <TextInput name="website" />
            </FormField>
            <FormField label="Vertical">
              <TextInput name="vertical" required placeholder="FMCG distribution" />
            </FormField>
            <FormField label="Employee range" className="sm:col-span-2">
              <TextInput name="employeeRange" placeholder="20-50" />
            </FormField>
            <FormField label="Notes" className="sm:col-span-2">
              <TextArea name="notes" rows={3} />
            </FormField>
            <FormField label="Verified facts (one per line)">
              <TextArea name="verifiedFacts" rows={4} />
            </FormField>
            <FormField label="Hypotheses (one per line — never presented as facts)">
              <TextArea name="hypotheses" rows={4} />
            </FormField>
          </div>
          <PendingButton type="submit" loadingText="Saving…">
            Save
          </PendingButton>
        </Surface>
      </form>
    </div>
  );
}
