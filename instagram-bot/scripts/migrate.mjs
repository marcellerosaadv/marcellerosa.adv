// Cria as tabelas no Neon. Uso: DATABASE_URL=... npm run db:migrate
import { readFileSync } from "node:fs";
import { Pool } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL (connection string do Neon).");
  process.exit(1);
}
const sqlText = readFileSync(new URL("../sql/schema.sql", import.meta.url), "utf8");
const pool = new Pool({ connectionString: url });
await pool.query(sqlText);
await pool.end();
console.log("Tabelas criadas/atualizadas com sucesso.");
