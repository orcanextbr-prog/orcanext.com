import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api, money } from "@/lib/api";
import { Send, Eye, Clock, CheckCircle2, PenLine, XCircle, Ban, CalendarX, FileText, TrendingUp } from "lucide-react";

const PERIODS = [
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "3m", label: "3 meses" },
  { id: "all", label: "Todo o período" },
];

const STATUS_META = [
  { key: "ENVIADO", label: "Enviados", icon: Send },
  { key: "VISUALIZADO", label: "Visualizados", icon: Eye },
  { key: "AGUARDANDO_APROVACAO", label: "Aguardando", icon: Clock },
  { key: "APROVADO", label: "Aprovados", icon: CheckCircle2 },
  { key: "ASSINADO", label: "Assinados", icon: PenLine },
  { key: "RECUSADO", label: "Recusados", icon: XCircle },
  { key: "CANCELADO", label: "Cancelados", icon: Ban },
  { key: "EXPIRADO", label: "Expirados", icon: CalendarX },
];

function KpiCard({ label, value, icon: Icon, testid, accent = false }) {
  return (
    <div data-testid={testid}
      className={`rounded-2xl border p-5 bg-white ${accent ? "border-black" : "border-zinc-200"} hover-lift`}>
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
        {Icon && <Icon className="w-4 h-4 brand-text" />}{label}
      </div>
      <div className="mt-2 font-display text-3xl font-black">{value}</div>
    </div>
  );
}

export default function Overview() {
  const { company } = useOutletContext();
  const [period, setPeriod] = useState("30d");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.get("/dashboard/summary", { params: { period } })
      .then((r) => { if (alive) setData(r.data); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [period]);

  const counts = data?.counts || {};
  const total = data?.total || 0;
  const maxBar = Math.max(1, ...STATUS_META.map((s) => counts[s.key] || 0));

  return (
    <div data-testid="dashboard-overview">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-black">Painel</h1>
          <p className="text-zinc-500 text-sm mt-1">Acompanhe seus orçamentos e desempenho comercial{company?.name ? ` — ${company.name}` : ""}.</p>
        </div>
        <div className="inline-flex bg-white border border-zinc-200 rounded-full p-1" data-testid="period-filter">
          {PERIODS.map((p) => (
            <button key={p.id} onClick={() => setPeriod(p.id)} data-testid={`period-${p.id}`}
              className={`px-3 md:px-4 py-1.5 text-xs md:text-sm font-bold rounded-full transition ${period === p.id ? "brand-bg text-white" : "text-zinc-600 hover:text-black"}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Highlight row */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard testid="kpi-total" label="Total" value={loading ? "…" : total} icon={FileText} accent />
        <KpiCard testid="kpi-value-sent" label="Valor enviado" value={loading ? "…" : money(data?.value_sent || 0)} icon={Send} />
        <KpiCard testid="kpi-value-approved" label="Valor aprovado" value={loading ? "…" : money(data?.value_approved || 0)} icon={CheckCircle2} />
        <KpiCard testid="kpi-conversion" label="Taxa de conversão" value={loading ? "…" : `${data?.conversion_rate ?? 0}%`} icon={TrendingUp} />
      </div>

      {/* Status counts */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {STATUS_META.map((s) => (
          <KpiCard key={s.key} testid={`kpi-${s.key.toLowerCase()}`} label={s.label} icon={s.icon}
                   value={loading ? "…" : (counts[s.key] || 0)} />
        ))}
      </div>

      {/* Status distribution chart (pure CSS, no library) */}
      <div className="mt-6 bg-white border border-zinc-200 rounded-2xl p-6" data-testid="status-chart">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-black">Distribuição por status</h2>
          <span className="text-xs text-zinc-500 uppercase tracking-widest">{PERIODS.find((p) => p.id === period)?.label}</span>
        </div>
        <div className="mt-5 space-y-3">
          {STATUS_META.map((s) => {
            const v = counts[s.key] || 0;
            const pct = total ? (v / total) * 100 : 0;
            const barPct = maxBar ? (v / maxBar) * 100 : 0;
            return (
              <div key={s.key} data-testid={`bar-${s.key.toLowerCase()}`}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">{s.label}</span>
                  <span className="text-zinc-500 tabular-nums">{v} <span className="text-zinc-400">({pct.toFixed(0)}%)</span></span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-zinc-100 overflow-hidden">
                  <div className="h-full brand-bg rounded-full transition-all" style={{ width: `${barPct}%` }} />
                </div>
              </div>
            );
          })}
          {!loading && total === 0 && (
            <div className="py-10 text-center text-sm text-zinc-500">
              Nenhum orçamento no período selecionado. Crie seu primeiro orçamento para ver seus indicadores aqui.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
