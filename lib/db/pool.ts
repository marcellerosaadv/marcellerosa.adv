import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";

let pool: Pool | null = null;

/** Pool node-postgres (recomendado pela Neon para Vercel Fluid compute). */
export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL não configurada");
    pool = new Pool({ connectionString, max: 5 });
    attachDatabasePool(pool);
  }
  return pool;
}
