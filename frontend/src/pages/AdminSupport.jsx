import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth, formatApiError } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { LifeBuoy, ArrowLeft, Send, LogOut } from "lucide-react";

const STATUSES = [
  { id: "", label: "Todos" },
  { id: "ABERTO", label: "Abertos" },
  { id: "EM_ATENDIMENTO", label: "Em atendimento" },
  { id: "AGUARDANDO_USUARIO", label: "Aguardando usuário" },
  { id: "RESOLVIDO", label: "Resolvidos" },
  { id: "FECHADO", label: "Fechados" },
];
const STATUS_LABEL = Object.fromEntries(STATUSES.filter((s) => s.id).map((s) => [s.id, s.label.replace(/s$/, "")]));
const STATUS_STYLE = {
  ABERTO: "bg-zinc-100 text-black",
  EM_ATENDIMENTO: "bg-black text-white",
  AGUARDANDO_USUARIO: "bg-amber-100 text-amber-900",
  RESOLVIDO: "brand-bg text-white",
  FECHADO: "bg-zinc-200 text-zinc-600",
};

const fmt = (iso) => iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
const fmtDT = (iso) => iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

function AdminTicketDetail({ id, onBack }) {
  const [data, setData] = useState(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [statusVal, setStatusVal] = useState("");

  const load = async () => {
    const r = await api.get(`/support/tickets/${id}`);
    setData(r.data); setStatusVal(r.data.ticket.status);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const send = async (e) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    try {
      await api.post(`/support/tickets/${id}/messages`, { message: reply });
      setReply(""); await load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setSending(false); }
  };

  const changeStatus = async (s) => {
    setStatusVal(s);
    try { await api.put(`/support/tickets/${id}/status`, { status: s });
      toast.success("Status atualizado"); await load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  if (!data) return <div className="text-zinc-500 text-sm">Carregando…</div>;
  const t = data.ticket;
  return (
    <div data-testid="admin-ticket-detail">
      <button onClick={onBack} className="text-sm text-zinc-600 hover:text-black flex items-center gap-1"><ArrowLeft className="w-4 h-4" />Voltar</button>
      <div className="mt-3 bg-white border border-zinc-200 rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-zinc-500">Chamado #{t.number} · {t.category}</div>
            <h2 className="font-display text-2xl font-black mt-1">{t.subject}</h2>
            <div className="text-xs text-zinc-500 mt-1">
              <b>{t.user_name || t.user_email}</b> · {t.user_email} · {t.company_name || "—"}
              <br />Aberto {fmt(t.created_at)} · Atualizado {fmtDT(t.updated_at)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 uppercase tracking-widest">Status</span>
            <Select value={statusVal} onValueChange={changeStatus}>
              <SelectTrigger className="w-56" data-testid="admin-ticket-status-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.filter((s) => s.id).map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-6 space-y-3">
          {data.messages.map((m) => {
            const isAdmin = m.sender_type === "ADMIN";
            return (
              <div key={m.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-xl p-3 text-sm ${isAdmin ? "brand-bg text-white" : "bg-zinc-100 text-black"}`}>
                  <div className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">
                    {isAdmin ? "Suporte OrçaNext" : (m.sender_name || t.user_email)}
                  </div>
                  <div className="whitespace-pre-wrap leading-snug">{m.message}</div>
                  <div className="mt-1 text-[10px] opacity-70">{fmtDT(m.created_at)}</div>
                </div>
              </div>
            );
          })}
        </div>
        {t.status !== "FECHADO" && (
          <form onSubmit={send} className="mt-6 border-t border-zinc-200 pt-4">
            <Textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} placeholder="Digite uma resposta…" data-testid="admin-reply-input" />
            <div className="mt-2 flex justify-end">
              <Button type="submit" disabled={sending || !reply.trim()} className="brand-bg hover:bg-[#008a02] text-white font-bold" data-testid="admin-reply-send">
                <Send className="w-4 h-4 mr-1" /> RESPONDER
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function AdminSupport() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({});
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState(null);

  const load = async () => {
    const [tk, st] = await Promise.all([
      api.get("/admin/support/tickets", { params: statusFilter ? { status: statusFilter } : {} }),
      api.get("/admin/support/stats"),
    ]);
    setTickets(tk.data); setStats(st.data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [statusFilter]);

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-black text-white">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/admin" className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-md brand-bg flex items-center justify-center font-black">O</span>
            <span className="font-display font-extrabold">OrçaNext <span className="text-zinc-400 text-sm font-normal">Suporte</span></span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/admin" className="text-sm hover:underline">← Painel Admin</Link>
            <span className="text-sm text-zinc-400 hidden md:inline">{user?.email}</span>
            <Button variant="outline" className="text-black" onClick={async () => { await logout(); nav("/"); }}><LogOut className="w-4 h-4 mr-2" />Sair</Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 md:p-8">
        {selected ? (
          <AdminTicketDetail id={selected} onBack={() => { setSelected(null); load(); }} />
        ) : (
          <>
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div>
                <h1 className="font-display text-3xl font-black flex items-center gap-2"><LifeBuoy className="w-7 h-7 brand-text" /> Central de Suporte</h1>
                <p className="text-zinc-500 text-sm mt-1">Atenda chamados abertos pelos usuários.</p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
              {[["ABERTO", "Abertos"], ["EM_ATENDIMENTO", "Em atendimento"], ["AGUARDANDO_USUARIO", "Aguardando usuário"], ["RESOLVIDO", "Resolvidos"]].map(([k, l]) => (
                <div key={k} className="bg-white rounded-2xl border border-zinc-200 p-4" data-testid={`support-stat-${k}`}>
                  <div className="text-xs font-bold uppercase tracking-widest text-zinc-500">{l}</div>
                  <div className="mt-1 font-display text-3xl font-black">{stats[k] ?? 0}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 inline-flex bg-white border border-zinc-200 rounded-full p-1" data-testid="admin-support-filter">
              {STATUSES.map((s) => (
                <button key={s.id || "all"} onClick={() => setStatusFilter(s.id)}
                  data-testid={`filter-${s.id || "all"}`}
                  className={`px-3 md:px-4 py-1.5 text-xs md:text-sm font-bold rounded-full transition ${statusFilter === s.id ? "brand-bg text-white" : "text-zinc-600 hover:text-black"}`}>
                  {s.label}
                </button>
              ))}
            </div>

            <div className="mt-4 bg-white border border-zinc-200 rounded-2xl overflow-hidden">
              {tickets.length === 0 ? (
                <div className="p-12 text-center text-zinc-500 text-sm">Nenhum chamado encontrado.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 text-left text-xs uppercase tracking-widest text-zinc-500">
                    <tr><th className="px-4 py-3">Nº</th><th className="px-4 py-3">Usuário</th><th className="px-4 py-3">Empresa</th><th className="px-4 py-3">Assunto</th><th className="px-4 py-3">Categoria</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Atualizado</th></tr>
                  </thead>
                  <tbody>
                    {tickets.map((t) => (
                      <tr key={t.id} onClick={() => setSelected(t.id)} className="border-t border-zinc-100 hover:bg-zinc-50 cursor-pointer" data-testid={`admin-ticket-row-${t.number}`}>
                        <td className="px-4 py-3 font-semibold">#{t.number}</td>
                        <td className="px-4 py-3">{t.user_name || t.user_email}</td>
                        <td className="px-4 py-3 text-zinc-500">{t.company_name || "—"}</td>
                        <td className="px-4 py-3">{t.subject}</td>
                        <td className="px-4 py-3 text-zinc-500">{t.category}</td>
                        <td className="px-4 py-3"><Badge className={`${STATUS_STYLE[t.status]} rounded-md`}>{STATUS_LABEL[t.status] || t.status}</Badge></td>
                        <td className="px-4 py-3 text-zinc-500">{fmtDT(t.updated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
