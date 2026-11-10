# CRM · Marcelle Rosa Advocacia

CRM e funil de clientes do escritório, com entrada automática das conversas do **Direct do Instagram**.

- **Hospedagem:** Vercel (Next.js)
- **Banco:** Postgres da Neon (driver `pg` com `attachDatabasePool`, recomendado pela Neon para Vercel)
- **Login:** Neon Auth (e-mail e senha) + lista de e-mails autorizados
- **Direct:** webhook do app "MRA Instchat" (Meta for Developers)

## Como funciona o Direct

1. Alguém manda mensagem no Direct do escritório.
2. A Meta chama `POST /api/instagram/webhook`. A assinatura `X-Hub-Signature-256` é conferida com o App Secret.
3. Contato novo: vira lead na etapa **Novo**, origem **INSTAGRAM**, campanha **Direct**.
   Contato já existente: a mensagem entra no **histórico** e atualiza o **último contato**.
4. As respostas enviadas pelo escritório (eco) também entram no histórico.
5. Mensagens reenviadas pela Meta são ignoradas (controle pelo `mid`).
6. O CRM aberto no navegador atualiza sozinho a cada 30 segundos.

## Variáveis de ambiente (Vercel › Settings › Environment Variables)

| Variável | Origem |
| --- | --- |
| `DATABASE_URL` | Injetada pela integração Neon do Marketplace da Vercel |
| `NEON_AUTH_BASE_URL` | Painel da Neon › Auth (URL do Auth do branch) |
| `NEON_AUTH_COOKIE_SECRET` | Gerar: `openssl rand -base64 32` |
| `ALLOWED_EMAILS` | E-mails da equipe que podem entrar, separados por vírgula |
| `META_APP_SECRET` | App MRA Instchat › Configurações do app › Básico › Chave secreta |
| `INSTAGRAM_VERIFY_TOKEN` | Texto livre; o mesmo é digitado no cadastro do webhook na Meta |
| `INSTAGRAM_ACCESS_TOKEN` | Opcional: token da conta do Instagram, usado para buscar nome e @ do remetente |

Nenhuma dessas chaves deve ser colada em chat, e-mail ou no código.

## Banco

As tabelas (`db/schema.sql`) são criadas automaticamente no primeiro acesso, e os 49 registros
iniciais (`db/seed.json`) são carregados uma única vez.

## Backup

Os botões **⬇️ Backup** e **⬆️ Importar** continuam funcionando. Importar **substitui** todos os leads do banco.

## Desenvolvimento e testes

```bash
npm install
npm run build
```

Teste ponta a ponta (banco, API e webhook):

```bash
BASE_URL=http://localhost:3000 META_APP_SECRET=... INSTAGRAM_VERIFY_TOKEN=... npm run test:e2e
```

Para teste local sem o Neon Auth, `CRM_LOCAL_TEST_USER=<e-mail autorizado>` simula um usuário logado.
Essa variável é ignorada na Vercel.
