import { getCrmUser, unauthorized } from "@/lib/auth/require-user";
import { deleteLead, upsertLead, type Lead } from "@/lib/db/leads";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  if (!(await getCrmUser())) return unauthorized();
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { lead?: Lead; version?: number | null } | null;
  const lead = body?.lead;
  if (!lead || typeof lead !== "object" || lead.id !== id) {
    return Response.json({ error: "Lead inválido" }, { status: 400 });
  }
  if (typeof lead.nome !== "string" || !lead.nome.trim()) {
    return Response.json({ error: "Nome obrigatório" }, { status: 400 });
  }
  const version = typeof body?.version === "number" ? body.version : null;
  const result = await upsertLead(lead, version);
  if (result === "conflict") return Response.json({ error: "Conflito de versão" }, { status: 409 });
  return Response.json({ version: result });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  if (!(await getCrmUser())) return unauthorized();
  const { id } = await params;
  const ok = await deleteLead(id);
  return ok ? Response.json({ ok: true }) : Response.json({ error: "Lead não encontrado" }, { status: 404 });
}
