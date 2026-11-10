# Instagram Bot · Marcelle Rosa Advocacia

Automação de Instagram no estilo ManyChat, própria, rodando na **Vercel** com banco **Neon**.
Usa somente a API oficial da Meta (Instagram API with Instagram Login).

## O que faz

- **Comentário vira DM:** a pessoa comenta uma palavra-chave no post/reel e recebe uma resposta privada no direct
  (opcionalmente, também uma resposta pública no comentário).
- **Resposta automática no direct** por palavra-chave, com **botões de resposta rápida** para montar fluxos.
- **Curinga `*`:** resposta padrão para qualquer mensagem (no máximo uma a cada 12h por pessoa).
- **Atendimento humano:** quando você responde manualmente no direct, o bot fica em silêncio com aquela pessoa
  por 24h (ajustável). Também dá para pausar ou reativar o bot por lead no painel.
- **Captura de lead:** grava @, telefone e e-mail que a pessoa digitar e a origem (qual automação trouxe).
  Exporta CSV.
- **LGPD:** aviso de privacidade enviado uma vez na primeira mensagem e botão de expurgo de dados antigos.
- **Token:** renovação automática do token de 60 dias via Vercel Cron.

## Regras da Meta (não dá para contornar)

- Conta do Instagram precisa ser **profissional** (comercial ou criador).
- Resposta privada a comentário: **uma por comentário, até 7 dias** após o comentário.
- Direct só pode ser enviado **até 24h** depois da última mensagem da pessoa. Por isso não há disparo em massa.

## Instalação (uma vez)

### 1. Neon
1. Crie um projeto em neon.tech (região São Paulo, se disponível).
2. Copie a *connection string* (pooled).
3. Crie as tabelas: `DATABASE_URL="..." npm run db:migrate`
   (ou cole o conteúdo de `sql/schema.sql` no *SQL Editor* do Neon).

### 2. Vercel
1. *Add New Project* → importe este repositório.
2. Em **Root Directory**, escolha `instagram-bot`.
3. Cadastre as variáveis de ambiente conforme `.env.example`.
4. Faça o deploy e anote a URL (ex.: `https://instagram-mra.vercel.app`).

### 3. Meta (developers.facebook.com)
1. *Create App* → tipo **Business** → adicione o produto **Instagram** →
   *API setup with Instagram login*.
2. Em *Generate access tokens*, conecte a conta do Instagram do escritório e copie o token
   para `IG_ACCESS_TOKEN` na Vercel. Copie também o **Instagram app secret** para `META_APP_SECRET`.
3. Em *Configure webhooks*:
   - Callback URL: `https://SEU-DOMINIO.vercel.app/api/webhook`
   - Verify token: o mesmo valor de `META_VERIFY_TOKEN`
   - Inscreva os campos **comments** e **messages**.
4. Permissões usadas: `instagram_business_basic`, `instagram_business_manage_messages`,
   `instagram_business_manage_comments`.
5. No app do Instagram: *Configurações → Mensagens e respostas → Ferramentas conectadas* →
   ative **Permitir acesso às mensagens**.
6. Para usar só na sua própria conta (você é administradora do app), o app pode ficar com
   acesso padrão. Para atender contas de terceiros, é preciso passar pela App Review da Meta.

### 4. Primeiro teste
1. Abra o painel (usuário/senha de `ADMIN_USER` / `ADMIN_PASSWORD`).
2. Em **Configurações**, salve o aviso de privacidade.
3. Em **Automações**, crie: gatilho *Comentário*, palavra-chave `TESTE`, uma mensagem.
4. Com **outro perfil**, comente `TESTE` num post. A DM deve chegar em segundos.
5. Se não chegar, veja o **Registro de eventos** em Configurações e os logs da função na Vercel.

## Desenvolvimento

```bash
npm install
cp .env.example .env.local   # preencha
npm run dev
npm test                     # testes das regras e da assinatura
```

Estrutura:

| Caminho | Função |
|---|---|
| `app/api/webhook/route.ts` | Recebe eventos da Meta, confere a assinatura e responde 200 na hora |
| `lib/engine.ts` | Decide a resposta: comentários, direct, pausa humana, captura de lead |
| `lib/rules.ts` | Correspondência de palavras-chave (sem acento, sem diferenciar maiúsculas) |
| `lib/instagram.ts` | Chamadas à API do Instagram e renovação do token |
| `app/api/cron/refresh-token` | Renovação automática do token (diária, renova a cada 7 dias) |
| `proxy.ts` | Senha do painel |
| `sql/schema.sql` | Tabelas do Neon |
