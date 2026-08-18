import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import {
  ButtonLink,
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
} from "@/components/shared";

export default async function ContactsPage() {
  const contacts = await prisma.contact.findMany({
    include: { company: true, _count: { select: { interviews: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={<Eyebrow>Directory</Eyebrow>}
        title="Contacts"
        description="People invited into discovery interviews."
        actions={<ButtonLink href="/contacts/new">New contact</ButtonLink>}
      />

      {contacts.length === 0 ? (
        <EmptyState
          title="No contacts yet"
          description="Add a contact under a company, then create an interview invitation."
          action={<ButtonLink href="/contacts/new">New contact</ButtonLink>}
        />
      ) : (
        <DataTable>
          <TableHead>
            <Th>Name</Th>
            <Th>Role</Th>
            <Th>Company</Th>
            <Th>Interviews</Th>
            <Th>Added</Th>
          </TableHead>
          <tbody>
            {contacts.map((contact) => {
              const name = `${contact.firstName} ${contact.lastName ?? ""}`.trim();
              return (
                <TableRow key={contact.id}>
                  <Td>
                    <NameCell href={`/contacts/${contact.id}`} name={name} />
                  </Td>
                  <Td>
                    <Truncate className="text-muted-foreground" title={contact.role}>
                      {contact.role}
                    </Truncate>
                  </Td>
                  <Td>
                    <Link
                      href={`/companies/${contact.company.id}`}
                      className="block max-w-[180px] truncate hover:text-primary"
                      title={contact.company.name}
                    >
                      {contact.company.name}
                    </Link>
                  </Td>
                  <Td className="tabular-nums text-muted-foreground">{contact._count.interviews}</Td>
                  <Td className="text-muted-foreground">{formatDate(contact.createdAt)}</Td>
                </TableRow>
              );
            })}
          </tbody>
        </DataTable>
      )}
    </div>
  );
}
