import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O HTML do CRM e os dados iniciais são lidos do disco pelas rotas do servidor.
  outputFileTracingIncludes: {
    "/": ["./crm/index.html"],
    "/api/leads": ["./db/seed.json", "./db/schema.sql"],
    "/api/leads/[id]": ["./db/seed.json", "./db/schema.sql"],
    "/api/leads/import": ["./db/seed.json", "./db/schema.sql"],
    "/api/instagram/webhook": ["./db/seed.json", "./db/schema.sql"],
  },
};

export default nextConfig;
