import { getCrmUser, unauthorized } from "@/lib/auth/require-user";
import { listLeads } from "@/lib/db/leads";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getCrmUser())) return unauthorized();
  const leads = await listLeads();
  return Response.json({ leads }, { headers: { "Cache-Control": "no-store" } });
}
