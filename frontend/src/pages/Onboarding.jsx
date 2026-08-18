import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, formatApiError } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function Onboarding() {
  const { refresh } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({
    name: "", legal_name: "", document: "", email: "", phone: "",
    address: "", city: "", state: "", zip: "", logo: "",
  });
  const [loading, setLoading] = useState(false);

  const setF = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleLogo = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 500 * 1024) { toast.error("Logo até 500KB"); return; }
    const r = new FileReader();
    r.onload = () => setForm({ ...form, logo: r.result });
    r.readAsDataURL(f);
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/company", form);
      await refresh();
      toast.success("Empresa configurada!");
      nav("/dashboard");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-zinc-50 py-10">
      <div className="max-w-2xl mx-auto px-6">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Onboarding</div>
        <h1 className="font-display text-4xl font-black tracking-tight mt-2">Vamos configurar sua empresa.</h1>
        <p className="mt-2 text-zinc-500">Esses dados aparecerão nos orçamentos enviados aos seus clientes.</p>

        <form onSubmit={submit} className="mt-8 bg-white border border-zinc-200 rounded-2xl p-6 space-y-5" data-testid="onboarding-form">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Nome da empresa *</Label>
              <Input required value={form.name} onChange={setF("name")} data-testid="onb-name" />
            </div>
            <div className="space-y-2">
              <Label>Razão social</Label>
              <Input value={form.legal_name} onChange={setF("legal_name")} />
            </div>
            <div className="space-y-2">
              <Label>CPF / CNPJ</Label>
              <Input value={form.document} onChange={setF("document")} data-testid="onb-document" />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={setF("email")} />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={setF("phone")} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Endereço completo</Label>
              <Textarea rows={2} value={form.address} onChange={setF("address")} />
            </div>
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input value={form.city} onChange={setF("city")} />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Input maxLength={2} value={form.state} onChange={setF("state")} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Logo (PNG/JPG até 500KB)</Label>
              <Input type="file" accept="image/*" onChange={handleLogo} data-testid="onb-logo" />
              {form.logo && <img src={form.logo} alt="logo" className="mt-2 h-16 border rounded-md p-1" />}
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={loading} className="brand-bg hover:bg-[#008a02] text-white font-bold h-11 px-8" data-testid="onb-submit">
              {loading ? "Salvando…" : "SALVAR E CONTINUAR"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
