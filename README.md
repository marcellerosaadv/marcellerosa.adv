# CRM · Marcelle Rosa Advocacia

Sistema de CRM e funil de clientes do escritório, criado a partir da aba **DADOS** da planilha original.
É um **aplicativo de um único arquivo** (`index.html`) — não precisa de instalação, servidor nem internet.

## Como usar

1. Baixe o arquivo `index.html`.
2. Dê **dois cliques** nele — abre no navegador (Chrome, Edge, etc.).
3. Pronto. Os dados ficam salvos automaticamente **no seu navegador**.

> Dica: para acessar de qualquer lugar (celular/computador), dá para publicar de graça no GitHub Pages. Posso configurar isso se você quiser.

## O que o sistema faz

- **📊 Dashboard** — total de leads, em andamento, fechados, taxa de conversão, faturamento, funil, leads por origem/área e evolução mensal.
- **🗂️ Funil (Kanban)** — arraste os cartões entre as etapas: Novo → Em conversa → Proposta → Contrato → Aguardando → Fechado / Não fechou.
- **📋 Leads** — tabela com busca e filtros por etapa e área.
- **📅 Follow-ups** — quem precisa de contato (atrasados, hoje, próximos), com base no campo *Próximo contato*.
- **＋ Novo Lead / Editar** — cadastro completo: nome, telefone, área, tipo de ação, origem, valor fechado, objeção, comentários e histórico de contatos.

## Campos (baseados na aba DADOS)

Data do chamado · Nome · Telefone · Área · Tipo de ação · Origem · Qualificação ·
Etapa do funil · Último contato · Próximo contato · Valor fechado · Data de fechamento ·
Objeção · Comentários · Histórico de follow-ups.

## Backup (IMPORTANTE)

Como os dados ficam no navegador, **faça backup com frequência**:

- **⬇️ Backup** — baixa um arquivo `.json` com todos os leads.
- **⬆️ Importar** — restaura/transfere os dados a partir de um arquivo `.json`.

Use **Importar** para levar os dados para outro computador ou navegador.

⚠️ Limpar os dados de navegação / cache do navegador apaga os dados. Sempre tenha um backup recente.

## Dados iniciais

O sistema já vem com os **49 registros** da aba DADOS importados (datas, área, etapa do funil,
qualificação e comentários). Os contatos que não tinham nome na planilha aparecem como
*"Lead sem nome N"* — basta abrir e completar.

## Automação do Instagram

A pasta [`instagram-bot/`](instagram-bot/README.md) contém a automação de Instagram (comentário vira DM, respostas no direct e captura de leads), hospedada na Vercel com banco Neon. Instruções de instalação no README da pasta.
