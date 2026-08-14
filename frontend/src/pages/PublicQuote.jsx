import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api, money } from "@/lib/api";
import { formatApiError } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Download, CheckCircle2, PenLine } from "lucide-react";

function SignaturePad({ onChange }) {
  const ref = useRef(null); const [drawing, setDrawing] = useState(false);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    c.width = c.offsetWidth * 2; c.height = c.offsetHeight * 2;
    const ctx = c.getContext("2d"); ctx.scale(2, 2); ctx.strokeStyle = "#000"; ctx.lineWidth = 2; ctx.lineCap = "round";
  }, []);
  const pos = (e) => { const r = ref.current.getBoundingClientRect(); const t = e.touches?.[0]; return { x: (t?.clientX ?? e.clientX) - r.left, y: (t?.clientY ?? e.clientY) - r.top }; };
  const start = (e) => { e.preventDefault(); const p = pos(e); const ctx = ref.current.getContext("2d"); ctx.beginPath(); ctx.moveTo(p.x, p.y); setDrawing(true); };
  const draw = (e) => { if (!drawing) return; e.preventDefault(); const p = pos(e); const ctx = ref.current.getContext("2d"); ctx.lineTo(p.x, p.y); ctx.stroke(); onChange(ref.current.toDataURL("image/png")); };
  const end = () => { setDrawing(false); onChange(ref.current.toDataURL("image/png")); };
  const clear = () => { const c = ref.current; const ctx = c.getContext("2d"); ctx.clearRect(0, 0, c.width, c.height); onChange(""); };
  return (
    <div>
      <canvas ref={ref} className="w-full h-40 bg-white border-2 border-dashed border-zinc-300 rounded-md touch-none"
              onMouseDown={start} onMouseMove={draw} onMouseUp={end} onMouseLeave={end}
              onTouchStart={start} onTouchMove={draw} onTouchEnd={end} data-testid="signature-canvas" />
      <button type="button" className="text-xs text-zinc-500 mt-1" onClick={clear}>Limpar</button>
    </div>
  );
}

