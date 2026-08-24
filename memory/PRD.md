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
- **Limite Gratuito atualizado (Fev/2026)**: agora **15 orçamentos/mês** (era 50). Configuração centralizada em `platform_settings.free_limit` lida via `get_free_limit()` helper. Enforcement 100% backend (HTTP 402). Threshold "próximo do limite" recalculado dinamicamente para 80% do limite ativo (12/15). Landing page redesenhada.
- **Stripe Billing REAL (Fev/2026)**:
  - Sandbox Stripe provisionado via Emergent (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` em `.env`).
  - `setup_stripe.py` idempotente cria produto "OrçaNext Profissional" com dois preços BRL: `orcanext_pro_monthly` (R$ 49,90/mês) e `orcanext_pro_yearly` (R$ 478,80/ano).
  - Endpoints: `POST /api/stripe/checkout`, `GET /api/stripe/status/{sid}`, `POST /api/stripe/customer-portal`, `POST /api/stripe/webhook`.
  - Webhook valida assinatura, é idempotente via `stripe_webhook_events` (índice único), trata `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed`.
  - User document ganhou: `stripe_customer_id`, `stripe_subscription_id`, `stripe_price_id`, `subscription_status`, `billing_cycle`, `current_period_end`, `cancel_at_period_end`.
  - Frontend `/dashboard/plan`: toggle mensal/anual, botão real de checkout Stripe, banner "past_due", banner cancelamento programado, botão "Gerenciar Assinatura" (Customer Portal).
  - Novas páginas `/billing/success` (polling) e `/billing/cancel`. Frontend NUNCA ativa PRO por conta própria — apenas backend via webhook.
  - Endpoint mock `/api/plan/upgrade` retorna 410 (obsoleto). `/api/plan/downgrade` agora chama `stripe.Subscription.modify(cancel_at_period_end=True)`.
  - `_apply_subscription_to_user()` centraliza sync compatível com Stripe API 2025 (`current_period_end` na SubscriptionItem).

- **Dashboard Redesign (Fev/2026)**: `/dashboard/overview` refeito para o usuário entender o negócio em ~5s. Cabeçalho "Olá, {empresa} 👋" + CTA `+ Novo Orçamento`. KPIs primários com hierarquia (Valor Aprovado, Taxa de Conversão, Aprovados em cards pretos destacados) + secundários (Total, Aguardando, Recusados, Enviados). Gráfico **Desempenho** via recharts (LineChart Enviados vs Aprovados, cores #000 e #00AD02) com filtro 7d/30d/3m/all. **Funil** de 5 etapas (Enviados → Visualizados → Aguardando → Aprovados → Assinados) monotônico não-crescente. **Orçamentos Recentes** (últimos 5 via `/api/quotes`, tabela desktop / cards mobile) com "Ver todos". **Ações Rápidas** (Novo Orçamento/Cliente/Produto/Serviço). **Situação do Plano** — FREE: X/15 + barra + avisos 80%/atingido + CTA Pro; PRO: "Ilimitado ✓". **Estado vazio** amigável com CTA "Criar meu primeiro orçamento". Totalmente responsivo (desktop/tablet/mobile, sem scroll horizontal). Novo endpoint backend `GET /api/dashboard/timeseries?period=` (agregação multi-tenant, sem novas dependências — recharts já existente).
- **Onboarding Passo a Passo (Fev/2026)**: Novo componente `OnboardingChecklist.jsx` renderizado no topo do Dashboard com 4 etapas guiadas — (1) Configurar Empresa, (2) Primeiro Cliente, (3) Produto **ou** Serviço, (4) Primeiro Orçamento. Progresso baseado em **dados reais** (existência via `count_documents` scoped por `company_id`). Barra de progresso + label "Passo X de 4". Botão "Pular por agora" colapsa em card compacto "Continue configurando (X/4) [Continuar]" com X para dispensar permanentemente. Quando as 4 etapas ficam completas → card "🎉 Tudo pronto!" + "Ir para o Dashboard" (dismiss permanente). Reutiliza páginas existentes (Minha Empresa, Clientes, Produtos, Serviços, QuoteEditor). Sem nova UI para as etapas. Multi-tenant preservado. 2 novos endpoints (`GET /api/onboarding/status`, `POST /api/onboarding/state`) e 2 flags opcionais no user (`onboarding_skipped`, `onboarding_dismissed`). Focus listener re-sincroniza o progresso quando o usuário volta à aba.
- **Stripe BYOK Hardening (Fev/2026)**: Migração completa TEST → LIVE **BYOK** para conta própria `acct_1U5Bfl5gVqE71TBy`. Price IDs LIVE atuais: `price_1U5eEo5gVqE71TBy4OHNUN4F` (mensal R$ 49,90) e `price_1U5eFn5gVqE71TBy68GGYLGR` (anual R$ 478,80) — ambos no produto `prod_V5puhDlK4Tl46d`. Adicionado **guard defensivo** em `server.py` que recusa iniciar se `STRIPE_MODE=live` com chaves TEST ou refs à sandbox Emergent `acct_1U4tBMA5rPFeqY7U`. `POST /api/stripe/checkout` agora: (a) **self-heal** de `stripe_customer_id` obsoleto — se o customer não existe/é livemode errado, descarta + limpa `stripe_subscription_id` órfão + cria novo na conta atual; (b) **remove fallback perigoso** para `lookup_keys` (poderia trazer preços arquivados) — Price ID obrigatoriamente vem das env vars `STRIPE_MONTHLY_PRICE_ID`/`STRIPE_ANNUAL_PRICE_ID`; (c) valida `livemode` do preço retornado.
- **Sitemap & SEO (Fev/2026)**: `frontend/public/sitemap.xml` com 4 rotas públicas (/, /login, /register, /forgot-password) + `frontend/public/robots.txt` permitindo públicas e bloqueando /dashboard, /admin, /onboarding, /billing, /reset-password, /q/. Sitemap em `https://orcanext.com/sitemap.xml` já servindo `Content-Type: application/xml`.
- **Landing Redesign Premium (Fev/2026)**: `/pages/Landing.jsx` reescrita completa (~855 linhas). Header sticky com backdrop-blur + menu mobile hamburguer. Hero com mockup animado (framer-motion — já existente): pipeline de status Enviado → Visualizado → Aprovado → Assinado + chip flutuante "Assinado há 2 minutos". Novas seções: Problema, Transformação (Antes ✕ vs Depois ✓), Como Funciona (5 etapas CRIAR→ENVIAR→APROVAR→ASSINAR→RECEBER), Benefícios (fundo preto, card verde de destaque + 6 secundários), Prestadores de Serviços (8 categorias sem afirmar que já são clientes), Prova Social (**sem depoimentos inventados** — só copy oficial), Resultado (comum vs profissional), Pricing com toggle Mensal/Anual, CTA intermediário, FAQ com 14 perguntas, CTA final, Footer completo. Meta tags: title, description, og:*, twitter:*, canonical, theme-color #00AD02. Preserva 100% da copy oficial (nome OrçaNext, slogans, planos R$ 0 até 15 orçamentos, Pro R$ 49,90/mês ou R$ 478,80/ano equivalente a R$ 39,90/mês). Todos CTAs apontam para `/register` ou `/login` existentes. Zero mudanças em backend/auth/Stripe/dashboard.

## Test Results
- iteration_1: Backend 100% ✓ · Frontend 100% ✓
- Impersonation (Fev/2026): curl E2E + Playwright screenshot ✓ (login → /admin → Entrar como → banner visível → Sair → volta ao admin).
- iteration_5 — Dashboard Redesign: Backend 12/12 pytest ✓ · Frontend Playwright em 1920/768/390 ✓ · Todos data-testids presentes · Nenhum NaN/Infinity · Multi-tenant respeitado · Sem horizontal scroll.
- iteration_6 — Onboarding Checklist: Backend 8/8 pytest ✓ · Frontend 100% ✓ · Multi-tenant confirmado · Persistência de skip/dismiss OK · Mobile 390x844 sem scroll horizontal.
- iteration_7 — Landing Redesign Premium: Frontend 100% ✓ em 320/375/390/414/768/1024/1440 (nenhum scroll horizontal) · Toggle Mensal/Anual troca R$ 49,90 ↔ R$ 39,90 corretamente · FAQ 14 perguntas · Sem depoimentos fictícios (Marina/Carla removidos) · Sem imagens externas de rostos · SEO/OG completos · Regressão /login /register /forgot-password OK.

## Backlog (P1/P2)
- P1 — **Central de Suporte**: tickets abertos pelo usuário, respondidos em `/admin/support`.
- P1 — **Admin Billing dashboard**: aba com assinaturas ativas/canceladas, últimos pagamentos, links "Ver no Stripe".
- P1 — **Stripe live mode**: usuário precisa fazer KYC no `onboarding_url` do Stripe; sistema auto-troca para live keys.
- P2 — Funil de conversão detalhado no Admin (Visitor → Signup → 1º Orçamento → PRO).
- P2 — 2FA por e-mail.
- P2 — Notificações e-mail/WhatsApp (visualizado/aprovado/próximo de expirar).
- P2 — Personalização de modelos ilimitados + escolha de cor do PRO.
- P2 — Página LGPD (Política de Privacidade, Termos, exportação/exclusão de dados).
- P2 — Assinatura digital ICP-Brasil (integração DocuSign/GOV.BR).
- Refactor — modularizar `server.py` (auth, admin, quotes, billing em routers separados).
