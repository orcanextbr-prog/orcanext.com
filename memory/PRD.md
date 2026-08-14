# OrçaNext — PRD

## Original Problem Statement
SaaS brasileiro multi-tenant para criar, enviar, aprovar e obter aceite eletrônico de orçamentos profissionais. Slogan: "Crie. Envie. Aprove. Receba."

## Personas
- **Prestadores autônomos & PMEs** — usam Word/Excel/PDF manual hoje.
- **Clientes finais** — recebem link público, aprovam e assinam eletronicamente.
- **Admin OrçaNext** — vê métricas, usuários e auditoria em `/admin`.

## Architecture
- **Backend**: FastAPI + MongoDB (motor). Auth JWT (cookie httpOnly + Bearer fallback). PDF via ReportLab. Multi-tenant via `company_id` derivado do user autenticado. Auditoria por operação em `audit_logs`.
- **Frontend**: React 19 + React Router 7 + Tailwind + shadcn/ui + sonner. Design guidelines: verde #00AD02, preto, branco. Fonts: Outfit (display) + Manrope (body).
- **Billing**: MOCK (`/api/plan/upgrade` e `/downgrade`) — arquitetura pronta para Stripe/PIX.

## Implemented (Feb 2026)
- Landing page completa (Hero, Problema, Como funciona, Benefícios bento, Planos, Depoimentos com placeholders, FAQ, CTA, Footer).
- Auth JWT (register/login/logout/me) + admin seed (`admin@orcanext.com` / `Admin@2026`).
- Onboarding de empresa + upload de logo (base64, 500KB).
- Multi-tenant: Clientes, Produtos, Serviços com pesquisa e cadastro rápido inline no editor.
- Editor de orçamento com pesquisa em tempo real, itens editáveis, desconto R$/%, orientação vertical/horizontal.
- Regra de negócio validada no backend: 50 novos orçamentos/mês no FREE; contador `/api/quotes/usage` com `used/limit/blocked`; renovação por ciclo mensal via `quote_usage` collection. Excluir NÃO devolve crédito. Duplicar consome 1 unidade.
- Dialog de bloqueio no 51º + CTA upgrade. Alerta próximo do limite (40).
- PROFESSIONAL: orçamentos/recibos ilimitados, sem marca d'água. Downgrade preserva dados.
- Link público `/q/:token` sem auth, com aprovação, aceite eletrônico (canvas de assinatura + IP + user-agent), auto-expiração e PDF público.
- PDF backend com logo, empresa, cliente, itens, totais, aceite e marca d'água "Criado com OrçaNext" no FREE.
- Recibos ilimitados no PRO com PDF profissional.
- Painel `/admin`: métricas (users, companies, quotes, MRR/ARR), lista de usuários, audit logs.
- Segurança: rotas privadas via cookie, isolamento multi-tenant (foreign quote 404), admin gate 403, unauth 401.
- Todos os elementos-chave possuem `data-testid`.

## Test Results (iteration_1)
Backend 100% ✓ · Frontend 100% ✓ — todos os fluxos críticos validados incluindo 50/50 block, delete sem crédito, expiração, PDF público, RBAC.

## Backlog (P1/P2)
- P1 — Recuperação/reset de senha por e-mail (Resend).
- P1 — Integração real de billing (Stripe) com webhooks e estados ACTIVE/PAST_DUE/CANCELED.
- P2 — Notificações e-mail/WhatsApp (visualizado/aprovado/próximo de expirar).
- P2 — Personalização de modelos ilimitados + escolha de cor do PRO.
- P2 — Página LGPD (Política de Privacidade, Termos, exportação/exclusão de dados).
- P2 — CRM light: follow-up automático, funil de conversão.
- P2 — Assinatura digital ICP-Brasil (integração DocuSign/GOV.BR).
