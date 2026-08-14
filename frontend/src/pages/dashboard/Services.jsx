import { useEffect, useState } from "react";
import { api, money } from "@/lib/api";
import { formatApiError } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

const EMPTY = { name: "", description: "", category: "", unit: "un", price: 0 };

export default function Services() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const load = () => api.get("/services", { params: { q } }).then((r) => setItems(r.data));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q]);

  const save = async () => {
    try {
      const p = { ...form, price: Number(form.price || 0) };
      if (form.id) await api.put(`/services/${form.id}`, p); else await api.post("/services", p);
      toast.success("Serviço salvo"); setOpen(false); load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-display text-3xl font-black">Serviços</h1><p className="text-zinc-500 text-sm mt-1">Seu catálogo de serviços.</p></div>
        <Button onClick={() => { setForm(EMPTY); setOpen(true); }} className="brand-bg hover:bg-[#008a02] text-white font-bold" data-testid="new-service-btn"><Plus className="w-4 h-4 mr-2" />NOVO SERVIÇO</Button>
      </div>
      <Input placeholder="Pesquisar serviço por nome…" value={q} onChange={(e) => setQ(e.target.value)} className="mt-6 max-w-sm" data-testid="services-search" />
      <div className="mt-4 bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-widest text-zinc-500">
            <tr><th className="px-4 py-3">Nome</th><th className="px-4 py-3">Categoria</th><th className="px-4 py-3">Un.</th><th className="px-4 py-3">Preço</th><th className="px-4 py-3 text-right">Ações</th></tr>
          </thead>
          <tbody>
            {items.length === 0 ? <tr><td colSpan={5} className="p-10 text-center text-zinc-400">Nenhum serviço ainda.</td></tr>
              : items.map((s) => (
                <tr key={s.id} className="border-t border-zinc-100">
                  <td className="px-4 py-3 font-semibold">{s.name}</td>
                  <td className="px-4 py-3 text-zinc-500">{s.category || "—"}</td>
                  <td className="px-4 py-3 text-zinc-500">{s.unit}</td>
                  <td className="px-4 py-3 font-semibold">{money(s.price)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="icon" onClick={() => { setForm({ ...EMPTY, ...s }); setOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={async () => { if (window.confirm(`Excluir ${s.name}?`)) { await api.delete(`/services/${s.id}`); load(); } }}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">{form.id ? "Editar serviço" : "Novo serviço"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2 col-span-2"><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="service-name" /></div>
            <div className="space-y-2"><Label>Categoria</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
            <div className="space-y-2"><Label>Unidade</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
            <div className="space-y-2 col-span-2"><Label>Preço</Label><Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} data-testid="service-price" /></div>
            <div className="space-y-2 col-span-2"><Label>Descrição</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={save} className="brand-bg hover:bg-[#008a02] text-white font-bold" data-testid="service-save">Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
