import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, money } from "@/lib/api";
import { useAuth, formatApiError } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { LogOut, Shield, Users, Building2, FileText, Activity, Settings, AlertTriangle, UserCog } from "lucide-react";

export default function Admin() {
  const { user, logout, refresh } = useAuth();
  const nav = useNavigate();

  const impersonate = async (u) => {
    if (!window.confirm(`Entrar na conta de ${u.email} em modo suporte?\n\nSuas ações serão registradas em auditoria.`)) return;
    try {
      await api.post(`/admin/impersonate/${u.id}`);
      await refresh();
      toast.success(`Entrando como ${u.email}…`);
      nav("/dashboard");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };
  const [metrics, setMetrics] = useState(null);
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [audit, setAudit] = useState([]);
  const [nearLimit, setNearLimit] = useState([]);
  const [settings, setSettings] = useState({});
  const [q, setQ] = useState("");

  const loadAll = async () => {
    const [m, u, c, qt, a, nl, s] = await Promise.all([
      api.get("/admin/metrics"), api.get("/admin/users"), api.get("/admin/companies"),
      api.get("/admin/quotes"), api.get("/admin/audit"), api.get("/admin/near-limit"),
      api.get("/admin/settings"),
    ]);
    setMetrics(m.data); setUsers(u.data); setCompanies(c.data);
    setQuotes(qt.data); setAudit(a.data); setNearLimit(nl.data); setSettings(s.data);
  };
  useEffect(() => { loadAll().catch(() => {}); }, []);

  const block = async (u, val) => {
    try { await api.post(`/admin/users/${u.id}/block`, { blocked: val });
      toast.success(val ? "Usuário bloqueado" : "Usuário desbloqueado"); loadAll();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };
  const setPlan = async (u, plan) => {
    try { await api.post(`/admin/users/${u.id}/plan`, { plan });
      toast.success(`Plano alterado para ${plan}`); loadAll();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };
  const saveSettings = async () => {
    try {
      await api.put("/admin/settings", {
        free_limit: Number(settings.free_limit), pro_monthly: Number(settings.pro_monthly),
        pro_annual: Number(settings.pro_annual), support_email: settings.support_email,
      });
      toast.success("Configurações salvas");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const filteredUsers = users.filter((u) =>
    !q || u.name?.toLowerCase().includes(q.toLowerCase()) || u.email?.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-black text-white">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="OrçaNext" className="w-8 h-8" />
            <span className="font-display font-extrabold">OrçaNext <span className="text-zinc-400 text-sm font-normal">Admin</span></span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/admin/support" className="text-sm text-white hover:underline hidden md:inline" data-testid="admin-nav-support">Suporte</Link>
            <Badge className="brand-bg text-white rounded-md uppercase tracking-widest text-xs">{user?.role}</Badge>
            <span className="text-sm text-zinc-400 hidden md:inline">{user?.email}</span>
            <Button variant="outline" className="text-black" onClick={async () => { await logout(); nav("/"); }}><LogOut className="w-4 h-4 mr-2" />Sair</Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 md:p-8">
        <h1 className="font-display text-3xl font-black">Visão geral</h1>
        <p className="text-zinc-500 text-sm mt-1">Controle total do seu SaaS.</p>

        {metrics && (
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
            {[["Usuários", metrics.users, Users], ["Empresas", metrics.companies, Building2],
              ["Assinantes PRO", metrics.pro_users, Shield], ["Orçamentos", metrics.quotes, FileText],
              ["Aprovados", metrics.quotes_approved, Activity], ["MRR", money(metrics.mrr), Activity],
              ["ARR", money(metrics.arr), Activity], ["Conversão", `${metrics.conversion_rate}%`, Activity]].map(([k, v, I]) => (
              <div key={k} className="bg-white rounded-xl border border-zinc-200 p-4 hover-lift">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500"><I className="w-4 h-4 brand-text" />{k}</div>
                <div className="mt-2 font-display text-2xl font-black">{v}</div>
              </div>
            ))}
          </div>
        )}

        {nearLimit.length > 0 && (
          <div className="mt-6 bg-amber-50 border border-amber-300 rounded-xl p-4">
            <div className="flex items-center gap-2 font-semibold text-amber-800"><AlertTriangle className="w-4 h-4" />{nearLimit.length} empresa(s) próximo(s) do limite mensal</div>
          </div>
        )}

        <Tabs defaultValue="users" className="mt-8">
          <TabsList className="bg-white border border-zinc-200">
            <TabsTrigger value="users" data-testid="admin-tab-users">Usuários</TabsTrigger>
            <TabsTrigger value="companies" data-testid="admin-tab-companies">Empresas</TabsTrigger>
            <TabsTrigger value="quotes" data-testid="admin-tab-quotes">Orçamentos</TabsTrigger>
            <TabsTrigger value="near" data-testid="admin-tab-near">Próximos do limite</TabsTrigger>
            <TabsTrigger value="activity" data-testid="admin-tab-activity">Atividade</TabsTrigger>
            <TabsTrigger value="settings" data-testid="admin-tab-settings">Configurações</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-4">
            <Input placeholder="Pesquisar por nome ou e-mail…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm mb-3" data-testid="admin-users-search" />
            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-left text-xs uppercase tracking-widest text-zinc-500"><tr><th className="px-4 py-3">Nome</th><th className="px-4 py-3">E-mail</th><th className="px-4 py-3">Plano</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Ações</th></tr></thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="border-t border-zinc-100">
                      <td className="px-4 py-3 font-semibold">{u.name}</td>
                      <td className="px-4 py-3">{u.email}</td>
                      <td className="px-4 py-3"><Badge className={u.plan === "PROFESSIONAL" ? "brand-bg text-white" : "bg-zinc-200 text-black"}>{u.plan}</Badge></td>
                      <td className="px-4 py-3 text-zinc-500 uppercase text-xs">{u.role}</td>
                      <td className="px-4 py-3">{u.blocked ? <Badge className="bg-red-100 text-red-700">BLOQUEADO</Badge> : <Badge className="bg-emerald-100 text-emerald-700">ATIVO</Badge>}</td>
                      <td className="px-4 py-3 text-right space-x-2">
                        {u.plan !== "PROFESSIONAL" ? <Button size="sm" variant="outline" onClick={() => setPlan(u, "PROFESSIONAL")}>→ PRO</Button>
                          : <Button size="sm" variant="outline" onClick={() => setPlan(u, "FREE")}>→ FREE</Button>}
                        {u.blocked ? <Button size="sm" variant="outline" onClick={() => block(u, false)}>Desbloquear</Button>
                          : <Button size="sm" variant="outline" className="text-red-600" onClick={() => block(u, true)}>Bloquear</Button>}
                        {user?.role === "super_admin" && u.role === "user" && !u.blocked && (
                          <Button size="sm" variant="outline" className="border-black" onClick={() => impersonate(u)} data-testid={`admin-impersonate-${u.id}`}>
                            <UserCog className="w-3.5 h-3.5 mr-1" />Entrar como
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="companies" className="mt-4">
            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-left text-xs uppercase tracking-widest text-zinc-500"><tr><th className="px-4 py-3">Empresa</th><th className="px-4 py-3">Documento</th><th className="px-4 py-3">Proprietário</th><th className="px-4 py-3">Plano</th><th className="px-4 py-3">Orçamentos</th><th className="px-4 py-3">Clientes</th></tr></thead>
                <tbody>
                  {companies.map((c) => (
                    <tr key={c.id} className="border-t border-zinc-100">
                      <td className="px-4 py-3 font-semibold">{c.name}</td>
                      <td className="px-4 py-3 text-zinc-500">{c.document || "—"}</td>
                      <td className="px-4 py-3">{c.owner_email}</td>
                      <td className="px-4 py-3"><Badge className={c.owner_plan === "PROFESSIONAL" ? "brand-bg text-white" : "bg-zinc-200 text-black"}>{c.owner_plan}</Badge></td>
                      <td className="px-4 py-3">{c.quotes_count}</td>
                      <td className="px-4 py-3">{c.clients_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="quotes" className="mt-4">
            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-left text-xs uppercase tracking-widest text-zinc-500"><tr><th className="px-4 py-3">Nº</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Data</th><th className="px-4 py-3">Valor</th><th className="px-4 py-3">Status</th></tr></thead>
                <tbody>
                  {quotes.map((qt) => (
                    <tr key={qt.id} className="border-t border-zinc-100">
                      <td className="px-4 py-3 font-semibold">{qt.number}</td>
                      <td className="px-4 py-3">{qt.client_name || "—"}</td>
                      <td className="px-4 py-3 text-zinc-500">{qt.date}</td>
                      <td className="px-4 py-3 font-semibold">{money(qt.total)}</td>
                      <td className="px-4 py-3"><Badge>{qt.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="near" className="mt-4">
            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-left text-xs uppercase tracking-widest text-zinc-500"><tr><th className="px-4 py-3">Empresa</th><th className="px-4 py-3">Usuário</th><th className="px-4 py-3">Uso</th></tr></thead>
                <tbody>
                  {nearLimit.length === 0 ? <tr><td colSpan={3} className="p-10 text-center text-zinc-400">Nenhuma empresa próxima do limite este mês.</td></tr>
                    : nearLimit.map((n, i) => (
                      <tr key={i} className="border-t border-zinc-100">
                        <td className="px-4 py-3 font-semibold">{n.company_name}</td>
                        <td className="px-4 py-3">{n.user_email}</td>
                        <td className="px-4 py-3"><Badge className={n.used >= n.limit ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}>{n.used}/{n.limit}</Badge></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-left text-xs uppercase tracking-widest text-zinc-500"><tr><th className="px-4 py-3">Ação</th><th className="px-4 py-3">Entidade</th><th className="px-4 py-3">Empresa</th><th className="px-4 py-3">IP</th><th className="px-4 py-3">Data</th></tr></thead>
                <tbody>
                  {audit.map((a) => (
                    <tr key={a.id} className="border-t border-zinc-100">
                      <td className="px-4 py-3 font-semibold">{a.action}</td>
                      <td className="px-4 py-3">{a.entity_type}</td>
                      <td className="px-4 py-3 text-zinc-500">{a.company_id?.slice(0, 8)}</td>
                      <td className="px-4 py-3 text-zinc-500">{a.ip || "—"}</td>
                      <td className="px-4 py-3 text-zinc-500">{a.created_at?.replace("T", " ").slice(0, 19)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <div className="bg-white border border-zinc-200 rounded-xl p-6 max-w-lg space-y-4">
              <div><label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Limite mensal (Gratuito) — padrão: 15 orçamentos/mês</label>
                <Input type="number" value={settings.free_limit || ""} onChange={(e) => setSettings({ ...settings, free_limit: e.target.value })} data-testid="admin-set-limit" /></div>
              <div><label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Preço mensal Profissional (R$)</label>
                <Input type="number" step="0.01" value={settings.pro_monthly || ""} onChange={(e) => setSettings({ ...settings, pro_monthly: e.target.value })} /></div>
              <div><label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Preço anual Profissional (R$)</label>
                <Input type="number" step="0.01" value={settings.pro_annual || ""} onChange={(e) => setSettings({ ...settings, pro_annual: e.target.value })} /></div>
              <div><label className="text-xs font-bold uppercase tracking-widest text-zinc-500">E-mail de suporte</label>
                <Input value={settings.support_email || ""} onChange={(e) => setSettings({ ...settings, support_email: e.target.value })} /></div>
              <Button onClick={saveSettings} className="brand-bg hover:bg-[#008a02] text-white font-bold w-full" data-testid="admin-save-settings">Salvar configurações</Button>
              <p className="text-xs text-zinc-400">Apenas SUPER_ADMIN pode salvar. Todas alterações são registradas em auditoria.</p>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
