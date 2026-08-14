import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatApiError } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

const EMPTY = { type: "PF", name: "", document: "", email: "", phone: "", address: "", city: "", state: "", notes: "" };

export default function Clients() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const load = () => api.get("/clients", { params: { q } }).then((r) => setItems(r.data));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q]);

  const openNew = () => { setForm(EMPTY); setOpen(true); };
  const openEdit = (c) => { setForm({ ...EMPTY, ...c }); setOpen(true); };
  const save = async () => {
    try {
      if (form.id) await api.put(`/clients/${form.id}`, form); else await api.post("/clients", form);
      toast.success("Cliente salvo"); setOpen(false); load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };
  const remove = async (c) => {
    if (!window.confirm(`Excluir ${c.name}?`)) return;
    await api.delete(`/clients/${c.id}`); load();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-black">Clientes</h1>
          <p className="text-zinc-500 text-sm mt-1">Cadastre e gerencie seus clientes.</p>
        </div>
        <Button onClick={openNew} className="brand-bg hover:bg-[#008a02] text-white font-bold" data-testid="new-client-btn"><Plus className="w-4 h-4 mr-2" />NOVO CLIENTE</Button>
      </div>
      <Input placeholder="Pesquisar cliente…" value={q} onChange={(e) => setQ(e.target.value)} className="mt-6 max-w-sm" data-testid="clients-search" />
      <div className="mt-4 bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-widest text-zinc-500">
            <tr><th className="px-4 py-3">Nome</th><th className="px-4 py-3">Documento</th><th className="px-4 py-3">E-mail</th><th className="px-4 py-3">Telefone</th><th className="px-4 py-3 text-right">Ações</th></tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={5} className="p-10 text-center text-zinc-400">Nenhum cliente ainda.</td></tr>
            ) : items.map((c) => (
              <tr key={c.id} className="border-t border-zinc-100">
                <td className="px-4 py-3 font-semibold">{c.name}</td>
                <td className="px-4 py-3 text-zinc-500">{c.document || "—"}</td>
                <td className="px-4 py-3 text-zinc-500">{c.email || "—"}</td>
                <td className="px-4 py-3 text-zinc-500">{c.phone || "—"}</td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(c)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-display">{form.id ? "Editar cliente" : "Novo cliente"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Tipo</Label><Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PF">Pessoa Física</SelectItem><SelectItem value="PJ">Pessoa Jurídica</SelectItem></SelectContent></Select></div>
            <div className="space-y-2 col-span-2"><Label>Nome / Razão social *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="client-name" /></div>
            <div className="space-y-2"><Label>CPF/CNPJ</Label><Input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} /></div>
            <div className="space-y-2"><Label>Telefone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="space-y-2 col-span-2"><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-2 col-span-2"><Label>Endereço</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div className="space-y-2"><Label>Cidade</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div className="space-y-2"><Label>UF</Label><Input maxLength={2} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
            <div className="space-y-2 col-span-2"><Label>Observações</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={save} className="brand-bg hover:bg-[#008a02] text-white font-bold" data-testid="client-save">Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
