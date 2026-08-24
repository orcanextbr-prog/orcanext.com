import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function AuthCallback() {
  const location = useLocation();
  const nav = useNavigate();
  const { refresh, setUser } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Idempotent guard: React StrictMode / re-mounts must not exchange twice.
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = location.hash || "";
    const match = hash.match(/session_id=([^&]+)/);
    const session_id = match ? decodeURIComponent(match[1]) : null;
    if (!session_id) {
      nav("/login", { replace: true });
      return;
    }

    (async () => {
      try {
        const { data } = await api.post("/auth/session", { session_id });
        // Clear the hash from the URL so a refresh doesn't retry the exchange.
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
        setUser(data.user);
        await refresh();
        toast.success(`Bem-vindo(a), ${data.user.name || data.user.email}!`);
        const dest = data.user.role === "super_admin" || data.user.role === "admin" ? "/admin" : "/dashboard";
        nav(dest, { replace: true });
      } catch (e) {
        console.error("OAuth callback failed", e);
        toast.error("Não foi possível concluir o login com o Google. Tente novamente.");
        nav("/login", { replace: true });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen grid place-items-center bg-white" data-testid="auth-callback">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-4 border-zinc-200 border-t-[#00AD02] animate-spin" />
        <p className="text-sm text-zinc-500">Concluindo login…</p>
      </div>
    </div>
  );
}
