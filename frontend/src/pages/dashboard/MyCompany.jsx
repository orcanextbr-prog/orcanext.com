import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth, formatApiError } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function MyCompany() {
  const { refresh } = useAuth();
  const [form, setForm] = useState(null);

  useEffect(() => { api.get("/company").then((r) => setForm(r.data || {})); }, []);

  if (!form) return <div className="text-zinc-400">Carregando…</div>;

  const setF = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const onLogo = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > 500 * 1024) { toast.error("Logo até 500KB"); return; }
    const r = new FileReader(); r.onload = () => setForm({ ...form, logo: r.result }); r.readAsDataURL(f);
  };
  const save = async () => {
    try { await api.post("/company", form); await refresh(); toast.success("Empresa atualizada"); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  return (
    <div>
      <h1 className="font-display text-3xl font-black">Minha Empresa</h1>
      <p className="text-zinc-500 text-sm mt-1">Esses dados aparecem em todos os orçamentos.</p>
      <div className="mt-6 bg-white border border-zinc-200 rounded-2xl p-6 grid md:grid-cols-2 gap-4">
        <div className="space-y-2 md:col-span-2"><Label>Nome</Label><Input value={form.name || ""} onChange={setF("name")} data-testid="company-name" /></div>
        <div className="space-y-2"><Label>Razão social</Label><Input value={form.legal_name || ""} onChange={setF("legal_name")} /></div>
        <div className="space-y-2"><Label>CPF/CNPJ</Label><Input value={form.document || ""} onChange={setF("document")} /></div>
        <div className="space-y-2"><Label>E-mail</Label><Input value={form.email || ""} onChange={setF("email")} /></div>
        <div className="space-y-2"><Label>Telefone</Label><Input value={form.phone || ""} onChange={setF("phone")} /></div>
        <div className="space-y-2 md:col-span-2"><Label>Endereço</Label><Textarea rows={2} value={form.address || ""} onChange={setF("address")} /></div>
        <div className="space-y-2"><Label>Cidade</Label><Input value={form.city || ""} onChange={setF("city")} /></div>
        <div className="space-y-2"><Label>UF</Label><Input maxLength={2} value={form.state || ""} onChange={setF("state")} /></div>
        <div className="space-y-2 md:col-span-2"><Label>Logo</Label><Input type="file" accept="image/*" onChange={onLogo} />{form.logo && <img src={form.logo} alt="logo" className="mt-2 h-20 border rounded-md p-1" />}</div>
        <div className="md:col-span-2 flex justify-end"><Button onClick={save} className="brand-bg hover:bg-[#008a02] text-white font-bold" data-testid="company-save">Salvar</Button></div>
      </div>
    </div>
  );
}
