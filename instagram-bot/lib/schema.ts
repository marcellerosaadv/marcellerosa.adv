// Esquema do banco. Criado automaticamente no primeiro acesso (CREATE IF NOT EXISTS).
export const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`,
  `CREATE TABLE IF NOT EXISTS contacts (
  ig_user_id      TEXT PRIMARY KEY,
  username        TEXT,
  phone           TEXT,
  email           TEXT,
  origin          TEXT,             -- ex.: "comentario:PLANO", "direct"
  notice_sent     BOOLEAN NOT NULL DEFAULT false,
  paused_until    TIMESTAMPTZ,      -- atendimento humano: bot fica em silêncio até aqui
  last_inbound_at TIMESTAMPTZ,
  last_auto_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
)`,
  `CREATE TABLE IF NOT EXISTS messages (
  id          BIGSERIAL PRIMARY KEY,
  ig_user_id  TEXT NOT NULL,
  direction   TEXT NOT NULL CHECK (direction IN ('in', 'out_bot', 'out_humano')),
  text        TEXT,
  mid         TEXT UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
)`,
  `CREATE INDEX IF NOT EXISTS messages_user_idx ON messages (ig_user_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS automations (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  trigger       TEXT NOT NULL CHECK (trigger IN ('comment', 'dm')),
  keywords      TEXT NOT NULL,        -- separadas por vírgula`,
  `"*" = qualquer mensagem
  match_mode    TEXT NOT NULL DEFAULT 'contains' CHECK (match_mode IN ('contains', 'exact')),
  media_id      TEXT,                 -- opcional: só para um post/reel específico
  dm_text       TEXT NOT NULL,
  public_reply  TEXT,                 -- opcional: resposta pública no comentário
  quick_replies TEXT,                 -- opcional: um botão por linha (só no direct)
  active        BOOLEAN NOT NULL DEFAULT true,
  hits          INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
)`,
  `CREATE TABLE IF NOT EXISTS processed_comments (
  comment_id    TEXT PRIMARY KEY,
  ig_user_id    TEXT,
  automation_id INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
)`,
  `CREATE TABLE IF NOT EXISTS event_log (
  id         BIGSERIAL PRIMARY KEY,
  level      TEXT NOT NULL DEFAULT 'info',
  message    TEXT NOT NULL,
  detail     JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`,
];
