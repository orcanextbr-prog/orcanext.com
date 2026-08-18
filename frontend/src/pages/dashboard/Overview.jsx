import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { api, money } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Plus, ArrowRight, TrendingUp, CheckCircle2, Wallet, Clock, XCircle, FileText,
  Users, Package, Wrench, Sparkles, Send, Eye, PenLine,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import OnboardingChecklist from "./OnboardingChecklist";

const PERIODS = [
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "3m", label: "3 meses" },
  { id: "all", label: "Todo o período" },
];

const STATUS_STYLE = {
  RASCUNHO: "bg-zinc-100 text-zinc-800",
  ENVIADO: "bg-black text-white",
  VISUALIZADO: "bg-zinc-200 text-black",
  AGUARDANDO_APROVACAO: "bg-zinc-200 text-black",
  APROVADO: "bg-[#00AD02]/10 text-[#00AD02]",
  ASSINADO: "brand-bg text-white",
  RECUSADO: "bg-red-100 text-red-700",
  EXPIRADO: "bg-amber-100 text-amber-800",
  CANCELADO: "bg-zinc-200 text-zinc-500",
};

const FUNNEL_STEPS = [
  { key: "enviados",    label: "Enviados",    icon: Send,        pull: ["ENVIADO", "VISUALIZADO", "AGUARDANDO_APROVACAO", "APROVADO", "ASSINADO", "RECUSADO", "EXPIRADO"] },
  { key: "visualizados",label: "Visualizados",icon: Eye,         pull: ["VISUALIZADO", "AGUARDANDO_APROVACAO", "APROVADO", "ASSINADO"] },
  { key: "aguardando",  label: "Aguardando",  icon: Clock,       pull: ["AGUARDANDO_APROVACAO", "APROVADO", "ASSINADO"] },
  { key: "aprovados",   label: "Aprovados",   icon: CheckCircle2,pull: ["APROVADO", "ASSINADO"] },
  { key: "assinados",   label: "Assinados",   icon: PenLine,     pull: ["ASSINADO"] },
];

function KpiCard({ label, value, hint, icon: Icon, primary = false, testid }) {
  return (
    <div data-testid={testid}
      className={`rounded-2xl p-5 md:p-6 transition ${primary ? "bg-black text-white border border-black" : "bg-white text-black border border-zinc-200 hover:border-zinc-300"}`}>
      <div className="flex items-center justify-between">
        <span className={`text-[11px] font-bold uppercase tracking-widest ${primary ? "text-zinc-400" : "text-zinc-500"}`}>{label}</span>
        {Icon && (
          <span className={`w-8 h-8 rounded-lg grid place-items-center ${primary ? "bg-[#00AD02]/20 text-[#00AD02]" : "bg-zinc-100 text-zinc-600"}`}>
            <Icon className="w-4 h-4" />
          </span>
        )}
      </div>
      <div className={`mt-3 font-display font-black leading-none ${primary ? "text-4xl md:text-5xl text-white" : "text-2xl md:text-3xl"}`}>{value}</div>
      {hint && <div className={`mt-2 text-xs ${primary ? "text-zinc-300" : "text-zinc-500"}`}>{hint}</div>}
    </div>
  );
}

function SmallCard({ label, value, icon: Icon, tone = "default", testid }) {
  const tones = {
    default: "text-zinc-600 bg-zinc-100",
    green: "text-[#00AD02] bg-[#00AD02]/10",
    amber: "text-amber-700 bg-amber-100",
    red: "text-red-600 bg-red-50",
  };
  return (
    <div data-testid={testid} className="rounded-2xl border border-zinc-200 bg-white p-4 md:p-5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">{label}</span>
        {Icon && <span className={`w-8 h-8 rounded-lg grid place-items-center ${tones[tone]}`}><Icon className="w-4 h-4" /></span>}
      </div>
      <div className="mt-2 font-display text-2xl md:text-3xl font-black">{value}</div>
    </div>
  );
}

function fmtDateShort(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  } catch { return ""; }
}

