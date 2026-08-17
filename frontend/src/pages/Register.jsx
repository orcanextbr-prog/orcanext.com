import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, formatApiError } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      toast.success("Conta criada! Vamos configurar sua empresa.");
      nav("/onboarding");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Falha ao cadastrar");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:flex brand-bg text-white p-12 flex-col justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-md bg-black flex items-center justify-center font-black">O</span>
          <span className="text-xl font-display font-extrabold">OrçaNext</span>
        </Link>
        <div>
          <h2 className="font-display font-black text-5xl leading-none tracking-tighter">15 orçamentos<br />grátis por mês.</h2>
          <p className="mt-4 text-white/90">Comece gratuitamente. Sem cartão. Sem enrolação.</p>
        </div>
        <div className="text-sm text-white/70">© {new Date().getFullYear()} OrçaNext</div>
      </div>
      <div className="flex items-center justify-center p-8">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5" data-testid="register-form">
          <div>
            <h1 className="font-display text-3xl font-black">Criar conta grátis</h1>
            <p className="text-sm text-zinc-500 mt-1">Leva menos de um minuto.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" data-testid="register-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" data-testid="register-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha (mín. 6)</Label>
            <Input id="password" data-testid="register-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
          </div>
          <Button type="submit" data-testid="register-submit" disabled={loading} className="w-full h-11 brand-bg hover:bg-[#008a02] text-white font-bold">
            {loading ? "Criando…" : "COMEÇAR GRÁTIS"}
          </Button>
          <div className="text-sm text-center text-zinc-500">
            Já tem conta? <Link to="/login" className="brand-text font-semibold" data-testid="register-to-login">Entrar</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
