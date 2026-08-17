import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth, formatApiError } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, ArrowLeft, LifeBuoy, Send } from "lucide-react";

const STATUS_LABEL = {
  ABERTO: "Aberto",
  EM_ATENDIMENTO: "Em atendimento",
  AGUARDANDO_USUARIO: "Aguardando você",
  RESOLVIDO: "Resolvido",
  FECHADO: "Fechado",
};
const STATUS_STYLE = {
  ABERTO: "bg-zinc-100 text-black",
  EM_ATENDIMENTO: "bg-black text-white",
  AGUARDANDO_USUARIO: "bg-amber-100 text-amber-900",
  RESOLVIDO: "brand-bg text-white",
  FECHADO: "bg-zinc-200 text-zinc-600",
};

const fmt = (iso) => iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
const fmtDT = (iso) => iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

function NewTicketDialog({ open, onOpenChange, categories, onCreated }) {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("Dúvida");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/support/tickets", { subject, category, message });
      toast.success("Chamado enviado com sucesso.");
      setSubject(""); setMessage(""); setCategory("Dúvida");
      onOpenChange(false);
      onCreated(data);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setLoading(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="new-ticket-dialog">
        <DialogHeader><DialogTitle className="font-display text-2xl">Novo chamado</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Assunto</label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} required minLength={3} maxLength={140} data-testid="ticket-subject" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Categoria</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger data-testid="ticket-category"><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Mensagem</label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} required data-testid="ticket-message" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="brand-bg hover:bg-[#008a02] text-white font-bold" data-testid="ticket-submit">
              {loading ? "Enviando…" : "ENVIAR CHAMADO"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TicketDetail({ id, onBack, onChanged }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const load = async () => {
    const r = await api.get(`/support/tickets/${id}`);
    setData(r.data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const send = async (e) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    try {
      await api.post(`/support/tickets/${id}/messages`, { message: reply });
      setReply("");
      await load();
      onChanged?.();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setSending(false); }
  };

  if (!data) return <div className="text-zinc-500 text-sm">Carregando…</div>;
  const t = data.ticket;
  const canReply = t.status !== "FECHADO" && ["ABERTO", "EM_ATENDIMENTO", "AGUARDANDO_USUARIO"].includes(t.status);
  return (
    <div data-testid="ticket-detail">
      <button onClick={onBack} className="text-sm text-zinc-600 hover:text-black flex items-center gap-1"><ArrowLeft className="w-4 h-4" />Voltar</button>
      <div className="mt-3 bg-white border border-zinc-200 rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-zinc-500">Chamado #{t.number} · {t.category}</div>
            <h2 className="font-display text-2xl font-black mt-1">{t.subject}</h2>
            <div className="text-xs text-zinc-500 mt-1">Aberto em {fmt(t.created_at)} · Atualizado {fmtDT(t.updated_at)}</div>
          </div>
          <Badge className={`${STATUS_STYLE[t.status]} rounded-md`} data-testid={`ticket-status-${t.status}`}>{STATUS_LABEL[t.status]}</Badge>
        </div>
        <div className="mt-6 space-y-3">
          {data.messages.map((m) => {
            const mine = m.sender_id === user?.id && m.sender_type === "USER";
            const isAdmin = m.sender_type === "ADMIN";
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-xl p-3 text-sm ${isAdmin ? "brand-bg text-white" : mine ? "bg-black text-white" : "bg-zinc-100 text-black"}`}>
                  <div className={`text-xs font-bold uppercase tracking-widest opacity-80 mb-1`}>
                    {isAdmin ? "Suporte OrçaNext" : m.sender_name || "Você"}
                  </div>
                  <div className="whitespace-pre-wrap leading-snug">{m.message}</div>
                  <div className="mt-1 text-[10px] opacity-70">{fmtDT(m.created_at)}</div>
                </div>
              </div>
            );
          })}
        </div>
        {canReply ? (
          <form onSubmit={send} className="mt-6 border-t border-zinc-200 pt-4">
            <Textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} placeholder="Digite sua mensagem…" data-testid="ticket-reply-input" />
            <div className="mt-2 flex justify-end">
              <Button type="submit" disabled={sending || !reply.trim()} className="brand-bg hover:bg-[#008a02] text-white font-bold" data-testid="ticket-reply-send">
                <Send className="w-4 h-4 mr-1" /> ENVIAR
              </Button>
            </div>
          </form>
        ) : (
          <div className="mt-6 text-xs text-zinc-500 border-t border-zinc-200 pt-4">
            Chamado {t.status === "FECHADO" ? "fechado" : "resolvido"}. Abra um novo chamado se precisar de mais ajuda.
          </div>
        )}
      </div>
    </div>
  );
}

export default function Support() {
  const [tickets, setTickets] = useState([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [cats, setCats] = useState([]);

  const load = async () => {
    const [tk, c] = await Promise.all([api.get("/support/tickets"), api.get("/support/categories")]);
    setTickets(tk.data); setCats(c.data.categories);
  };
  useEffect(() => { load(); }, []);

  if (selected) return <TicketDetail id={selected} onBack={() => { setSelected(null); load(); }} onChanged={load} />;

  return (
    <div data-testid="support-page">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-black flex items-center gap-2"><LifeBuoy className="w-7 h-7 brand-text" /> Central de Suporte</h1>
          <p className="text-zinc-500 text-sm mt-1">Precisa de ajuda? Abra um chamado e nossa equipe irá responder.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="brand-bg hover:bg-[#008a02] text-white font-bold" data-testid="new-ticket-btn">
          <Plus className="w-4 h-4 mr-1" /> NOVO CHAMADO
        </Button>
      </div>

      <div className="mt-6 bg-white border border-zinc-200 rounded-2xl overflow-x-auto">
        {tickets.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 text-sm">Nenhum chamado ainda. Clique em <b>+ Novo chamado</b> para começar.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-widest text-zinc-500">
              <tr><th className="px-4 py-3">Nº</th><th className="px-4 py-3">Assunto</th><th className="px-4 py-3">Categoria</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Criado</th><th className="px-4 py-3">Atualizado</th></tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} onClick={() => setSelected(t.id)} className="border-t border-zinc-100 hover:bg-zinc-50 cursor-pointer" data-testid={`ticket-row-${t.number}`}>
                  <td className="px-4 py-3 font-semibold">#{t.number}</td>
                  <td className="px-4 py-3">{t.subject}</td>
                  <td className="px-4 py-3 text-zinc-500">{t.category}</td>
                  <td className="px-4 py-3"><Badge className={`${STATUS_STYLE[t.status]} rounded-md`}>{STATUS_LABEL[t.status]}</Badge></td>
                  <td className="px-4 py-3 text-zinc-500">{fmt(t.created_at)}</td>
                  <td className="px-4 py-3 text-zinc-500">{fmtDT(t.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <NewTicketDialog open={open} onOpenChange={setOpen} categories={cats} onCreated={(t) => { load(); setSelected(t.id); }} />
    </div>
  );
}
