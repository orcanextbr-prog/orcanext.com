import { useState } from "react";
import { useAuth, formatApiError } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check } from "lucide-react";

export default function MyPlan() {
  const { user, refresh } = useAuth();
  const [loading, setLoading] = useState(false);

  const upgrade = async () => {
    setLoading(true);
    try { await api.post("/plan/upgrade"); await refresh(); toast.success("Bem-vindo ao Profissional!"); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setLoading(false); }
  };
  const downgrade = async () => {
    if (!window.confirm("Voltar para o Gratuito? Seus dados são preservados.")) return;
    setLoading(true);
    try { await api.post("/plan/downgrade"); await refresh(); toast.success("Você voltou ao Gratuito"); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  const isPro = user?.plan === "PROFESSIONAL";

  return (
    <div>
      <h1 className="font-display text-3xl font-black">Meu Plano</h1>
      <p className="text-zinc-500 text-sm mt-1">Escolha o plano ideal para o seu momento.</p>
      <div className="mt-6 grid md:grid-cols-2 gap-6">
        <div className={`rounded-2xl p-8 border ${!isPro ? "border-black bg-white" : "border-zinc-200 bg-white"}`}>
          <div className="flex items-center gap-3"><span className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Gratuito</span>{!isPro && <Badge className="brand-bg text-white rounded-md">Plano atual</Badge>}</div>
          <div className="mt-3 font-display text-5xl font-black">R$ 0</div>
          <div className="text-zinc-500">Ideal para começar.</div>
          <ul className="mt-6 space-y-2 text-sm">
            {["50 novos orçamentos por mês", "Clientes, produtos e serviços", "Link público + PDF", "Aceite eletrônico", "Marca d'água"].map((f) => (
              <li key={f} className="flex gap-2"><Check className="w-4 h-4 brand-text mt-0.5" />{f}</li>
            ))}
          </ul>
          {isPro && <Button variant="outline" onClick={downgrade} disabled={loading} className="mt-6 w-full h-11 font-bold" data-testid="downgrade-btn">Voltar para Gratuito</Button>}
        </div>
        <div className={`rounded-2xl p-8 border-2 ${isPro ? "brand-border bg-black text-white" : "brand-border bg-black text-white"}`}>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">Profissional</span>
            {isPro ? <Badge className="brand-bg text-white rounded-md">Plano atual</Badge> : <Badge className="brand-bg text-white rounded-md">MAIS ESCOLHIDO</Badge>}
          </div>
          <div className="mt-3 flex items-baseline gap-2"><span className="font-display text-5xl font-black">R$ 49,90</span><span className="text-zinc-400">/mês</span></div>
          <div className="text-zinc-400">ou R$ 478,80/ano (R$ 39,90/mês)</div>
          <ul className="mt-6 space-y-2 text-sm">
            {["Orçamentos ilimitados", "Sem marca d'água", "Recibos ilimitados", "Modelos vertical/horizontal", "Personalização de logo e cor"].map((f) => (
              <li key={f} className="flex gap-2"><Check className="w-4 h-4 brand-text mt-0.5" />{f}</li>
            ))}
          </ul>
          {!isPro && <Button onClick={upgrade} disabled={loading} className="mt-6 w-full h-11 brand-bg hover:bg-[#008a02] text-white font-bold" data-testid="upgrade-btn">ASSINAR PROFISSIONAL</Button>}
        </div>
      </div>
      <p className="mt-4 text-xs text-zinc-400">Ambiente demo: a assinatura é ativada instantaneamente sem cobrança. A arquitetura está preparada para integração com gateway (Stripe / PIX / cartão).</p>
    </div>
  );
}
