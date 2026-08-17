import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";

/**
 * /billing/success — the customer just came back from Stripe Checkout.
 * We DO NOT trust this page to activate the plan. We poll the backend
 * (which in turn re-checks Stripe directly) until the payment is confirmed.
 */
export default function BillingSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const { refresh } = useAuth();
  const [state, setState] = useState({ status: "checking", plan: null, tries: 0 });

  useEffect(() => {
    if (!sessionId) { setState({ status: "no_session" }); return; }
    let cancelled = false;
    let tries = 0;
    const tick = async () => {
      tries += 1;
      try {
        const { data } = await api.get(`/stripe/status/${sessionId}`);
        if (cancelled) return;
        if (data.payment_status === "paid") {
          await refresh();
          setState({ status: "paid", plan: data.plan, tries });
          return;
        }
        setState({ status: "pending", plan: null, tries });
      } catch (e) { setState({ status: "error", plan: null, tries }); return; }
      if (tries < 20 && !cancelled) setTimeout(tick, 2000);
    };
    tick();
    return () => { cancelled = true; };
  }, [sessionId, refresh]);

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border border-zinc-200 rounded-2xl p-10 text-center" data-testid="billing-success-card">
        {state.status === "paid" ? (
          <>
            <div className="mx-auto w-16 h-16 rounded-full brand-bg text-white flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h1 className="mt-6 font-display text-3xl font-black">Seu plano Profissional está ativo.</h1>
            <p className="mt-2 text-zinc-600">Pagamento confirmado. Você agora tem orçamentos ilimitados.</p>
          </>
        ) : state.status === "error" || state.status === "no_session" ? (
          <>
            <h1 className="font-display text-3xl font-black">Não foi possível confirmar</h1>
            <p className="mt-2 text-zinc-600">Se você concluiu o pagamento, verifique seu e-mail — ele será ativado automaticamente em instantes.</p>
          </>
        ) : (
          <>
            <div className="mx-auto w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
            </div>
            <h1 className="mt-6 font-display text-3xl font-black">Pagamento recebido!</h1>
            <p className="mt-2 text-zinc-600">Estamos confirmando sua assinatura. Seu plano Profissional será ativado automaticamente.</p>
          </>
        )}
        <Link to="/dashboard/plan" className="block mt-8">
          <Button className="w-full h-11 brand-bg hover:bg-[#008a02] text-white font-bold" data-testid="billing-success-go-dashboard">IR PARA O DASHBOARD</Button>
        </Link>
      </div>
    </div>
  );
}
