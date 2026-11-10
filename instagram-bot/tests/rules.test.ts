import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, matchKeyword, pickRule, extractPhone, extractEmail, quickReplyTitles } from "../lib/rules.ts";
import { verifySignature } from "../lib/signature.ts";
import { createHmac } from "node:crypto";

const r = (o: Partial<Parameters<typeof pickRule>[0][0]>) =>
  ({ id: 1, trigger: "comment", keywords: "", match_mode: "contains", media_id: null, active: true, ...o }) as const;

test("normaliza acentos, caixa e pontuação", () => {
  assert.equal(normalize("  Reajúste!!  PLANO "), "reajuste plano");
});

test("contém: palavra inteira, sem acento", () => {
  assert.equal(matchKeyword("quero saber do REAJUSTE!", { keywords: "reajuste", match_mode: "contains" }), "reajuste");
  assert.equal(matchKeyword("planos", { keywords: "plano", match_mode: "contains" }), null);
  assert.equal(matchKeyword("Clexane gestação", { keywords: "gestacao", match_mode: "contains" }), "gestacao");
});

test("exata", () => {
  assert.equal(matchKeyword("Plano", { keywords: "plano", match_mode: "exact" }), "plano");
  assert.equal(matchKeyword("plano sim", { keywords: "plano", match_mode: "exact" }), null);
});

test("prioridade: post específico > geral > curinga", () => {
  const rules = [
    r({ id: 1, keywords: "*" }),
    r({ id: 2, keywords: "plano" }),
    r({ id: 3, keywords: "plano", media_id: "M1" }),
    r({ id: 4, keywords: "plano", trigger: "dm" }),
    r({ id: 5, keywords: "plano", active: false, media_id: "M2" }),
  ];
  assert.equal(pickRule(rules, "comment", "PLANO", "M1")?.id, 3);
  assert.equal(pickRule(rules, "comment", "plano", "M2")?.id, 2);
  assert.equal(pickRule(rules, "comment", "oi", "M2")?.id, 1);
  assert.equal(pickRule(rules, "dm", "plano")?.id, 4);
  assert.equal(pickRule(rules, "dm", "oi"), null);
});

test("extrai telefone e email", () => {
  assert.equal(extractPhone("meu zap é (21) 99876-5432"), "21998765432");
  assert.equal(extractPhone("+55 21 98765 4321"), "5521987654321");
  assert.equal(extractPhone("processo 123"), null);
  assert.equal(extractEmail("Fulana@Email.com.br ok"), "fulana@email.com.br");
});

test("botões: máximo 13 e 20 caracteres", () => {
  const t = quickReplyTitles("Plano de saúde negado hoje\n\nSUS");
  assert.deepEqual(t, ["Plano de saúde negad", "SUS"]);
});

test("assinatura do webhook", () => {
  const body = '{"object":"instagram"}';
  const sig = "sha256=" + createHmac("sha256", "s3cr3t").update(body).digest("hex");
  assert.equal(verifySignature(body, sig, "s3cr3t"), true);
  assert.equal(verifySignature(body + " ", sig, "s3cr3t"), false);
  assert.equal(verifySignature(body, null, "s3cr3t"), false);
  assert.equal(verifySignature(body, "sha256=abc", "s3cr3t"), false);
});
