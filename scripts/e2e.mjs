// Teste ponta a ponta do CRM (banco + API + webhook do Instagram).
// Uso: BASE_URL=http://localhost:3000 META_APP_SECRET=... INSTAGRAM_VERIFY_TOKEN=... node scripts/e2e.mjs
// Opcional: COOKIE="<cookie de sessão>" para rodar contra o ambiente publicado.
import { createHmac } from "node:crypto";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const SECRET = process.env.META_APP_SECRET;
const VERIFY = process.env.INSTAGRAM_VERIFY_TOKEN;
const COOKIE = process.env.COOKIE;
let failures = 0;

function check(name, cond, extra = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`);
  if (!cond) failures++;
}
async function call(method, path, body, headers = {}) {
  const h = { ...headers };
  if (COOKIE) h.cookie = COOKIE;
  if (body !== undefined && typeof body !== "string") h["content-type"] = "application/json";
  const r = await fetch(BASE + path, { method, headers: h, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body), redirect: "manual" });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, text, headers: r.headers };
}
function signed(payload) {
  const raw = JSON.stringify(payload);
  const sig = "sha256=" + createHmac("sha256", SECRET).update(raw).digest("hex");
  return { raw, sig };
}
const ACCOUNT = "17841400000000001";
const SENDER = "99" + Date.now();
function dm(mid, text, { echo = false } = {}) {
  return {
    object: "instagram",
    entry: [{ id: ACCOUNT, time: Date.now(), messaging: [{
      sender: { id: echo ? ACCOUNT : SENDER }, recipient: { id: echo ? SENDER : ACCOUNT },
      timestamp: Date.now(), message: { mid, text, ...(echo ? { is_echo: true } : {}) },
    }] }],
  };
}
async function postHook(payload, sigOverride) {
  const { raw, sig } = signed(payload);
  return call("POST", "/api/instagram/webhook", raw, { "content-type": "application/json", "x-hub-signature-256": sigOverride ?? sig });
}
const findIg = (leads) => leads.find((x) => x.lead.instagramId === SENDER);

// 1. Página e banco
const page = await call("GET", "/");
check("GET / entrega o CRM", page.status === 200 && page.text.includes("CRM · Marcelle Rosa"), `status=${page.status}`);
const health = await call("GET", "/api/health");
check("Banco responde", health.status === 200 && health.json?.db === "ok", JSON.stringify(health.json));
let list = await call("GET", "/api/leads");
check("Lista de leads carrega do Postgres", list.status === 200 && Array.isArray(list.json?.leads) && list.json.leads.length >= 49, `total=${list.json?.leads?.length}`);

// 2. CRUD com controle de versão
const id = "LTEST" + Date.now();
const lead = { id, nome: "Teste E2E", etapa: "NOVO", area: "SAÚDE", origem: "SITE", historico: [] };
let r = await call("PUT", `/api/leads/${id}`, { lead, version: null });
check("Cria lead", r.status === 200 && r.json?.version === 1, JSON.stringify(r.json));
r = await call("PUT", `/api/leads/${id}`, { lead: { ...lead, etapa: "PROPOSTA" }, version: 1 });
check("Atualiza lead", r.status === 200 && r.json?.version === 2);
r = await call("PUT", `/api/leads/${id}`, { lead: { ...lead, etapa: "CONTRATO" }, version: 1 });
check("Versão antiga é recusada (409)", r.status === 409);
list = await call("GET", "/api/leads");
check("Alteração persiste no banco", list.json.leads.find((x) => x.lead.id === id)?.lead.etapa === "PROPOSTA");

// 3. Webhook: verificação
r = await call("GET", `/api/instagram/webhook?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(VERIFY)}&hub.challenge=1158201444`);
check("Webhook: verificação com token certo devolve o challenge", r.status === 200 && r.text === "1158201444");
r = await call("GET", "/api/instagram/webhook?hub.mode=subscribe&hub.verify_token=errado&hub.challenge=1");
check("Webhook: token errado é recusado (403)", r.status === 403);

// 4. Webhook: mensagens
r = await postHook(dm("mid.a" + SENDER, "Oi"), "sha256=" + "0".repeat(64));
check("Webhook: assinatura inválida é recusada (401)", r.status === 401);
r = await postHook(dm("mid.1" + SENDER, "Olá, meu plano negou a cirurgia"));
check("Webhook: 1ª mensagem cria lead", r.status === 200 && r.json?.created === 1, JSON.stringify(r.json));
r = await postHook(dm("mid.1" + SENDER, "Olá, meu plano negou a cirurgia"));
check("Webhook: reenvio da mesma mensagem é ignorado", r.status === 200 && r.json?.duplicate === 1);
r = await postHook([dm("mid.2" + SENDER, "Tenho o laudo médico")]);
check("Webhook: 2ª mensagem (payload em array) atualiza o mesmo lead", r.status === 200 && r.json?.updated === 1);
r = await postHook(dm("mid.3" + SENDER, "Pode me enviar os documentos?", { echo: true }));
check("Webhook: resposta do escritório (eco) entra no histórico", r.status === 200 && r.json?.updated === 1);
list = await call("GET", "/api/leads");
const ig = findIg(list.json.leads);
check("Lead do Direct aparece no funil", !!ig && ig.lead.origem === "INSTAGRAM" && ig.lead.etapa === "NOVO",
  ig ? `nome="${ig.lead.nome}" origem=${ig.lead.origem} etapa=${ig.lead.etapa}` : "não encontrado");
check("Histórico com 3 mensagens, mais recente primeiro", ig?.lead.historico?.length === 3 && ig.lead.historico[0].texto.startsWith("Direct (enviada)"),
  JSON.stringify(ig?.lead.historico?.map((h) => h.texto)));
check("Só 1 lead para o mesmo remetente", list.json.leads.filter((x) => x.lead.instagramId === SENDER).length === 1);

// 5. Limpeza
r = await call("DELETE", `/api/leads/${id}`);
check("Exclui lead de teste", r.status === 200);
if (ig) await call("DELETE", `/api/leads/${ig.lead.id}`);

console.log(failures ? `\n${failures} falha(s)` : "\nTodos os testes passaram");
process.exit(failures ? 1 : 0);
