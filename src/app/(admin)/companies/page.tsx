import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import {
  Avatar,
  ButtonLink,
  DataTable,
  EmptyState,
  Eyebrow,
  formatDate,
  ItemCard,
  ItemCardStat,
  NameCell,
  PageHeader,
  TableHead,
  TableRow,
  Td,
  Th,
  Truncate,
} from "@/components/shared";

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
        actions={<ButtonLink href="/companies/new">New company</ButtonLink>}
      />

      {companies.length === 0 ? (
        <EmptyState
          title="No companies yet"
          description="Add a company to start inviting contacts."
          action={<ButtonLink href="/companies/new">New company</ButtonLink>}
        />
      ) : (
        <DataTable
          mobile={companies.map((company) => (
            <ItemCard key={company.id}>
              <div className="flex items-center gap-3">
                <Avatar name={company.name} />
                <div className="min-w-0">
                  <Link href={`/companies/${company.id}`} className="block truncate font-semibold hover:text-primary">
                    {company.name}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">{company.vertical}</p>
                </div>
              </div>
              <dl className="grid grid-cols-3 gap-3">
                <ItemCardStat label="Contacts" value={company._count.contacts} />
                <ItemCardStat label="Interviews" value={company._count.interviews} />
                <ItemCardStat label="Added" value={formatDate(company.createdAt)} />
              </dl>
            </ItemCard>
          ))}
        >
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
                  <Truncate className="text-muted-foreground" title={company.vertical}>
                    {company.vertical}
                  </Truncate>
                </Td>
                <Td className="tabular-nums text-muted-foreground">{company._count.contacts}</Td>
                <Td className="tabular-nums text-muted-foreground">{company._count.interviews}</Td>
                <Td className="text-muted-foreground">{formatDate(company.createdAt)}</Td>
              </TableRow>
            ))}
          </tbody>
        </DataTable>
      )}
    </div>
  );
}
