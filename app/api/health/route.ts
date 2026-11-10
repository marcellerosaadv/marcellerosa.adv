import { getCrmUser, unauthorized } from "@/lib/auth/require-user";
import { getPool } from "@/lib/db/pool";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getCrmUser())) return unauthorized();
  const r = await getPool().query("SELECT version() AS v, now() AS t");
  return Response.json({ db: "ok", postgres: String(r.rows[0].v).split(" ").slice(0, 2).join(" "), now: r.rows[0].t });
}
