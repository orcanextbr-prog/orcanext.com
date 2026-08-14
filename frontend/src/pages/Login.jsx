import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, formatApiError } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { user } = await login(email, password);
      toast.success("Bem-vindo(a) de volta!");
      nav(user.role === "admin" ? "/admin" : "/dashboard");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Falha no login");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:flex bg-black text-white p-12 flex-col justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-md brand-bg flex items-center justify-center font-black">O</span>
          <span className="text-xl font-display font-extrabold">OrçaNext</span>
        </Link>
        <div>
          <div className="text-xs uppercase tracking-widest text-zinc-400 mb-3">Do orçamento ao fechamento</div>
          <h2 className="font-display font-black text-5xl leading-none tracking-tighter">Crie. Envie.<br /><span className="brand-text">Aprove. Receba.</span></h2>
        </div>
        <div className="text-sm text-zinc-500">© {new Date().getFullYear()} OrçaNext</div>
      </div>
      <div className="flex items-center justify-center p-8">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5" data-testid="login-form">
          <div>
            <h1 className="font-display text-3xl font-black">Entrar</h1>
            <p className="text-sm text-zinc-500 mt-1">Acesse sua conta OrçaNext</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" data-testid="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" data-testid="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <Button type="submit" data-testid="login-submit" disabled={loading} className="w-full h-11 brand-bg hover:bg-[#008a02] text-white font-bold">
            {loading ? "Entrando…" : "ENTRAR"}
          </Button>
          <div className="text-sm text-center">
            <Link to="/forgot-password" className="text-zinc-500 hover:text-black" data-testid="login-forgot-link">Esqueci minha senha</Link>
          </div>
          <div className="text-sm text-center text-zinc-500">
            Não tem conta? <Link to="/register" className="brand-text font-semibold" data-testid="login-to-register">Cadastre-se</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
