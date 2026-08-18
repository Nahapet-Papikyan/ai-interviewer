import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import {
  DataTable,
  EmptyState,
  Eyebrow,
  formatDate,
  NameCell,
  PageHeader,
  TableHead,
  TableRow,
  Td,
  Th,
  Truncate,
} from "@/components/admin/ui";

export default async function CompaniesPage() {
  const companies = await prisma.company.findMany({
    include: { _count: { select: { contacts: true, interviews: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={<Eyebrow>Directory</Eyebrow>}
        title="Companies"
        description="Organizations in the discovery pipeline."
        actions={
          <Link href="/companies/new" className="btn">
            New company
          </Link>
        }
      />

      {companies.length === 0 ? (
        <EmptyState
          title="No companies yet"
          description="Add a company to start inviting contacts."
          action={
            <Link href="/companies/new" className="btn">
              New company
            </Link>
          }
        />
      ) : (
        <DataTable>
          <TableHead>
            <Th>Name</Th>
            <Th>Vertical</Th>
            <Th>Contacts</Th>
            <Th>Interviews</Th>
            <Th>Added</Th>
          </TableHead>
          <tbody>
            {companies.map((company) => (
              <TableRow key={company.id}>
                <Td>
                  <NameCell href={`/companies/${company.id}`} name={company.name} />
                </Td>
                <Td>
                  <Truncate className="text-zinc-600" title={company.vertical}>
                    {company.vertical}
                  </Truncate>
                </Td>
                <Td className="tabular-nums text-zinc-600">{company._count.contacts}</Td>
                <Td className="tabular-nums text-zinc-600">{company._count.interviews}</Td>
                <Td className="text-zinc-500">{formatDate(company.createdAt)}</Td>
              </TableRow>
            ))}
          </tbody>
        </DataTable>
      )}
    </div>
  );
}
