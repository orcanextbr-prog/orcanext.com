import { useEffect, useState } from "react";
import { useAuth, formatApiError } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Check, Bell, ExternalLink, AlertTriangle } from "lucide-react";

const fmtDate = (iso) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return iso; }
};

export default function MyPlan() {
  const { user, refresh } = useAuth();
  const [loading, setLoading] = useState(false);
  const [followUp, setFollowUp] = useState(true);
  const [cycle, setCycle] = useState("monthly");
  const [plan, setPlan] = useState(null);

  useEffect(() => {
    api.get("/settings/followup").then((r) => setFollowUp(r.data.follow_up_enabled));
    api.get("/plan").then((r) => setPlan(r.data));
  }, [user?.plan]);

  const toggleFollowUp = async (v) => {
    setFollowUp(v);
    try { await api.put("/settings/followup", { follow_up_enabled: v });
      toast.success(v ? "Follow-up global ativado" : "Follow-up global desativado");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const startCheckout = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/stripe/checkout", {
        billing_cycle: cycle,
        origin_url: window.location.origin,
      });
      window.location.href = data.checkout_url;
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Erro ao iniciar pagamento");
      setLoading(false);
    }
  };

  const openPortal = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/stripe/customer-portal", { origin_url: window.location.origin });
      window.location.href = data.portal_url;
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
      setLoading(false);
    }
  };

  const cancelSubscription = async () => {
    if (!window.confirm("Cancelar assinatura? Você continua com o Profissional até o fim do período atual.")) return;
    setLoading(true);
    try {
      await api.post("/plan/downgrade");
      await refresh();
      const r = await api.get("/plan"); setPlan(r.data);
      toast.success("Cancelamento programado para o fim do período");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  const isPro = user?.plan === "PROFESSIONAL";
  const billing = plan?.billing || {};
  const scheduled = billing.cancel_at_period_end;
  const pastDue = billing.subscription_status === "past_due";

  return (
    <div>
      <h1 className="font-display text-3xl font-black">Meu Plano</h1>
      <p className="text-zinc-500 text-sm mt-1">Escolha o plano ideal para o seu momento.</p>

      {pastDue && (
        <div className="mt-6 border-2 border-red-300 bg-red-50 rounded-2xl p-5 flex items-start gap-3" data-testid="past-due-banner">
          <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
          <div className="flex-1">
            <div className="font-bold text-red-800">Não foi possível processar o pagamento da sua assinatura.</div>
            <p className="text-sm text-red-700 mt-1">Atualize seu método de pagamento para continuar usando o plano Profissional.</p>
          </div>
          <Button onClick={openPortal} className="bg-red-600 hover:bg-red-700 text-white font-bold" data-testid="past-due-update-pay">ATUALIZAR PAGAMENTO</Button>
        </div>
      )}

      {scheduled && isPro && (
        <div className="mt-6 border border-amber-300 bg-amber-50 rounded-2xl p-4 text-sm text-amber-900" data-testid="cancel-scheduled-banner">
          Seu plano Profissional será encerrado em <b>{fmtDate(billing.current_period_end)}</b>. Depois disso, você volta ao Gratuito (15 orçamentos/mês).
        </div>
      )}

      {/* Billing cycle toggle (visible only when upgrading) */}
      {!isPro && (
        <div className="mt-6 inline-flex bg-white border border-zinc-200 rounded-full p-1" data-testid="billing-cycle-toggle">
          <button onClick={() => setCycle("monthly")} data-testid="cycle-monthly"
            className={`px-4 py-1.5 text-sm font-bold rounded-full transition ${cycle === "monthly" ? "brand-bg text-white" : "text-zinc-600"}`}>
            Mensal
          </button>
          <button onClick={() => setCycle("yearly")} data-testid="cycle-yearly"
            className={`px-4 py-1.5 text-sm font-bold rounded-full transition ${cycle === "yearly" ? "brand-bg text-white" : "text-zinc-600"}`}>
            Anual <span className="ml-1 text-xs opacity-80">−20%</span>
          </button>
        </div>
      )}

      <div className="mt-6 grid md:grid-cols-2 gap-6">
        {/* Gratuito */}
        <div className={`rounded-2xl p-8 border ${!isPro ? "border-black bg-white" : "border-zinc-200 bg-white"}`}>
          <div className="flex items-center gap-3"><span className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Gratuito</span>{!isPro && <Badge className="brand-bg text-white rounded-md">Plano atual</Badge>}</div>
          <div className="mt-3 font-display text-5xl font-black">R$ 0</div>
          <div className="text-zinc-500">Ideal para começar.</div>
          <ul className="mt-6 space-y-2 text-sm">
            {["Até 15 novos orçamentos por mês", "Clientes, produtos e serviços", "Link público + PDF", "Aceite eletrônico", "Marca d'água"].map((f) => (
              <li key={f} className="flex gap-2"><Check className="w-4 h-4 brand-text mt-0.5" />{f}</li>
            ))}
          </ul>
        </div>

        {/* Profissional */}
        <div className="rounded-2xl p-8 border-2 brand-border bg-black text-white">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">Profissional</span>
            {isPro ? <Badge className="brand-bg text-white rounded-md" data-testid="plan-active-badge">Plano atual</Badge>
                   : <Badge className="brand-bg text-white rounded-md">MAIS ESCOLHIDO</Badge>}
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            {isPro ? (
              <>
                <span className="font-display text-5xl font-black !text-white">R$ {(billing.billing_cycle === "yearly" ? "478,80" : "49,90")}</span>
                <span className="text-zinc-400">/{billing.billing_cycle === "yearly" ? "ano" : "mês"}</span>
              </>
            ) : cycle === "monthly" ? (
              <>
                <span className="font-display text-5xl font-black !text-white">R$ 49,90</span>
                <span className="text-zinc-400">/mês</span>
              </>
            ) : (
              <>
                <span className="font-display text-5xl font-black !text-white">R$ 39,90</span>
                <span className="text-zinc-400">/mês</span>
              </>
            )}
          </div>
          <div className="text-zinc-400 text-sm mt-1">
            {isPro
              ? (billing.subscription_status === "trialing" ? "Em período de teste" :
                 billing.subscription_status === "past_due" ? "Pagamento pendente" :
                 <>Próxima cobrança: <b className="!text-white">{fmtDate(billing.current_period_end)}</b></>)
              : cycle === "monthly" ? "Cobrado mensalmente. Cancele quando quiser." : "R$ 478,80 cobrado anualmente"}
          </div>
          <ul className="mt-6 space-y-2 text-sm">
            {["Orçamentos ilimitados", "Sem marca d'água", "Recibos ilimitados", "Modelos vertical/horizontal", "Personalização de logo e cor"].map((f) => (
              <li key={f} className="flex gap-2"><Check className="w-4 h-4 brand-text mt-0.5" />{f}</li>
            ))}
          </ul>

          {!isPro && (
            <Button onClick={startCheckout} disabled={loading} data-testid="upgrade-btn"
              className="mt-6 w-full h-11 brand-bg hover:bg-[#008a02] !text-white font-bold">
              {loading ? "Abrindo checkout…" : "ASSINAR PROFISSIONAL"}
            </Button>
          )}
          {isPro && (
            <div className="mt-6 space-y-2">
              <Button onClick={openPortal} disabled={loading} data-testid="manage-subscription-btn"
                className="w-full h-11 bg-white text-black hover:bg-zinc-100 font-bold">
                GERENCIAR ASSINATURA <ExternalLink className="ml-1 w-4 h-4" />
              </Button>
              {!scheduled && (
                <Button onClick={cancelSubscription} disabled={loading} variant="outline"
                  className="w-full h-11 border-white/40 !text-white hover:bg-white/10 font-bold" data-testid="cancel-subscription-btn">
                  CANCELAR ASSINATURA
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-10">
        <h2 className="font-display text-2xl font-black">Configurações</h2>
        <div className="mt-4 bg-white border border-zinc-200 rounded-2xl p-6" data-testid="settings-followup-card">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-md brand-bg text-white flex items-center justify-center shrink-0"><Bell className="w-5 h-5" /></div>
              <div>
                <div className="font-display font-extrabold text-lg">Follow-up inteligente</div>
                <p className="text-sm text-zinc-500 mt-1 max-w-lg">Enviamos automaticamente um lembrete por e-mail para clientes que visualizaram seu orçamento e não responderam em 3 dias (e outro em 7 dias). Máximo 2 lembretes por orçamento.</p>
              </div>
            </div>
            <Switch checked={followUp} onCheckedChange={toggleFollowUp} data-testid="settings-followup-toggle" />
          </div>
        </div>
      </div>
    </div>
  );
}
