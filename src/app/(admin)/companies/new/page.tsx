import { createCompany } from "../../actions";
import { Breadcrumb, PageHeader } from "@/components/admin/ui";

export default function NewCompanyPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader eyebrow={<Breadcrumb href="/companies">Companies</Breadcrumb>} title="New company" />
      <form action={createCompany} className="card space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="field">
            <label>Name</label>
            <input name="name" required />
          </div>
          <div className="field">
            <label>Legal name</label>
            <input name="legalName" />
          </div>
          <div className="field">
            <label>Website</label>
            <input name="website" />
          </div>
          <div className="field">
            <label>Vertical</label>
            <input name="vertical" required placeholder="FMCG distribution" />
          </div>
          <div className="field sm:col-span-2">
            <label>Employee range</label>
            <input name="employeeRange" placeholder="20-50" />
          </div>
          <div className="field sm:col-span-2">
            <label>Notes</label>
            <textarea name="notes" rows={3} />
          </div>
          <div className="field">
            <label>Verified facts (one per line)</label>
            <textarea name="verifiedFacts" rows={4} />
          </div>
          <div className="field">
            <label>Hypotheses (one per line — never presented as facts)</label>
            <textarea name="hypotheses" rows={4} />
          </div>
        </div>
        <button className="btn" type="submit">
          Save
        </button>
      </form>
    </div>
  );
}
