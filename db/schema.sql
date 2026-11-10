-- CRM Marcelle Rosa Advocacia: esquema do banco (idempotente)
CREATE TABLE IF NOT EXISTS crm_leads (
  id            text PRIMARY KEY,
  data          jsonb NOT NULL,
  instagram_id  text UNIQUE,
  version       integer NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_instagram_messages (
  mid           text PRIMARY KEY,
  lead_id       text REFERENCES crm_leads(id) ON DELETE SET NULL,
  igsid         text NOT NULL,
  direction     text NOT NULL CHECK (direction IN ('in','out')),
  text          text,
  attachments   jsonb,
  sent_at       timestamptz NOT NULL,
  received_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_instagram_messages_igsid_idx ON crm_instagram_messages (igsid, sent_at DESC);

CREATE TABLE IF NOT EXISTS crm_meta (
  key   text PRIMARY KEY,
  value text NOT NULL
);
