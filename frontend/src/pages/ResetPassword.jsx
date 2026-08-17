import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth, formatApiError } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { refresh } = useAuth();
  const token = params.get("token") || "";
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (pw.length < 6) { toast.error("A senha deve ter ao menos 6 caracteres"); return; }
    if (pw !== confirm) { toast.error("As senhas não coincidem"); return; }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, password: pw });
      await refresh();
      toast.success("Senha redefinida! Você já está conectado.");
      nav("/dashboard");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  if (!token) return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <div>
        <h1 className="font-display text-2xl font-black">Link inválido</h1>
        <p className="text-zinc-500 mt-2">Este link não é válido. Solicite um novo em Recuperar senha.</p>
        <Link to="/forgot-password" className="inline-block mt-4 brand-text font-semibold">Solicitar novo link</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:flex brand-bg text-white p-12 flex-col justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="OrçaNext" className="w-8 h-8" />
          <span className="text-xl font-display font-extrabold">OrçaNext</span>
        </Link>
        <h2 className="font-display font-black text-5xl leading-none tracking-tighter">Nova senha,<br />novo começo.</h2>
        <div className="text-sm text-white/70">© {new Date().getFullYear()} OrçaNext</div>
      </div>
      <div className="flex items-center justify-center p-8">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5" data-testid="reset-form">
          <div>
            <h1 className="font-display text-3xl font-black">Redefinir senha</h1>
            <p className="text-sm text-zinc-500 mt-1">Escolha uma nova senha para sua conta.</p>
          </div>
          <div className="space-y-2">
            <Label>Nova senha (mín. 6)</Label>
            <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={6} data-testid="reset-password" />
          </div>
          <div className="space-y-2">
            <Label>Confirmar senha</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} data-testid="reset-confirm" />
          </div>
          <Button type="submit" disabled={loading} className="w-full h-11 brand-bg hover:bg-[#008a02] text-white font-bold" data-testid="reset-submit">
            {loading ? "Salvando…" : "REDEFINIR SENHA"}
          </Button>
        </form>
      </div>
    </div>
  );
}
