import { getCrmUser, unauthorized } from "@/lib/auth/require-user";
import { replaceAllLeads, type Lead } from "@/lib/db/leads";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await getCrmUser())) return unauthorized();
  const body = (await req.json().catch(() => null)) as { leads?: Lead[] } | null;
  const leads = body?.leads;
  if (!Array.isArray(leads) || leads.some((l) => !l || typeof l.id !== "string" || !l.id)) {
    return Response.json({ error: "Arquivo inválido" }, { status: 400 });
  }
  const n = await replaceAllLeads(leads);
  return Response.json({ imported: n });
}
