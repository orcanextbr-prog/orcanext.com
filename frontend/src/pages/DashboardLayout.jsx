import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { FileText, Users, Package, Wrench, Receipt, Building2, CreditCard, LogOut, Menu, X, Shield } from "lucide-react";

const NavItem = ({ to, icon: I, label, testid }) => (
  <NavLink end to={to} data-testid={testid}
    className={({ isActive }) =>
      `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-semibold ${isActive ? "brand-bg text-white" : "text-zinc-700 hover:bg-zinc-100"}`}>
    <I className="w-4 h-4" /> {label}
  </NavLink>
);

export default function DashboardLayout() {
  const { user, company, logout } = useAuth();
  const nav = useNavigate();
  const [usage, setUsage] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api.get("/quotes/usage").then((r) => setUsage(r.data)).catch(() => {});
  }, []);

  const pct = usage && usage.limit ? Math.min(100, (usage.used / usage.limit) * 100) : 0;
  const near = usage && usage.limit && usage.used >= 40 && usage.used < usage.limit;

  const Sidebar = (
    <aside className="w-64 bg-white border-r border-zinc-200 min-h-screen flex flex-col">
      <div className="p-5 border-b border-zinc-200 flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-2" data-testid="side-logo">
          <span className="w-8 h-8 rounded-md brand-bg text-white flex items-center justify-center font-black">O</span>
          <span className="font-display font-extrabold">OrçaNext</span>
        </Link>
        <button className="md:hidden" onClick={() => setOpen(false)}><X className="w-5 h-5" /></button>
      </div>
      <nav className="p-3 space-y-1">
        <NavItem to="/dashboard/quotes" icon={FileText} label="Orçamentos" testid="nav-quotes" />
        <NavItem to="/dashboard/clients" icon={Users} label="Clientes" testid="nav-clients" />
        <NavItem to="/dashboard/products" icon={Package} label="Produtos" testid="nav-products" />
        <NavItem to="/dashboard/services" icon={Wrench} label="Serviços" testid="nav-services" />
        <NavItem to="/dashboard/receipts" icon={Receipt} label="Recibos" testid="nav-receipts" />
        <NavItem to="/dashboard/company" icon={Building2} label="Minha Empresa" testid="nav-company" />
        <NavItem to="/dashboard/plan" icon={CreditCard} label="Meu Plano" testid="nav-plan" />
        {user?.role === "admin" && <NavItem to="/admin" icon={Shield} label="Admin" testid="nav-admin" />}
      </nav>

      {usage && (
        <div className="mx-3 mt-3 p-4 rounded-xl border border-zinc-200 bg-zinc-50" data-testid="usage-card">
          <div className="text-xs font-bold uppercase tracking-widest text-zinc-500">Orçamentos este mês</div>
          {usage.plan === "PROFESSIONAL" ? (
            <div className="mt-2 flex items-center gap-2">
              <div className="text-2xl font-display font-black brand-text">Ilimitado</div>
            </div>
          ) : (
            <>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-display font-black" data-testid="usage-count">{usage.used}</span>
                <span className="text-zinc-500 text-sm">/ {usage.limit}</span>
              </div>
              <Progress value={pct} className="mt-2 h-2 bg-zinc-200 [&>div]:brand-bg" />
              {usage.blocked && (
                <div className="mt-3 text-xs text-red-600 font-semibold">Limite atingido este mês.</div>
              )}
              {near && !usage.blocked && (
                <div className="mt-3 text-xs text-zinc-600">Você está próximo do limite.</div>
              )}
              <Link to="/dashboard/plan">
                <Button size="sm" className="w-full mt-3 brand-bg hover:bg-[#008a02] text-white font-bold" data-testid="usage-upgrade">
                  ASSINAR PROFISSIONAL
                </Button>
              </Link>
            </>
          )}
        </div>
      )}

      <div className="mt-auto p-4 border-t border-zinc-200 text-sm">
        <div className="truncate font-semibold">{user?.name}</div>
        <div className="truncate text-zinc-500 text-xs">{user?.email}</div>
        <button onClick={async () => { await logout(); nav("/"); }} data-testid="logout-btn"
                className="mt-3 flex items-center gap-2 text-zinc-600 hover:text-black text-sm">
          <LogOut className="w-4 h-4" /> Sair
        </button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen flex bg-zinc-50">
      <div className="hidden md:block">{Sidebar}</div>
      {open && <div className="md:hidden fixed inset-0 z-40"><div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} /><div className="absolute left-0 top-0 h-full">{Sidebar}</div></div>}
      <div className="flex-1 min-w-0">
        <div className="md:hidden sticky top-0 z-30 bg-white border-b border-zinc-200 p-3 flex items-center justify-between">
          <button onClick={() => setOpen(true)}><Menu className="w-5 h-5" /></button>
          <span className="font-display font-extrabold">OrçaNext</span>
          <span />
        </div>
        <main className="p-6 md:p-8 max-w-7xl mx-auto">
          <Outlet context={{ usage, refreshUsage: () => api.get("/quotes/usage").then((r) => setUsage(r.data)).catch(() => {}), company }} />
        </main>
      </div>
    </div>
  );
}
