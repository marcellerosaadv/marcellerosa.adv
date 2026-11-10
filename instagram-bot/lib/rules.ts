// Regras puras de correspondência (sem banco), testadas em tests/rules.test.ts

export type Rule = {
  id: number;
  trigger: "comment" | "dm";
  keywords: string;
  match_mode: "contains" | "exact";
  media_id: string | null;
  active: boolean;
};

export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function keywordList(keywords: string): string[] {
  return keywords
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean)
    .map((k) => (k === "*" ? "*" : normalize(k)))
    .filter(Boolean);
}

/** Retorna a palavra-chave que casou, ou null. "*" casa com qualquer texto. */
export function matchKeyword(text: string, rule: Pick<Rule, "keywords" | "match_mode">): string | null {
  const t = normalize(text);
  for (const k of keywordList(rule.keywords)) {
    if (k === "*") return "*";
    if (rule.match_mode === "exact" ? t === k : ` ${t} `.includes(` ${k} `)) return k;
  }
  return null;
}

/**
 * Escolhe a automação: ativas do gatilho certo; as específicas do post vêm antes das gerais;
 * palavra-chave mais longa antes da mais curta; curinga "*" por último.
 */
export function pickRule<R extends Rule>(
  rules: R[],
  trigger: Rule["trigger"],
  text: string,
  mediaId?: string | null,
): R | null {
  const candidates: { rule: R; score: number }[] = [];
  for (const r of rules) {
    if (!r.active || r.trigger !== trigger) continue;
    if (r.media_id && r.media_id !== mediaId) continue;
    const hit = matchKeyword(text, r);
    if (!hit) continue;
    const score = (r.media_id ? 10_000 : 0) + (hit === "*" ? 0 : 1_000 + hit.length);
    candidates.push({ rule: r, score });
  }
  candidates.sort((a, b) => b.score - a.score || a.rule.id - b.rule.id);
  return candidates[0]?.rule ?? null;
}

export function extractPhone(text: string): string | null {
  const m = text.match(/(?:\+?55\s?)?\(?\d{2}\)?\s?9?\s?\d{4}[-\s.]?\d{4}/);
  if (!m) return null;
  const digits = m[0].replace(/\D/g, "");
  return digits.length >= 10 ? digits : null;
}

export function extractEmail(text: string): string | null {
  const m = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  return m ? m[0].toLowerCase() : null;
}

export function quickReplyTitles(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 13)
    .map((s) => s.slice(0, 20));
}
