import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, formatApiError } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
function googleSignIn() {
  const redirectUrl = window.location.origin + "/dashboard";
  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
}

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
          <img src="/logo.png" alt="OrçaNext" className="w-8 h-8" />
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

          <button
            type="button"
            onClick={googleSignIn}
            data-testid="register-google"
            className="w-full h-11 rounded-md border border-zinc-300 bg-white hover:bg-zinc-50 flex items-center justify-center gap-2 text-sm font-semibold text-black transition"
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Cadastrar com Google
          </button>

          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-200" /></div>
            <div className="relative flex justify-center"><span className="bg-white px-3 text-[11px] uppercase tracking-widest text-zinc-400 font-bold">ou por e-mail</span></div>
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
