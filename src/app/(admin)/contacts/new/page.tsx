import { prisma } from "@/lib/db/prisma";
import { createContact } from "../../actions";

export default async function NewContactPage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string }>;
}) {
  const { companyId } = await searchParams;
  const companies = await prisma.company.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">New contact</h1>
      <form action={createContact} className="card space-y-4">
        <div className="field">
          <label>Company</label>
          <select name="companyId" defaultValue={companyId ?? ""} required>
            <option value="" disabled>
              Select company
            </option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>First name</label>
          <input name="firstName" required />
        </div>
        <div className="field">
          <label>Last name</label>
          <input name="lastName" />
        </div>
        <div className="field">
          <label>Role</label>
          <input name="role" placeholder="CEO" required />
        </div>
        <div className="field">
          <label>Email</label>
          <input name="email" type="email" />
        </div>
        <div className="field">
          <label>LinkedIn</label>
          <input name="linkedinUrl" />
        </div>
        <div className="field">
          <label>Phone</label>
          <input name="phone" />
        </div>
        <div className="field">
          <label>Preferred language</label>
          <input name="preferredLanguage" defaultValue="hy" />
        </div>
        <button className="btn" type="submit">
          Save
        </button>
      </form>
    </div>
  );
}
