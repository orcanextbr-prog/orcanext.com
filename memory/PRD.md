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
- **Reset de senha** magic link via Resend (token uso único, expira 1h, auto-login pós reset).
- **Admin v2** (RBAC USER/ADMIN/SUPER_ADMIN): bloquear/promover usuários, alterar plano, configurações da plataforma (`free_limit`, `pro_monthly`, `pro_annual`, `support_email`), auditoria completa, próximos do limite.
- **Follow-up Inteligente** via Resend: lembretes automáticos para orçamentos enviados (D+3, D+7, máx 2 envios).
- **Impersonation (Fev/2026)**: SUPER_ADMIN pode entrar em qualquer conta de usuário via botão "Entrar como" na aba Usuários. Banner preto "MODO ADMINISTRADOR" fica fixo no topo do dashboard com botão "Sair do modo suporte". Ações auditadas (`IMPERSONATE_START` / `IMPERSONATE_END`).
- **Limite Gratuito atualizado (Fev/2026)**: agora **15 orçamentos/mês** (era 50). Configuração centralizada em `platform_settings.free_limit` lida via `get_free_limit()` helper. Enforcement 100% backend (HTTP 402). Threshold "próximo do limite" recalculado dinamicamente para 80% do limite ativo (12/15). Landing page redesenhada:
  - Hero mostra oferta comercial ("Comece grátis com até 15 orçamentos/mês" + "R$ 49,90/mês") e CTA duplo (COMEÇAR GRÁTIS / QUERO ORÇAMENTOS ILIMITADOS).
  - Nova seção **UpgradeCallout** ("15 orçamentos por mês são suficientes para começar" + R$ 49,90 destacado) entre Benefícios e Planos.
  - Seção Planos com preço R$ 49,90 grande e visível (fix `.font-display` override via `!text-white`), 13 itens no Pro, badge "MAIS ESCOLHIDO".
  - FAQ + CTA final atualizados com 15/R$ 49,90.

## Test Results
- iteration_1: Backend 100% ✓ · Frontend 100% ✓
- Impersonation (Fev/2026): curl E2E + Playwright screenshot ✓ (login → /admin → Entrar como → banner visível → Sair → volta ao admin).

## Backlog (P1/P2)
- P1 — **Central de Suporte**: tickets abertos pelo usuário, respondidos em `/admin/support`.
- P1 — Integração real de billing (Stripe) com webhooks e estados ACTIVE/PAST_DUE/CANCELED.
- P2 — Funil de conversão detalhado no Admin (Visitor → Signup → 1º Orçamento → PRO).
- P2 — 2FA por e-mail.
- P2 — Notificações e-mail/WhatsApp (visualizado/aprovado/próximo de expirar).
- P2 — Personalização de modelos ilimitados + escolha de cor do PRO.
- P2 — Página LGPD (Política de Privacidade, Termos, exportação/exclusão de dados).
- P2 — Assinatura digital ICP-Brasil (integração DocuSign/GOV.BR).
- Refactor — modularizar `server.py` (auth, admin, quotes, billing em routers separados).
