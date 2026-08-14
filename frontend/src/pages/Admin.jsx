import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, money } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export default function Admin() {
  const { logout } = useAuth();
  const nav = useNavigate();
  const [metrics, setMetrics] = useState(null);
  const [users, setUsers] = useState([]);
  const [audit, setAudit] = useState([]);

  useEffect(() => {
    api.get("/admin/metrics").then((r) => setMetrics(r.data));
    api.get("/admin/users").then((r) => setUsers(r.data));
    api.get("/admin/audit").then((r) => setAudit(r.data));
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-black text-white">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-md brand-bg flex items-center justify-center font-black">O</span>
            <span className="font-display font-extrabold">OrçaNext <span className="text-zinc-400 text-sm font-normal">Admin</span></span>
          </Link>
          <div className="flex gap-2">
            <Link to="/dashboard"><Button variant="outline" className="text-black">Dashboard</Button></Link>
            <Button variant="outline" className="text-black" onClick={async () => { await logout(); nav("/"); }}><LogOut className="w-4 h-4 mr-2" />Sair</Button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto p-6 md:p-8">
        <h1 className="font-display text-3xl font-black">Métricas</h1>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          {metrics && [
            ["Usuários", metrics.users], ["Empresas", metrics.companies],
            ["Orçamentos", metrics.quotes], ["Aprovados", metrics.quotes_approved],
            ["Assinantes PRO", metrics.pro_users], ["MRR", money(metrics.mrr)],
            ["ARR", money(metrics.arr)], ["Conversão", `${metrics.conversion_rate}%`],
          ].map(([k, v]) => (
            <div key={k} className="bg-white rounded-xl border border-zinc-200 p-4">
              <div className="text-xs font-bold uppercase tracking-widest text-zinc-500">{k}</div>
              <div className="mt-1 font-display text-2xl font-black">{v}</div>
            </div>
          ))}
        </div>

        <h2 className="font-display text-2xl font-black mt-10">Usuários</h2>
        <div className="mt-3 bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-widest text-zinc-500"><tr><th className="px-4 py-3">Nome</th><th className="px-4 py-3">E-mail</th><th className="px-4 py-3">Plano</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Criado</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-zinc-100"><td className="px-4 py-3 font-semibold">{u.name}</td><td className="px-4 py-3">{u.email}</td><td className="px-4 py-3">{u.plan}</td><td className="px-4 py-3">{u.role}</td><td className="px-4 py-3 text-zinc-500">{u.created_at?.slice(0, 10)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="font-display text-2xl font-black mt-10">Auditoria (últimos 100)</h2>
        <div className="mt-3 bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-widest text-zinc-500"><tr><th className="px-4 py-3">Ação</th><th className="px-4 py-3">Entidade</th><th className="px-4 py-3">Empresa</th><th className="px-4 py-3">IP</th><th className="px-4 py-3">Data</th></tr></thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.id} className="border-t border-zinc-100"><td className="px-4 py-3 font-semibold">{a.action}</td><td className="px-4 py-3">{a.entity_type}</td><td className="px-4 py-3 text-zinc-500">{a.company_id?.slice(0, 8)}</td><td className="px-4 py-3 text-zinc-500">{a.ip || "—"}</td><td className="px-4 py-3 text-zinc-500">{a.created_at?.replace("T", " ").slice(0, 19)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
