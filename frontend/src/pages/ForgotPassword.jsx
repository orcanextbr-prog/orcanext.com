import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { formatApiError } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:flex bg-black text-white p-12 flex-col justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="OrçaNext" className="w-8 h-8" />
          <span className="text-xl font-display font-extrabold">OrçaNext</span>
        </Link>
        <h2 className="font-display font-black text-5xl leading-none tracking-tighter text-white">Esqueceu<br /><span className="brand-text">a senha?</span></h2>
        <div className="text-sm text-zinc-500">© {new Date().getFullYear()} OrçaNext</div>
      </div>
      <div className="flex items-center justify-center p-8">
        {sent ? (
          <div className="max-w-sm text-center" data-testid="forgot-sent">
            <div className="w-14 h-14 rounded-full brand-bg text-white flex items-center justify-center mx-auto"><Mail className="w-6 h-6" /></div>
            <h1 className="mt-6 font-display text-3xl font-black">Verifique seu e-mail</h1>
            <p className="text-zinc-500 mt-2">Se o e-mail estiver cadastrado, você receberá em instantes um link para redefinir a senha. O link expira em 1 hora.</p>
            <Link to="/login" className="inline-block mt-6 brand-text font-semibold" data-testid="forgot-back-login">Voltar ao login</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="w-full max-w-sm space-y-5" data-testid="forgot-form">
            <div>
              <h1 className="font-display text-3xl font-black">Recuperar senha</h1>
              <p className="text-sm text-zinc-500 mt-1">Informe seu e-mail e enviaremos um link para redefinir sua senha.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" data-testid="forgot-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <Button type="submit" data-testid="forgot-submit" disabled={loading} className="w-full h-11 brand-bg hover:bg-[#008a02] text-white font-bold">
              {loading ? "Enviando…" : "ENVIAR LINK"}
            </Button>
            <div className="text-sm text-center text-zinc-500">
              Lembrou? <Link to="/login" className="brand-text font-semibold">Entrar</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
