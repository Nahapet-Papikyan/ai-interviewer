import Link from "next/link";
import { prisma } from "@/lib/db/prisma";

export default async function ContactsPage() {
  const contacts = await prisma.contact.findMany({
    include: { company: true, _count: { select: { interviews: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Contacts</h1>
        <Link href="/contacts/new" className="btn">
          New contact
        </Link>
      </div>
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Company</th>
              <th className="px-4 py-2 font-medium">Interviews</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact) => (
              <tr key={contact.id} className="border-t border-zinc-100">
                <td className="px-4 py-2">
                  <Link href={`/contacts/${contact.id}`} className="hover:underline">
                    {contact.firstName} {contact.lastName}
                  </Link>
                </td>
                <td className="px-4 py-2 text-zinc-600">{contact.role}</td>
                <td className="px-4 py-2">{contact.company.name}</td>
                <td className="px-4 py-2">{contact._count.interviews}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
