import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PoolClient } from "pg";
import { getPool } from "./pool";

export type Lead = Record<string, unknown> & { id: string };
export type LeadRow = { lead: Lead; version: number };

let schemaReady: Promise<void> | null = null;

/** Cria as tabelas (se faltarem) e carrega os 49 registros iniciais uma única vez. */
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const sql = await readFile(path.join(process.cwd(), "db/schema.sql"), "utf8");
      const client = await getPool().connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(724100)");
        await client.query(sql);
        const seeded = await client.query("SELECT 1 FROM crm_meta WHERE key = 'seeded'");
        if (seeded.rowCount === 0) {
          const seed: Lead[] = JSON.parse(await readFile(path.join(process.cwd(), "db/seed.json"), "utf8"));
          for (const l of seed) {
            await client.query(
              "INSERT INTO crm_leads (id, data) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
              [l.id, JSON.stringify(l)],
            );
          }
          await client.query("INSERT INTO crm_meta (key, value) VALUES ('seeded', now()::text)");
        }
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        schemaReady = null;
        throw e;
      } finally {
        client.release();
      }
    })();
  }
  return schemaReady;
}

export async function listLeads(): Promise<LeadRow[]> {
  await ensureSchema();
  const r = await getPool().query(
    "SELECT data, version FROM crm_leads ORDER BY COALESCE(data->>'dataChamado', '') DESC, created_at DESC",
  );
  return r.rows.map((row) => ({ lead: row.data, version: row.version }));
}

function sanitize(lead: Lead): Lead {
  const clean = { ...lead };
  if (typeof clean.instagram === "string") clean.instagram = clean.instagram.replace(/^@/, "").trim();
  return clean;
}

/**
 * Grava um lead. version = versão lida pelo navegador (null para lead novo).
 * Retorna a nova versão, ou "conflict" se o lead mudou no servidor desde a leitura.
 */
export async function upsertLead(lead: Lead, version: number | null): Promise<number | "conflict"> {
  await ensureSchema();
  const data = JSON.stringify(sanitize(lead));
  const pool = getPool();
  if (version == null) {
    const r = await pool.query(
      "INSERT INTO crm_leads (id, data) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING RETURNING version",
      [lead.id, data],
    );
    return r.rowCount ? r.rows[0].version : "conflict";
  }
  const r = await pool.query(
    "UPDATE crm_leads SET data = $2, version = version + 1, updated_at = now() WHERE id = $1 AND version = $3 RETURNING version",
    [lead.id, data, version],
  );
  return r.rowCount ? r.rows[0].version : "conflict";
}

export async function deleteLead(id: string): Promise<boolean> {
  await ensureSchema();
  const r = await getPool().query("DELETE FROM crm_leads WHERE id = $1", [id]);
  return (r.rowCount ?? 0) > 0;
}

/** Substitui todos os leads (botão Importar). Preserva o vínculo com o Instagram pelo campo instagramId. */
export async function replaceAllLeads(leads: Lead[]): Promise<number> {
  await ensureSchema();
  const client: PoolClient = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM crm_leads");
    for (const l of leads) {
      const clean = sanitize(l);
      const igId = typeof clean.instagramId === "string" && clean.instagramId ? clean.instagramId : null;
      await client.query(
        "INSERT INTO crm_leads (id, data, instagram_id) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data",
        [clean.id, JSON.stringify(clean), igId],
      );
    }
    await client.query("COMMIT");
    return leads.length;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
