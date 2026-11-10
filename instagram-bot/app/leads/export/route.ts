import { q } from "@/lib/db";

export const dynamic = "force-dynamic";

const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export async function GET() {
  const rows = await q<Record<string, unknown>>(
    `SELECT username, phone, email, origin, created_at, last_inbound_at FROM contacts ORDER BY created_at DESC`,
  );
  const head = ["usuario", "telefone", "email", "origem", "primeiro_contato", "ultima_mensagem"];
  const lines = rows.map((r) =>
    [r.username, r.phone, r.email, r.origin, r.created_at, r.last_inbound_at].map(esc).join(";"),
  );
  const csv = "﻿" + [head.join(";"), ...lines].join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-instagram.csv"`,
    },
  });
}