function fmtBucket(key, gran) {
  if (!key) return "";
  if (gran === "month") {
    const [y, m] = key.split("-");
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
  }
  // day/week key is yyyy-mm-dd
  const d = new Date(key + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export default function Overview() {
  const { company, usage } = useOutletContext();
  const [period, setPeriod] = useState("30d");
  const [summary, setSummary] = useState(null);
  const [series, setSeries] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      api.get("/dashboard/summary", { params: { period } }).then((r) => r.data).catch(() => null),
      api.get("/dashboard/timeseries", { params: { period } }).then((r) => r.data).catch(() => null),
    ]).then(([s, t]) => {
      if (!alive) return;
      setSummary(s); setSeries(t); setLoading(false);
    });
    return () => { alive = false; };
  }, [period]);

  useEffect(() => {
    api.get("/quotes").then((r) => setRecent((r.data || []).slice(0, 5))).catch(() => setRecent([]));
  }, []);

  const counts = summary?.counts || {};
  const total = summary?.total || 0;
  const approved = summary?.approved_count || 0;
  const sent = summary?.sent_count || 0;
  const waiting = counts["AGUARDANDO_APROVACAO"] || 0;
  const refused = counts["RECUSADO"] || 0;
  const conversion = summary?.conversion_rate ?? 0;
  const valueApproved = summary?.value_approved || 0;

  const funnel = useMemo(() => {
    return FUNNEL_STEPS.map((s) => ({
      ...s,
      value: s.pull.reduce((acc, k) => acc + (counts[k] || 0), 0),
    }));
  }, [summary]);
  const funnelMax = Math.max(1, ...funnel.map((f) => f.value));

  const chartData = useMemo(() => {
    const gran = series?.granularity || "day";
    return (series?.series || []).map((p) => ({
      label: fmtBucket(p.date, gran),
      Enviados: p.enviados,
      Aprovados: p.aprovados,
    }));
  }, [series]);

  const companyName = company?.name || "por aí";
  const isPro = usage?.plan === "PROFESSIONAL";
  const usedNow = usage?.used ?? 0;
  const usageLimit = usage?.limit ?? 15;
  const remaining = Math.max(0, usageLimit - usedNow);
  const nearLimit = !isPro && usageLimit > 0 && usedNow / usageLimit >= 0.8 && usedNow < usageLimit;
  const atLimit = !isPro && usedNow >= usageLimit;
  const usagePct = !isPro && usageLimit > 0 ? Math.min(100, (usedNow / usageLimit) * 100) : 0;

  const emptyAll = !loading && total === 0 && recent.length === 0;

  return (
    <div data-testid="dashboard-overview" className="space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-4xl font-black tracking-tight" data-testid="dashboard-greeting">
            Olá, {companyName} <span className="inline-block">👋</span>
          </h1>
          <p className="text-zinc-500 text-sm md:text-base mt-1">Veja como estão seus orçamentos hoje.</p>
        </div>
        <Link to="/dashboard/quotes/new" className="md:self-end">
          <Button data-testid="cta-new-quote"
            className="w-full md:w-auto brand-bg hover:bg-[#008a02] text-white font-bold rounded-xl px-5 py-6 md:py-3 text-base md:text-sm">
            <Plus className="w-5 h-5 mr-2" /> Novo Orçamento
          </Button>
        </Link>
      </div>

      <OnboardingChecklist />

      {emptyAll ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 md:p-12 text-center" data-testid="dashboard-empty">
          <div className="w-14 h-14 rounded-2xl bg-[#00AD02]/10 grid place-items-center mx-auto">
            <Sparkles className="w-7 h-7 text-[#00AD02]" />
          </div>
          <h2 className="mt-4 font-display text-xl md:text-2xl font-black">Você ainda não criou nenhum orçamento.</h2>
          <p className="text-zinc-500 mt-2 text-sm">Comece agora e acompanhe seus resultados aqui.</p>
          <Link to="/dashboard/quotes/new">
            <Button data-testid="empty-create-first" className="mt-6 brand-bg hover:bg-[#008a02] text-white font-bold rounded-xl">
              <Plus className="w-4 h-4 mr-2" /> Criar meu primeiro orçamento
            </Button>
          </Link>
        </div>
      ) : (
        <>
          {/* Primary KPIs — hierarchy */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            <KpiCard testid="kpi-value-approved" primary label="Valor aprovado"
              value={loading ? "…" : money(valueApproved)}
              hint={approved > 0 ? `de ${approved} ${approved === 1 ? "orçamento aprovado" : "orçamentos aprovados"}` : "Nenhum orçamento aprovado no período"}
              icon={Wallet} />
            <KpiCard testid="kpi-conversion" primary label="Taxa de conversão"
              value={loading ? "…" : `${conversion}%`}
              hint={sent > 0 ? `${approved} de ${sent} enviados` : "Sem envios no período"}
              icon={TrendingUp} />
            <KpiCard testid="kpi-approved" primary label="Aprovados"
              value={loading ? "…" : approved}
              hint={total > 0 ? `de ${total} ${total === 1 ? "orçamento no total" : "orçamentos no total"}` : "—"}
              icon={CheckCircle2} />
          </div>

          {/* Secondary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SmallCard testid="kpi-total" label="Total" value={loading ? "…" : total} icon={FileText} />
            <SmallCard testid="kpi-waiting" label="Aguardando" value={loading ? "…" : waiting} icon={Clock} tone="amber" />
            <SmallCard testid="kpi-refused" label="Recusados" value={loading ? "…" : refused} icon={XCircle} tone="red" />
            <SmallCard testid="kpi-sent" label="Enviados" value={loading ? "…" : sent} icon={Send} />
          </div>

          {/* Performance chart */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 md:p-6" data-testid="performance-chart">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h2 className="font-display text-lg md:text-xl font-black">Desempenho dos orçamentos</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Enviados vs Aprovados no período selecionado.</p>
              </div>
              <div className="inline-flex bg-zinc-100 rounded-full p-1 self-start md:self-auto overflow-x-auto max-w-full" data-testid="period-filter">
                {PERIODS.map((p) => (
                  <button key={p.id} onClick={() => setPeriod(p.id)} data-testid={`period-${p.id}`}
                    className={`px-3 md:px-4 py-1.5 text-xs md:text-sm font-bold rounded-full transition whitespace-nowrap ${period === p.id ? "bg-black text-white" : "text-zinc-600 hover:text-black"}`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-5 h-64 md:h-72">
              {loading ? (
                <div className="h-full grid place-items-center text-zinc-400 text-sm">Carregando…</div>
              ) : chartData.length === 0 || chartData.every((d) => d.Enviados === 0 && d.Aprovados === 0) ? (
                <div className="h-full grid place-items-center text-zinc-500 text-sm text-center px-6">
                  Sem movimentação no período. Crie e envie orçamentos para ver a evolução aqui.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#71717a" }} axisLine={{ stroke: "#e4e4e7" }} tickLine={false} interval="preserveStartEnd" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid #e4e4e7", fontSize: 12 }}
                      labelStyle={{ fontWeight: 700, color: "#000" }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="Enviados" stroke="#000000" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="Aprovados" stroke="#00AD02" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Funnel + Plan */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            <div className="lg:col-span-2 rounded-2xl border border-zinc-200 bg-white p-5 md:p-6" data-testid="conversion-funnel">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg md:text-xl font-black">Funil de orçamentos</h2>
                <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">{PERIODS.find((p) => p.id === period)?.label}</span>
              </div>
              <div className="mt-5 space-y-3">
                {funnel.map((f, idx) => {
                  const pct = funnelMax ? (f.value / funnelMax) * 100 : 0;
                  const Icon = f.icon;
                  return (
                    <div key={f.key} data-testid={`funnel-${f.key}`}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="inline-flex items-center gap-2 font-semibold">
                          <Icon className="w-4 h-4 text-zinc-500" /> {f.label}
                        </span>
                        <span className="tabular-nums text-zinc-700 font-bold">{f.value}</span>
                      </div>
                      <div className="mt-1.5 h-3 rounded-full bg-zinc-100 overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${idx === funnel.length - 1 || idx === 3 ? "brand-bg" : "bg-black"}`}
                             style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                {!loading && total === 0 && (
                  <p className="pt-4 text-sm text-zinc-500 text-center">Nenhum orçamento no período.</p>
                )}
              </div>
            </div>

            {/* Plan status */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 md:p-6" data-testid="plan-status">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Situação do plano</span>
                <Badge className={`rounded-md ${isPro ? "brand-bg text-white" : "bg-zinc-100 text-zinc-700"}`}>
                  {isPro ? "Profissional" : "Gratuito"}
                </Badge>
              </div>
              {isPro ? (
                <div className="mt-4">
                  <div className="font-display text-2xl md:text-3xl font-black">Ilimitado ✓</div>
                  <p className="text-sm text-zinc-500 mt-2">Você pode criar quantos orçamentos precisar.</p>
                  <Link to="/dashboard/plan">
                    <Button variant="outline" className="mt-5 w-full rounded-xl border-zinc-300" data-testid="plan-manage-btn">
                      Gerenciar assinatura
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="mt-4">
                  <div className="flex items-end gap-2">
                    <span className="font-display text-3xl font-black" data-testid="plan-usage-count">{usedNow}</span>
                    <span className="text-zinc-500 text-sm mb-1">/ {usageLimit} orçamentos</span>
                  </div>
                  <Progress value={usagePct} className="mt-3 h-2" />
                  <p className={`mt-3 text-sm ${atLimit ? "text-red-600 font-bold" : nearLimit ? "text-amber-700 font-semibold" : "text-zinc-500"}`}>
                    {atLimit
                      ? "Limite atingido. Faça upgrade para continuar."
                      : nearLimit
                        ? "Você está próximo do limite do plano gratuito."
                        : `${remaining} ${remaining === 1 ? "orçamento restante" : "orçamentos restantes"}.`}
                  </p>
                  <Link to="/dashboard/plan">
                    <Button className="mt-5 w-full brand-bg hover:bg-[#008a02] text-white font-bold rounded-xl" data-testid="plan-upgrade-btn">
                      Conhecer plano Profissional
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Recent quotes + Quick actions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            <div className="lg:col-span-2 rounded-2xl border border-zinc-200 bg-white p-5 md:p-6" data-testid="recent-quotes">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg md:text-xl font-black">Orçamentos recentes</h2>
                <Link to="/dashboard/quotes" className="text-sm font-bold text-black hover:text-[#00AD02] inline-flex items-center gap-1" data-testid="recent-see-all">
                  Ver todos <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              {recent.length === 0 ? (
                <p className="mt-6 text-sm text-zinc-500 text-center py-6">Nenhum orçamento ainda.</p>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="mt-4 hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[11px] font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-200">
                          <th className="py-2">Cliente</th>
                          <th className="py-2">Número</th>
                          <th className="py-2">Data</th>
                          <th className="py-2">Valor</th>
                          <th className="py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recent.map((r) => (
                          <tr key={r.id} className="border-b border-zinc-100 last:border-none hover:bg-zinc-50" data-testid={`recent-row-${r.id}`}>
                            <td className="py-3 font-semibold">{r.client_name || "—"}</td>
                            <td className="py-3 text-zinc-600">#{r.number}</td>
                            <td className="py-3 text-zinc-600">{fmtDateShort(r.created_at)}</td>
                            <td className="py-3 font-bold">{money(r.total || 0)}</td>
                            <td className="py-3">
                              <Badge className={`rounded-md ${STATUS_STYLE[r.status] || "bg-zinc-100"}`}>{r.status}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Mobile cards */}
                  <div className="mt-4 md:hidden space-y-3">
                    {recent.map((r) => (
                      <Link key={r.id} to={`/dashboard/quotes/${r.id}`}
                        className="block rounded-xl border border-zinc-200 p-4 hover:border-zinc-300" data-testid={`recent-card-${r.id}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-bold truncate">{r.client_name || "—"}</div>
                            <div className="text-xs text-zinc-500 mt-0.5">#{r.number} · {fmtDateShort(r.created_at)}</div>
                          </div>
                          <Badge className={`rounded-md shrink-0 ${STATUS_STYLE[r.status] || "bg-zinc-100"}`}>{r.status}</Badge>
                        </div>
                        <div className="mt-3 font-display text-lg font-black">{money(r.total || 0)}</div>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Quick actions */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 md:p-6" data-testid="quick-actions">
              <h2 className="font-display text-lg md:text-xl font-black">Ações rápidas</h2>
              <div className="mt-4 space-y-2.5">
                <Link to="/dashboard/quotes/new">
                  <Button className="w-full justify-start brand-bg hover:bg-[#008a02] text-white font-bold rounded-xl" data-testid="quick-new-quote">
                    <Plus className="w-4 h-4 mr-2" /> Novo orçamento
                  </Button>
                </Link>
                <Link to="/dashboard/clients">
                  <Button variant="outline" className="w-full justify-start rounded-xl border-zinc-300 mt-2.5" data-testid="quick-new-client">
                    <Users className="w-4 h-4 mr-2" /> Novo cliente
                  </Button>
                </Link>
                <Link to="/dashboard/products">
                  <Button variant="outline" className="w-full justify-start rounded-xl border-zinc-300 mt-2.5" data-testid="quick-new-product">
                    <Package className="w-4 h-4 mr-2" /> Novo produto
                  </Button>
                </Link>
                <Link to="/dashboard/services">
                  <Button variant="outline" className="w-full justify-start rounded-xl border-zinc-300 mt-2.5" data-testid="quick-new-service">
                    <Wrench className="w-4 h-4 mr-2" /> Novo serviço
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
