import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, money } from "@/lib/api";
import { useAuth, formatApiError } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Download, Lock } from "lucide-react";

export default function Receipts() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [clients, setClients] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ client_id: "", amount: 0, description: "", payment_method: "PIX", payment_date: new Date().toISOString().slice(0, 10), notes: "" });

  const isPro = user?.plan === "PROFESSIONAL";

  useEffect(() => {
    if (!isPro) return;
    api.get("/receipts").then((r) => setItems(r.data)).catch(() => {});
    api.get("/clients").then((r) => setClients(r.data));
  }, [isPro]);

  const save = async () => {
    try {
      await api.post("/receipts", { ...form, amount: Number(form.amount || 0) });
      toast.success("Recibo emitido"); setOpen(false);
      const r = await api.get("/receipts"); setItems(r.data);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  if (!isPro) return (
    <div>
      <h1 className="font-display text-3xl font-black">Recibos</h1>
      <div className="mt-6 bg-white border border-zinc-200 rounded-2xl p-10 text-center">
        <Lock className="w-10 h-10 mx-auto text-zinc-400" />
        <div className="mt-4 font-display text-2xl font-black">Recurso exclusivo do Profissional</div>
        <p className="mt-2 text-zinc-500">Recibos ilimitados em PDF com um clique.</p>
        <Link to="/dashboard/plan"><Button className="mt-6 brand-bg hover:bg-[#008a02] text-white font-bold" data-testid="receipts-upgrade">ASSINAR PROFISSIONAL</Button></Link>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex justify-between items-center">
        <div><h1 className="font-display text-3xl font-black">Recibos</h1><p className="text-zinc-500 text-sm mt-1">Registre pagamentos recebidos.</p></div>
        <Button onClick={() => setOpen(true)} className="brand-bg hover:bg-[#008a02] text-white font-bold" data-testid="new-receipt-btn"><Plus className="w-4 h-4 mr-2" />NOVO RECIBO</Button>
      </div>
      <div className="mt-6 bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-widest text-zinc-500">
            <tr><th className="px-4 py-3">Nº</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Valor</th><th className="px-4 py-3">Método</th><th className="px-4 py-3">Data</th><th className="px-4 py-3 text-right">PDF</th></tr>
          </thead>
          <tbody>
            {items.length === 0 ? <tr><td colSpan={6} className="p-10 text-center text-zinc-400">Nenhum recibo ainda.</td></tr>
              : items.map((r) => (
                <tr key={r.id} className="border-t border-zinc-100">
                  <td className="px-4 py-3 font-semibold">{r.number}</td>
                  <td className="px-4 py-3">{clients.find((c) => c.id === r.client_id)?.name || "—"}</td>
                  <td className="px-4 py-3 font-semibold">{money(r.amount)}</td>
                  <td className="px-4 py-3 text-zinc-500">{r.payment_method}</td>
                  <td className="px-4 py-3 text-zinc-500">{r.payment_date}</td>
                  <td className="px-4 py-3 text-right"><Button variant="ghost" size="icon" onClick={() => window.open(`${process.env.REACT_APP_BACKEND_URL}/api/receipts/${r.id}/pdf`, "_blank")}><Download className="w-4 h-4" /></Button></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Novo recibo</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2 col-span-2"><Label>Cliente *</Label>
              <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                <SelectTrigger data-testid="receipt-client"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Valor *</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} data-testid="receipt-amount" /></div>
            <div className="space-y-2"><Label>Método</Label>
              <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["PIX", "Dinheiro", "Cartão", "Transferência", "Outro"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2"><Label>Referente a</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="space-y-2 col-span-2"><Label>Data</Label><Input type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} /></div>
            <div className="space-y-2 col-span-2"><Label>Observações</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={save} className="brand-bg hover:bg-[#008a02] text-white font-bold" data-testid="receipt-save">Emitir recibo</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
