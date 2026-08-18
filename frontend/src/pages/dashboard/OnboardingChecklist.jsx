import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Building2, Users, Package, Wrench, FileText, Check, X, ArrowRight, PartyPopper } from "lucide-react";

const stepIcon = { company: Building2, client: Users, product_service: Package, quote: FileText };

function buildSteps(status) {
  const s = status?.steps || {};
  return [
    { key: "company",        title: "Configure sua empresa",        desc: "Complete os dados que aparecerão nos seus orçamentos.", done: !!s.company, to: "/dashboard/company",           cta: "Configurar minha empresa" },
    { key: "client",         title: "Cadastre seu primeiro cliente", desc: "Adicione um cliente para poder criar seu primeiro orçamento.", done: !!s.client, to: "/dashboard/clients",         cta: "Cadastrar primeiro cliente" },
    { key: "product_service",title: "Adicione um produto ou serviço", desc: "Cadastre algo que você vende ou um serviço que você oferece.", done: !!(s.product || s.service), to: null, cta: null,
      alt: [
        { label: "Cadastrar produto", to: "/dashboard/products" },
        { label: "Cadastrar serviço", to: "/dashboard/services" },
      ] },
    { key: "quote",          title: "Crie seu primeiro orçamento",   desc: "Agora você já tem cliente e produto/serviço — envie seu primeiro orçamento.", done: !!s.quote, to: "/dashboard/quotes/new", cta: "Criar meu primeiro orçamento" },
  ];
}

export default function OnboardingChecklist() {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.get("/onboarding/status").then((r) => setStatus(r.data)).catch(() => setStatus(null));

  useEffect(() => { load(); }, []);
  useEffect(() => {
    // Re-check when the user comes back to the tab (they may have added a client/product/quote)
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const setState = async (patch) => {
    setBusy(true);
    try {
      await api.post("/onboarding/state", patch);
      await load();
    } finally { setBusy(false); }
  };

  if (!status) return null;
  if (status.dismissed) return null;

  const steps = buildSteps(status);
  const completedCount = steps.filter((s) => s.done).length;
  const pct = Math.round((completedCount / steps.length) * 100);
  const allDone = completedCount === steps.length;
  const nextIdx = steps.findIndex((s) => !s.done);

  // Compact card when the user has skipped and still has pending steps.
  if (status.skipped && !allDone) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-3 md:gap-4" data-testid="onboarding-compact">
        <div className="w-10 h-10 shrink-0 rounded-xl brand-bg text-white grid place-items-center font-black">{completedCount}</div>
        <div className="flex-1 min-w-0">
          <div className="font-display font-black text-base md:text-lg">Continue configurando seu OrçaNext</div>
          <p className="text-xs md:text-sm text-zinc-500 mt-0.5">{completedCount} de {steps.length} etapas concluídas.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setState({ skipped: false })} disabled={busy} data-testid="onboarding-resume"
            className="brand-bg hover:bg-[#008a02] text-white font-bold rounded-xl">
            Continuar <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
          <button onClick={() => setState({ dismissed: true })} disabled={busy} aria-label="Dispensar"
            data-testid="onboarding-dismiss-compact"
            className="w-9 h-9 grid place-items-center rounded-lg hover:bg-zinc-100 text-zinc-500">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Celebration card when everything is done and the user hasn't dismissed yet.
  if (allDone) {
    return (
      <div className="rounded-2xl border border-black bg-black text-white p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-4 md:gap-6" data-testid="onboarding-complete">
        <div className="w-14 h-14 rounded-2xl bg-[#00AD02]/20 text-[#00AD02] grid place-items-center shrink-0">
          <PartyPopper className="w-7 h-7" />
        </div>
        <div className="flex-1">
          <div className="font-display text-xl md:text-2xl font-black">🎉 Tudo pronto!</div>
          <p className="text-zinc-300 text-sm md:text-base mt-1">Seu OrçaNext está configurado. Agora você já pode criar e enviar seus orçamentos profissionais.</p>
        </div>
        <Button onClick={() => setState({ dismissed: true })} disabled={busy} data-testid="onboarding-go-dashboard"
          className="brand-bg hover:bg-[#008a02] text-white font-bold rounded-xl">
          Ir para o Dashboard
        </Button>
      </div>
    );
  }

  // Full expanded checklist.
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 md:p-6" data-testid="onboarding-checklist">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-widest text-[#00AD02]">Comece por aqui</div>
          <h2 className="font-display text-xl md:text-2xl font-black mt-1">Vamos configurar seu OrçaNext 🚀</h2>
          <p className="text-zinc-500 text-sm mt-1">Complete alguns passos rápidos para começar a criar seus orçamentos.</p>
        </div>
        <button onClick={() => setState({ skipped: true })} disabled={busy} data-testid="onboarding-skip"
          className="text-xs md:text-sm font-bold text-zinc-500 hover:text-black underline underline-offset-4 whitespace-nowrap">
          Pular por agora
        </button>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <div className="text-xs font-bold uppercase tracking-widest text-zinc-500 whitespace-nowrap" data-testid="onboarding-progress-label">
          {allDone ? `Passo ${steps.length} de ${steps.length}` : `Passo ${nextIdx + 1} de ${steps.length}`}
        </div>
        <div className="flex-1"><Progress value={pct} className="h-2" /></div>
        <div className="text-xs font-bold text-zinc-500 tabular-nums">{completedCount}/{steps.length}</div>
      </div>

      <ol className="mt-5 space-y-3">
        {steps.map((s, i) => {
          const Icon = stepIcon[s.key === "product_service" ? "product_service" : s.key];
          const isNext = i === nextIdx;
          return (
            <li key={s.key} data-testid={`onboarding-step-${s.key}`}
              className={`rounded-xl border p-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-4 transition ${
                s.done ? "border-[#00AD02]/40 bg-[#00AD02]/5" :
                isNext ? "border-black bg-white" : "border-zinc-200 bg-white"}`}>
              <div className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${
                s.done ? "brand-bg text-white" : isNext ? "bg-black text-white" : "bg-zinc-100 text-zinc-500"}`}>
                {s.done ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`font-bold ${s.done ? "line-through text-zinc-500" : ""}`}>{s.title}</div>
                <p className="text-xs md:text-sm text-zinc-500 mt-0.5">{s.desc}</p>
              </div>
              {!s.done && (
                <div className="flex flex-col md:flex-row gap-2 md:gap-2 shrink-0">
                  {s.alt ? s.alt.map((a) => (
                    <Link key={a.to} to={a.to}>
                      <Button variant={isNext ? "default" : "outline"}
                        className={isNext
                          ? "w-full md:w-auto brand-bg hover:bg-[#008a02] text-white font-bold rounded-xl"
                          : "w-full md:w-auto rounded-xl border-zinc-300"}
                        data-testid={`onboarding-cta-${s.key}-${a.to.split("/").pop()}`}>
                        {a.label}
                      </Button>
                    </Link>
                  )) : (
                    <Link to={s.to}>
                      <Button className={isNext
                          ? "w-full md:w-auto brand-bg hover:bg-[#008a02] text-white font-bold rounded-xl"
                          : "w-full md:w-auto rounded-xl border-zinc-300 bg-white text-black border hover:bg-zinc-50"}
                        variant={isNext ? "default" : "outline"}
                        data-testid={`onboarding-cta-${s.key}`}>
                        {s.cta} <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    </Link>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
