import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";

/**
 * /billing/cancel — user closed Stripe Checkout. No plan changes.
 */
export default function BillingCancel() {
  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border border-zinc-200 rounded-2xl p-10 text-center" data-testid="billing-cancel-card">
        <div className="mx-auto w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center">
          <XCircle className="w-8 h-8 text-zinc-500" />
        </div>
        <h1 className="mt-6 font-display text-3xl font-black">Pagamento não concluído.</h1>
        <p className="mt-2 text-zinc-600">Você pode tentar novamente quando quiser. Sua conta continua no plano atual.</p>
        <div className="mt-8 grid gap-2">
          <Link to="/dashboard/plan">
            <Button className="w-full h-11 brand-bg hover:bg-[#008a02] text-white font-bold" data-testid="billing-cancel-retry">TENTAR NOVAMENTE</Button>
          </Link>
          <Link to="/dashboard">
            <Button variant="outline" className="w-full h-11 border-black font-bold">VOLTAR AO DASHBOARD</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
