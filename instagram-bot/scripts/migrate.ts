// Opcional: as tabelas já são criadas sozinhas no primeiro acesso.
// Uso manual: DATABASE_URL=... npm run db:migrate
import { neon } from "@neondatabase/serverless";
import { SCHEMA } from "../lib/schema.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL (connection string do Neon).");
  process.exit(1);
}
const sql = neon(url);
for (const stmt of SCHEMA) await sql.query(stmt);
console.log(`Tabelas criadas/atualizadas (${SCHEMA.length} comandos).`);
