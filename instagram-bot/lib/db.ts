import { neon } from "@neondatabase/serverless";
import { SCHEMA } from "./schema";

let client: ReturnType<typeof neon> | null = null;

export function sql() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL não configurada");
    client = neon(url);
  }
  return client;
}

let ready: Promise<void> | null = null;

/** Cria as tabelas uma vez por instância (idempotente). */
function ensureSchema(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      for (const stmt of SCHEMA) await sql().query(stmt);
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

export async function q<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  await ensureSchema();
  return (await sql().query(text, params)) as T[];
}

export async function getSetting(key: string): Promise<string | null> {
  const rows = await q<{ value: string }>("SELECT value FROM settings WHERE key = $1", [key]);
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  await q(
    `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, value],
  );
}

export async function log(message: string, detail?: unknown, level: "info" | "erro" = "info") {
  try {
    await q("INSERT INTO event_log (level, message, detail) VALUES ($1, $2, $3)", [
      level,
      message,
      detail === undefined ? null : JSON.stringify(detail),
    ]);
  } catch (e) {
    console.error("falha ao gravar log", e);
  }
}