export default function PublicQuote() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [signOpen, setSignOpen] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [signature, setSignature] = useState("");

  const load = () => api.get(`/public/quote/${token}`).then((r) => setData(r.data)).catch(() => setData(false));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token]);

  if (data === false) return <div className="min-h-screen flex items-center justify-center text-zinc-500">Orçamento não encontrado.</div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center text-zinc-400">Carregando…</div>;

  const { quote, company, client, signature: sig, watermark } = data;
  const expired = quote.status === "EXPIRADO";
  const done = quote.status === "APROVADO" || quote.status === "ASSINADO";

  const approve = async () => {
    try { await api.post(`/public/quote/${token}/approve`); toast.success("Orçamento aprovado"); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };
  const sign = async () => {
    if (!signerName || !signature) { toast.error("Preencha seu nome e assine."); return; }
    try { await api.post(`/public/quote/${token}/sign`, { signer_name: signerName, signature_data: signature }); toast.success("Aceite registrado com sucesso"); setSignOpen(false); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  return (
    <div className="min-h-screen bg-zinc-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* top brand bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {company?.logo ? <img src={company.logo} alt="logo" className="h-10 w-10 object-contain rounded-md border border-zinc-200 bg-white" />
              : <span className="w-10 h-10 rounded-md brand-bg text-white flex items-center justify-center font-black">O</span>}
            <div>
              <div className="font-display font-extrabold">{company?.name || "OrçaNext"}</div>
              <div className="text-xs text-zinc-500">{company?.document || ""}</div>
            </div>
          </div>
          <Badge className={done ? "brand-bg text-white rounded-md" : "bg-black text-white rounded-md"}>{quote.status}</Badge>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-6 md:p-10">
          <div className="flex justify-between items-start flex-wrap gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Orçamento</div>
              <h1 className="font-display text-3xl md:text-4xl font-black">Nº {quote.number}</h1>
            </div>
            <div className="text-right text-sm text-zinc-500">
              <div>Emissão: <b className="text-black">{quote.date}</b></div>
              <div>Validade: <b className="text-black">{quote.expiration_date || "—"}</b></div>
            </div>
          </div>

          <div className="mt-6 grid md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-zinc-200 p-4">
              <div className="text-xs font-bold uppercase tracking-widest text-zinc-500">De</div>
              <div className="mt-1 font-semibold">{company?.name}</div>
              <div className="text-sm text-zinc-500">{company?.email} {company?.phone && ` · ${company.phone}`}</div>
              <div className="text-sm text-zinc-500">{company?.address}</div>
            </div>
            <div className="rounded-lg border border-zinc-200 p-4">
              <div className="text-xs font-bold uppercase tracking-widest text-zinc-500">Para</div>
              <div className="mt-1 font-semibold">{client?.name || "—"}</div>
              <div className="text-sm text-zinc-500">{client?.email} {client?.phone && ` · ${client.phone}`}</div>
              <div className="text-sm text-zinc-500">{client?.address}</div>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-zinc-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-black text-white text-xs uppercase tracking-widest">
                <tr><th className="text-left px-3 py-2">Item</th><th className="text-right px-3 py-2">Qtd</th><th className="text-right px-3 py-2">Vlr. unit.</th><th className="text-right px-3 py-2">Total</th></tr>
              </thead>
              <tbody>
                {quote.items?.map((it, i) => (
                  <tr key={i} className="border-t border-zinc-100"><td className="px-3 py-2">{it.description}</td><td className="px-3 py-2 text-right">{it.quantity} {it.unit}</td><td className="px-3 py-2 text-right">{money(it.unit_price)}</td><td className="px-3 py-2 text-right font-semibold">{money(it.quantity * it.unit_price)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-end">
            <div className="w-full md:w-64 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-zinc-500">Subtotal</span><span className="font-semibold">{money(quote.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Desconto</span><span className="font-semibold text-red-600">- {money(quote.discount_value)}</span></div>
              <div className="flex justify-between items-baseline border-t border-zinc-200 pt-2 mt-1">
                <span className="text-zinc-500">Total</span>
                <span className="text-3xl font-display font-black brand-text">{money(quote.total)}</span>
              </div>
            </div>
          </div>

          {(quote.payment_method || quote.delivery_deadline || quote.notes || quote.terms) && (
            <div className="mt-6 grid md:grid-cols-2 gap-4 text-sm">
              {quote.payment_method && <div><div className="text-xs font-bold uppercase tracking-widest text-zinc-500">Pagamento</div><div>{quote.payment_method}</div></div>}
              {quote.delivery_deadline && <div><div className="text-xs font-bold uppercase tracking-widest text-zinc-500">Prazo</div><div>{quote.delivery_deadline}</div></div>}
              {quote.notes && <div className="md:col-span-2"><div className="text-xs font-bold uppercase tracking-widest text-zinc-500">Observações</div><div className="whitespace-pre-wrap">{quote.notes}</div></div>}
              {quote.terms && <div className="md:col-span-2"><div className="text-xs font-bold uppercase tracking-widest text-zinc-500">Termos</div><div className="whitespace-pre-wrap">{quote.terms}</div></div>}
            </div>
          )}

          {sig && (
            <div className="mt-6 rounded-lg border border-[#00AD02]/40 bg-[#00AD02]/5 p-4">
              <div className="flex items-center gap-2 font-semibold brand-text"><CheckCircle2 className="w-4 h-4" /> ACEITE ELETRÔNICO REGISTRADO</div>
              <div className="text-sm text-zinc-600 mt-2">Assinado por <b>{sig.signer_name}</b> em {sig.signed_at}</div>
              {sig.signature_data && <img src={sig.signature_data} alt="assinatura" className="mt-2 h-20 bg-white border border-zinc-200 rounded" />}
            </div>
          )}

          {expired && (
            <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-800 font-semibold">Este orçamento expirou.</div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-3 justify-end">
          <Button variant="outline" onClick={() => window.open(`${process.env.REACT_APP_BACKEND_URL}/api/public/quote/${token}/pdf`, "_blank")} data-testid="public-download-pdf"><Download className="w-4 h-4 mr-2" />BAIXAR PDF</Button>
          {!expired && !sig && quote.status !== "APROVADO" && <Button variant="outline" onClick={approve} data-testid="public-approve">APROVAR ORÇAMENTO</Button>}
          {!expired && !sig && <Button onClick={() => setSignOpen(true)} className="brand-bg hover:bg-[#008a02] text-white font-bold" data-testid="public-sign-open"><PenLine className="w-4 h-4 mr-2" />ASSINAR</Button>}
        </div>

        {watermark && <div className="text-center text-xs text-zinc-400 mt-6">Criado com <b className="brand-text">OrçaNext</b></div>}
      </div>

      <Dialog open={signOpen} onOpenChange={setSignOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Aceite eletrônico</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2"><Label>Seu nome completo</Label><Input value={signerName} onChange={(e) => setSignerName(e.target.value)} data-testid="signer-name" /></div>
            <div className="space-y-2"><Label>Assine no quadro abaixo</Label><SignaturePad onChange={setSignature} /></div>
            <p className="text-xs text-zinc-500">Ao clicar em CONFIRMAR, você registra seu aceite eletrônico deste orçamento (não é assinatura digital ICP-Brasil).</p>
          </div>
          <DialogFooter><Button onClick={sign} className="brand-bg hover:bg-[#008a02] text-white font-bold" data-testid="signer-confirm">CONFIRMAR ACEITE</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
