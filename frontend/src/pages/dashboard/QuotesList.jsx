import { useEffect, useState } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { api, money } from "@/lib/api";
import { formatApiError } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Copy, Download, FileText, Trash2, MoreHorizontal, ExternalLink, Link2 } from "lucide-react";

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

export default function QuotesList() {
  const nav = useNavigate();
  const { usage, refreshUsage } = useOutletContext();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [blockOpen, setBlockOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const params = {};
    if (q) params.q = q;
    if (status) params.status = status;
    const r = await api.get("/quotes", { params });
    setItems(r.data);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q, status]);

  const publicUrl = (t) => `${window.location.origin}/q/${t}`;
  const copyLink = async (t) => { await navigator.clipboard.writeText(publicUrl(t)); toast.success("Link copiado!"); };
  const downloadPDF = (id) => window.open(`${process.env.REACT_APP_BACKEND_URL}/api/quotes/${id}/pdf`, "_blank");

  const tryCreate = () => {
    if (usage && usage.blocked) { setBlockOpen(true); return; }
    nav("/dashboard/quotes/new");
  };

  const duplicate = async (id) => {
    try {
      await api.post(`/quotes/${id}/duplicate`);
      toast.success("Orçamento duplicado");
      refreshUsage(); load();
    } catch (e) {
      if (e.response?.status === 402) setBlockOpen(true);
      else toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Excluir orçamento? Isso não devolve o crédito do mês.")) return;
    await api.delete(`/quotes/${id}`);
    toast.success("Excluído");
    load();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-black">Orçamentos</h1>
          <p className="text-zinc-500 text-sm mt-1">Gerencie todos os orçamentos da sua empresa.</p>
        </div>
        <Button onClick={tryCreate} className="brand-bg hover:bg-[#008a02] text-white font-bold h-11 px-6" data-testid="new-quote-btn">
          <Plus className="w-4 h-4 mr-2" /> NOVO ORÇAMENTO
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Input placeholder="Pesquisar por número ou cliente…" value={q} onChange={(e) => setQ(e.target.value)}
               className="max-w-sm" data-testid="quotes-search" />
        <Select value={status || "ALL"} onValueChange={(v) => setStatus(v === "ALL" ? "" : v)}>
          <SelectTrigger className="w-48" data-testid="quotes-status-filter"><SelectValue placeholder="Todos os status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            {Object.keys(STATUS_STYLE).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6 bg-white border border-zinc-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-widest text-zinc-500">
            <tr>
              <th className="px-4 py-3">Nº</th><th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Data</th><th className="px-4 py-3">Validade</th>
              <th className="px-4 py-3">Valor</th><th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-zinc-400">Carregando…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-16 text-center">
                <div className="font-semibold">Nenhum orçamento ainda.</div>
                <p className="text-zinc-500 text-sm mt-1">Comece criando seu primeiro orçamento.</p>
                <Button onClick={tryCreate} className="mt-4 brand-bg hover:bg-[#008a02] text-white font-bold">
                  <Plus className="w-4 h-4 mr-2" /> Criar orçamento
                </Button>
              </td></tr>
            ) : items.map((i) => (
              <tr key={i.id} className="border-t border-zinc-100 hover:bg-zinc-50" data-testid={`quote-row-${i.number}`}>
                <td className="px-4 py-3 font-semibold">{i.number}</td>
                <td className="px-4 py-3">{i.client_name || "—"}</td>
                <td className="px-4 py-3 text-zinc-500">{i.date}</td>
                <td className="px-4 py-3 text-zinc-500">{i.expiration_date || "—"}</td>
                <td className="px-4 py-3 font-semibold">{money(i.total)}</td>
                <td className="px-4 py-3"><Badge className={`rounded-md ${STATUS_STYLE[i.status] || "bg-zinc-100"}`}>{i.status}</Badge></td>
                <td className="px-4 py-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid={`quote-actions-${i.number}`}><MoreHorizontal className="w-4 h-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => nav(`/dashboard/quotes/${i.id}`)}><FileText className="w-4 h-4 mr-2" />Ver / editar</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => duplicate(i.id)}><Copy className="w-4 h-4 mr-2" />Duplicar</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => copyLink(i.public_token)}><Link2 className="w-4 h-4 mr-2" />Copiar link</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => window.open(publicUrl(i.public_token), "_blank")}><ExternalLink className="w-4 h-4 mr-2" />Abrir público</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => downloadPDF(i.id)}><Download className="w-4 h-4 mr-2" />Baixar PDF</DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600" onClick={() => remove(i.id)}><Trash2 className="w-4 h-4 mr-2" />Excluir</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <DialogContent data-testid="limit-dialog">
          <DialogHeader><DialogTitle className="font-display text-2xl">Você atingiu o limite de {usage?.limit || 15} orçamentos deste mês.</DialogTitle></DialogHeader>
          <p className="text-zinc-600">Continue criando sem limites com o <b>OrçaNext Profissional</b>. Por <b className="brand-text">R$ 49,90/mês</b> você tem orçamentos ilimitados.</p>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setBlockOpen(false)} data-testid="limit-stay">CONTINUAR NO GRATUITO</Button>
            <Link to="/dashboard/plan"><Button className="brand-bg hover:bg-[#008a02] text-white font-bold" data-testid="limit-upgrade">ASSINAR PROFISSIONAL</Button></Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
