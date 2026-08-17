import { createCompany } from "../../actions";

export default function NewCompanyPage() {
  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">New company</h1>
      <form action={createCompany} className="card space-y-4">
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
        <div className="field">
          <label>Employee range</label>
          <input name="employeeRange" placeholder="20-50" />
        </div>
        <div className="field">
          <label>Notes</label>
          <textarea name="notes" rows={3} />
        </div>
        <div className="field">
          <label>Verified facts (one per line)</label>
          <textarea name="verifiedFacts" rows={3} />
        </div>
        <div className="field">
          <label>Hypotheses (one per line — never presented as facts)</label>
          <textarea name="hypotheses" rows={3} />
        </div>
        <button className="btn" type="submit">
          Save
        </button>
      </form>
    </div>
  );
}
