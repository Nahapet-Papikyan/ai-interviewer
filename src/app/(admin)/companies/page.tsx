import Link from "next/link";
import { prisma } from "@/lib/db/prisma";

export default async function CompaniesPage() {
  const companies = await prisma.company.findMany({
    include: { _count: { select: { contacts: true, interviews: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Companies</h1>
        <Link href="/companies/new" className="btn">
          New company
        </Link>
      </div>
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Vertical</th>
              <th className="px-4 py-2 font-medium">Contacts</th>
              <th className="px-4 py-2 font-medium">Interviews</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((company) => (
              <tr key={company.id} className="border-t border-zinc-100">
                <td className="px-4 py-2">
                  <Link href={`/companies/${company.id}`} className="hover:underline">
                    {company.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-zinc-600">{company.vertical}</td>
                <td className="px-4 py-2">{company._count.contacts}</td>
                <td className="px-4 py-2">{company._count.interviews}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
