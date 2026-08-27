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
import { Download, CheckCircle2, PenLine, ShieldCheck, Calendar, Clock, CreditCard, User, Building2 } from "lucide-react";

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

const STATUS_STYLE = {
  RASCUNHO: "bg-zinc-100 text-zinc-800",
  ENVIADO: "bg-black text-white",
  VISUALIZADO: "bg-zinc-200 text-black",
  AGUARDANDO_APROVACAO: "bg-amber-100 text-amber-800",
  APROVADO: "brand-bg text-white",
  ASSINADO: "brand-bg text-white",
  RECUSADO: "bg-red-100 text-red-700",
  EXPIRADO: "bg-amber-100 text-amber-800",
  CANCELADO: "bg-zinc-200 text-zinc-500",
};

export default function PublicQuote() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [signOpen, setSignOpen] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [signature, setSignature] = useState("");

  const load = () => api.get(`/public/quote/${token}`).then((r) => setData(r.data)).catch(() => setData(false));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token]);

  if (data === false) return (
    <div className="min-h-screen grid place-items-center bg-zinc-50 px-6">
      <div className="text-center">
        <div className="font-display text-2xl font-black">Orçamento não encontrado</div>
        <p className="text-zinc-500 mt-2 text-sm">O link pode ter expirado ou sido removido.</p>
      </div>
    </div>
  );
  if (!data) return (
    <div className="min-h-screen grid place-items-center bg-zinc-50">
      <div className="w-10 h-10 rounded-full border-4 border-zinc-200 border-t-[#00AD02] animate-spin" />
    </div>
  );

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

  const showPrimaryActions = !expired && !sig;
  const pdfUrl = `${process.env.REACT_APP_BACKEND_URL}/api/public/quote/${token}/pdf`;

  return (
    <div className="min-h-screen bg-zinc-50 pb-32 md:pb-16" data-testid="public-quote">
      {/* Sticky brand bar */}
      <div className="sticky top-0 z-40 bg-white/85 backdrop-blur-xl border-b border-zinc-200">
        <div className="max-w-4xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {company?.logo
              ? <img src={company.logo} alt="logo" className="h-9 w-9 shrink-0 object-contain rounded-md border border-zinc-200 bg-white" />
              : <img src="/logo.png" alt="OrçaNext" className="w-9 h-9 shrink-0" />}
            <div className="min-w-0">
              <div className="font-display font-black truncate text-sm md:text-base">{company?.name || "OrçaNext"}</div>
              <div className="text-[10px] md:text-xs text-zinc-500 truncate">Orçamento Nº {quote.number}</div>
            </div>
          </div>
          <Badge className={`rounded-md shrink-0 text-[10px] md:text-xs ${STATUS_STYLE[quote.status] || "bg-black text-white"}`} data-testid="public-status">
            {quote.status.replace(/_/g, " ")}
          </Badge>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-6 pt-6 md:pt-10">
        {/* Hero card */}
        <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-[0_20px_60px_-30px_rgba(0,0,0,0.15)]">
          <div className="p-6 md:p-10 border-b border-zinc-100 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#00AD02]">Orçamento</div>
              <h1 className="mt-2 font-display text-3xl md:text-5xl font-black tracking-tighter leading-none" data-testid="public-number">
                Nº {quote.number}
              </h1>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1.5 text-xs md:text-sm text-zinc-500">
                <span className="inline-flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Emissão: <b className="text-black ml-1">{quote.date || "—"}</b></span>
                <span className="inline-flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Validade: <b className="text-black ml-1">{quote.expiration_date || "—"}</b></span>
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-200 pl-4 md:pl-5 pr-4 md:pr-6 py-3 md:py-4 flex items-center gap-3 md:gap-4 min-w-0" style={{ borderLeftWidth: 3, borderLeftColor: "#00AD02" }}>
              <div className="min-w-0">
                <div className="text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-zinc-500">Total</div>
                <div className="font-display text-2xl md:text-4xl font-black brand-text tabular-nums leading-none mt-1" data-testid="public-total">
                  {money(quote.total)}
                </div>
              </div>
            </div>
          </div>

          {/* Parties */}
          <div className="grid md:grid-cols-2 gap-0 md:gap-px bg-zinc-100">
            <div className="p-5 md:p-6 bg-white">
              <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 inline-flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> De
              </div>
              <div className="mt-2 font-bold">{company?.name || "—"}</div>
              {company?.document && <div className="text-sm text-zinc-600 mt-0.5">CNPJ/CPF: {company.document}</div>}
              {company?.email && <div className="text-sm text-zinc-500 mt-0.5">{company.email}</div>}
              {company?.phone && <div className="text-sm text-zinc-500">{company.phone}</div>}
              {company?.address && <div className="text-sm text-zinc-500 mt-1">{company.address}</div>}
            </div>
            <div className="p-5 md:p-6 bg-white">
              <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 inline-flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Para
              </div>
              <div className="mt-2 font-bold">{client?.name || "—"}</div>
              {client?.document && <div className="text-sm text-zinc-600 mt-0.5">CPF/CNPJ: {client.document}</div>}
              {client?.email && <div className="text-sm text-zinc-500 mt-0.5">{client.email}</div>}
              {client?.phone && <div className="text-sm text-zinc-500">{client.phone}</div>}
              {client?.address && <div className="text-sm text-zinc-500 mt-1">{client.address}</div>}
            </div>
          </div>

          {/* Items */}
          <div className="p-5 md:p-8">
            <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-3">Itens</div>

            {/* Desktop table */}
            <div className="hidden md:block rounded-xl border border-zinc-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-black text-white text-[10px] uppercase tracking-widest">
                  <tr>
                    <th className="text-left px-4 py-3 w-10">#</th>
                    <th className="text-left px-4 py-3">Descrição</th>
                    <th className="text-right px-4 py-3">Qtd</th>
                    <th className="text-center px-4 py-3">Un.</th>
                    <th className="text-right px-4 py-3">Vlr. unit.</th>
                    <th className="text-right px-4 py-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.items?.map((it, i) => (
                    <tr key={i} className="border-t border-zinc-100">
                      <td className="px-4 py-3 text-zinc-400 font-bold text-xs">{String(i + 1).padStart(2, "0")}</td>
                      <td className="px-4 py-3">{it.description}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{it.quantity}</td>
                      <td className="px-4 py-3 text-center text-zinc-500">{it.unit || "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{money(it.unit_price)}</td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums">{money(it.quantity * it.unit_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2.5">
              {quote.items?.map((it, i) => (
                <div key={i} className="rounded-xl border border-zinc-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[10px] text-zinc-400 font-bold">Item {String(i + 1).padStart(2, "0")}</div>
                      <div className="font-semibold mt-0.5 break-words">{it.description}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold tabular-nums">{money(it.quantity * it.unit_price)}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 tabular-nums">
                    <span>Qtd: <b className="text-black">{it.quantity}{it.unit ? ` ${it.unit}` : ""}</b></span>
                    <span>Un.: <b className="text-black">{money(it.unit_price)}</b></span>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="mt-6 flex justify-end">
              <div className="w-full md:w-80 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-zinc-500">Subtotal</span><span className="font-semibold tabular-nums">{money(quote.subtotal)}</span></div>
                {Number(quote.discount_value || 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Desconto{quote.discount_type === "percent" ? " (%)" : ""}</span>
                    <span className="font-semibold text-red-600 tabular-nums">- {money(quote.discount_value)}</span>
                  </div>
                )}
                <div className="mt-2 rounded-xl border border-zinc-200 px-4 py-3 flex items-center justify-between" style={{ borderLeftWidth: 3, borderLeftColor: "#00AD02" }}>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Total</span>
                  <span className="font-display text-xl md:text-2xl font-black brand-text tabular-nums">{money(quote.total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Conditions */}
          {(quote.payment_method || quote.delivery_deadline || quote.notes || quote.terms) && (
            <div className="border-t border-zinc-100 p-5 md:p-8 space-y-4">
              {(quote.payment_method || quote.delivery_deadline) && (
                <div className="grid md:grid-cols-2 gap-3 md:gap-4">
                  {quote.payment_method && (
                    <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-4">
                      <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 inline-flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5" /> Forma de pagamento
                      </div>
                      <div className="mt-1 font-bold">{quote.payment_method}</div>
                    </div>
                  )}
                  {quote.delivery_deadline && (
                    <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-4">
                      <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 inline-flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" /> Prazo
                      </div>
                      <div className="mt-1 font-bold">{quote.delivery_deadline}</div>
                    </div>
                  )}
                </div>
              )}
              {quote.notes && (
                <div className="rounded-xl border border-zinc-200 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Observações</div>
                  <div className="mt-1.5 text-sm whitespace-pre-wrap">{quote.notes}</div>
                </div>
              )}
              {quote.terms && (
                <div className="rounded-xl border border-zinc-200 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Termos e condições</div>
                  <div className="mt-1.5 text-sm text-zinc-600 whitespace-pre-wrap">{quote.terms}</div>
                </div>
              )}
            </div>
          )}

          {/* Signature evidence */}
          {sig && (
            <div className="border-t border-zinc-100 p-5 md:p-8">
              <div className="rounded-xl border border-[#00AD02]/40 bg-[#00AD02]/5 p-5">
                <div className="flex items-center gap-2 font-bold brand-text">
                  <ShieldCheck className="w-4 h-4" /> ACEITE ELETRÔNICO REGISTRADO
                </div>
                <div className="mt-2 grid md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Assinado por</div>
                    <div className="mt-1 font-bold">{sig.signer_name}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">Em {sig.signed_at}</div>
                  </div>
                  {sig.signature_data && (
                    <img src={sig.signature_data} alt="assinatura" className="h-20 w-full max-w-xs object-contain bg-white border border-zinc-200 rounded justify-self-end" />
                  )}
                </div>
              </div>
            </div>
          )}

          {expired && (
            <div className="border-t border-zinc-100 p-5 md:p-8">
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-800 font-semibold">
                Este orçamento expirou.
              </div>
            </div>
          )}
        </div>

        {/* Desktop actions */}
        <div className="mt-6 hidden md:flex flex-wrap gap-3 justify-end">
          <a href={pdfUrl} target="_blank" rel="noreferrer">
            <Button variant="outline" className="rounded-xl border-black font-bold h-11 px-5" data-testid="public-download-pdf">
              <Download className="w-4 h-4 mr-2" />BAIXAR PDF
            </Button>
          </a>
          {showPrimaryActions && quote.status !== "APROVADO" && (
            <Button variant="outline" onClick={approve} className="rounded-xl border-black font-bold h-11 px-5" data-testid="public-approve">
              <CheckCircle2 className="w-4 h-4 mr-2" />APROVAR ORÇAMENTO
            </Button>
          )}
          {showPrimaryActions && (
            <Button onClick={() => setSignOpen(true)} className="brand-bg hover:bg-[#008a02] text-white font-bold rounded-xl h-11 px-5" data-testid="public-sign-open">
              <PenLine className="w-4 h-4 mr-2" />ASSINAR
            </Button>
          )}
        </div>

        {watermark && (
          <div className="text-center text-xs text-zinc-400 mt-8">
            Criado com <b className="brand-text">OrçaNext</b>
          </div>
        )}
      </div>

      {/* Mobile floating action bar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-xl border-t border-zinc-200 px-4 py-3 flex gap-2 shadow-[0_-8px_30px_-15px_rgba(0,0,0,0.15)]">
        <a href={pdfUrl} target="_blank" rel="noreferrer" className={showPrimaryActions ? "" : "flex-1"}>
          <Button variant="outline" className="rounded-xl border-black font-bold h-11" data-testid="public-download-pdf-mobile">
            <Download className="w-4 h-4" />
          </Button>
        </a>
        {showPrimaryActions && quote.status !== "APROVADO" && (
          <Button variant="outline" onClick={approve} className="flex-1 rounded-xl border-black font-bold h-11 text-xs" data-testid="public-approve-mobile">
            APROVAR
          </Button>
        )}
        {showPrimaryActions && (
          <Button onClick={() => setSignOpen(true)} className="flex-1 brand-bg hover:bg-[#008a02] text-white font-bold rounded-xl h-11 text-xs" data-testid="public-sign-open-mobile">
            <PenLine className="w-4 h-4 mr-1.5" />ASSINAR
          </Button>
        )}
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
