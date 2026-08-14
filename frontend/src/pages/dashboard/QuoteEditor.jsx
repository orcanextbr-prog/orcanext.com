import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useOutletContext } from "react-router-dom";
import { api, money } from "@/lib/api";
import { formatApiError } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Search, Save, Send } from "lucide-react";

export default function QuoteEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const { refreshUsage } = useOutletContext();

  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [expiration, setExpiration] = useState("");
  const [items, setItems] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState("value");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [deadline, setDeadline] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [orientation, setOrientation] = useState("vertical");

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTab, setSearchTab] = useState("products");
  const [searchQ, setSearchQ] = useState("");
  const [results, setResults] = useState([]);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickType, setQuickType] = useState("product");
  const [quickData, setQuickData] = useState({ name: "", price: 0, unit: "un", description: "" });

  const [current, setCurrent] = useState(null);

  useEffect(() => { api.get("/clients").then((r) => setClients(r.data)); }, []);

  useEffect(() => {
    if (id && id !== "new") {
      api.get(`/quotes/${id}`).then((r) => {
        const q = r.data;
        setCurrent(q);
        setClientId(q.client_id || "");
        setDate(q.date);
        setExpiration(q.expiration_date || "");
        setItems(q.items || []);
        setDiscount(q.discount || 0);
        setDiscountType(q.discount_type || "value");
        setPaymentMethod(q.payment_method || "");
        setDeadline(q.delivery_deadline || "");
        setNotes(q.notes || "");
        setTerms(q.terms || "");
        setOrientation(q.orientation || "vertical");
      }).catch((e) => toast.error(formatApiError(e.response?.data?.detail)));
    }
  }, [id]);

  useEffect(() => {
    if (!searchOpen) return;
    const url = searchTab === "products" ? "/products" : "/services";
    api.get(url, { params: { q: searchQ } }).then((r) => setResults(r.data));
  }, [searchOpen, searchTab, searchQ]);

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.quantity * i.unit_price, 0), [items]);
  const discountValue = discountType === "percent" ? subtotal * (discount / 100) : Number(discount || 0);
  const total = Math.max(0, subtotal - discountValue);

  const addItem = (it) => {
    setItems([...items, {
      item_type: searchTab === "products" ? "product" : "service",
      product_id: it.id && searchTab === "products" ? it.id : null,
      service_id: it.id && searchTab === "services" ? it.id : null,
      description: it.name + (it.description ? ` — ${it.description}` : ""),
      quantity: 1, unit: it.unit || "un", unit_price: Number(it.price || 0),
    }]);
    setSearchOpen(false); setSearchQ("");
  };

  const addCustom = () => {
    setItems([...items, { item_type: "custom", description: "Item personalizado", quantity: 1, unit: "un", unit_price: 0 }]);
  };

  const patchItem = (i, k, v) => {
    const next = [...items];
    next[i] = { ...next[i], [k]: (k === "quantity" || k === "unit_price") ? Number(v || 0) : v };
    setItems(next);
  };
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));

  const saveQuick = async () => {
    try {
      const url = quickType === "product" ? "/products" : "/services";
      const r = await api.post(url, quickData);
      addItem(r.data);
      setQuickOpen(false); setQuickData({ name: "", price: 0, unit: "un", description: "" });
      toast.success("Cadastrado e adicionado ao orçamento");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const save = async () => {
    if (items.length === 0) { toast.error("Adicione pelo menos um item"); return; }
    const payload = {
      client_id: clientId || null, date, expiration_date: expiration || null,
      items: items.map((it) => ({ ...it, quantity: Number(it.quantity), unit_price: Number(it.unit_price) })),
      discount: Number(discount || 0), discount_type: discountType,
      payment_method: paymentMethod, delivery_deadline: deadline,
      notes, terms, orientation,
    };
    try {
      const r = current ? await api.put(`/quotes/${current.id}`, payload) : await api.post("/quotes", payload);
      toast.success(current ? "Orçamento salvo" : "Orçamento criado");
      refreshUsage(); nav(`/dashboard/quotes/${r.data.id}`);
      setCurrent(r.data);
    } catch (e) {
      if (e.response?.status === 402) {
        toast.error(formatApiError(e.response?.data?.detail));
        nav("/dashboard/plan");
      } else toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  const send = async () => {
    if (!current) { await save(); return; }
    await api.post(`/quotes/${current.id}/status`, { status: "ENVIADO" });
    toast.success("Marcado como ENVIADO. Compartilhe o link público.");
    setCurrent({ ...current, status: "ENVIADO" });
  };

  const publicUrl = current ? `${window.location.origin}/q/${current.public_token}` : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-black">{current ? `Orçamento ${current.number}` : "Novo orçamento"}</h1>
          {current && <div className="text-zinc-500 text-sm mt-1">Status: <b>{current.status}</b></div>}
        </div>
        <div className="flex gap-2">
          {current && (
            <>
              <Button variant="outline" onClick={() => window.open(`${process.env.REACT_APP_BACKEND_URL}/api/quotes/${current.id}/pdf`, "_blank")} data-testid="edit-download-pdf">
                Baixar PDF
              </Button>
              <Button variant="outline" onClick={async () => { await navigator.clipboard.writeText(publicUrl); toast.success("Link copiado"); }} data-testid="edit-copy-link">
                Copiar link
              </Button>
              <Button variant="outline" onClick={send} data-testid="edit-send"><Send className="w-4 h-4 mr-2" />Marcar como enviado</Button>
            </>
          )}
          <Button onClick={save} className="brand-bg hover:bg-[#008a02] text-white font-bold" data-testid="edit-save"><Save className="w-4 h-4 mr-2" />Salvar</Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4">
          <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2 md:col-span-3">
                <Label>Cliente</Label>
                <Select value={clientId || "NONE"} onValueChange={(v) => setClientId(v === "NONE" ? "" : v)}>
                  <SelectTrigger data-testid="editor-client-select"><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">— Sem cliente —</SelectItem>
                    {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Data</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
              <div className="space-y-2"><Label>Validade</Label><Input type="date" value={expiration} onChange={(e) => setExpiration(e.target.value)} data-testid="editor-expiration" /></div>
              <div className="space-y-2">
                <Label>Orientação</Label>
                <Select value={orientation} onValueChange={setOrientation}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="vertical">Vertical</SelectItem><SelectItem value="horizontal">Horizontal</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="font-display font-extrabold text-lg">Itens</div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setSearchOpen(true)} data-testid="editor-search-open"><Search className="w-4 h-4 mr-2" />Pesquisar</Button>
                <Button variant="outline" onClick={addCustom} data-testid="editor-add-custom"><Plus className="w-4 h-4 mr-2" />Item livre</Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-widest text-zinc-500">
                  <tr><th className="text-left py-2 w-8">#</th><th className="text-left">Descrição</th><th className="w-24">Qtd</th><th className="w-20">Un.</th><th className="w-32">Vlr. unit.</th><th className="w-32 text-right">Total</th><th className="w-10" /></tr>
                </thead>
                <tbody>
                  {items.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-zinc-400">Adicione produtos ou serviços</td></tr>}
                  {items.map((it, i) => (
                    <tr key={i} className="border-t border-zinc-100">
                      <td className="py-2">{i + 1}</td>
                      <td><Input value={it.description} onChange={(e) => patchItem(i, "description", e.target.value)} data-testid={`item-desc-${i}`} /></td>
                      <td><Input type="number" step="0.01" value={it.quantity} onChange={(e) => patchItem(i, "quantity", e.target.value)} data-testid={`item-qty-${i}`} /></td>
                      <td><Input value={it.unit} onChange={(e) => patchItem(i, "unit", e.target.value)} /></td>
                      <td><Input type="number" step="0.01" value={it.unit_price} onChange={(e) => patchItem(i, "unit_price", e.target.value)} data-testid={`item-price-${i}`} /></td>
                      <td className="text-right font-semibold">{money(it.quantity * it.unit_price)}</td>
                      <td><Button variant="ghost" size="icon" onClick={() => removeItem(i)} data-testid={`item-remove-${i}`}><Trash2 className="w-4 h-4 text-red-500" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-5 grid md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Forma de pagamento</Label><Input value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} placeholder="PIX / cartão / boleto / …" /></div>
            <div className="space-y-2"><Label>Prazo de entrega</Label><Input value={deadline} onChange={(e) => setDeadline(e.target.value)} placeholder="Ex: 15 dias úteis" /></div>
            <div className="space-y-2 md:col-span-2"><Label>Observações</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
            <div className="space-y-2 md:col-span-2"><Label>Termos e condições</Label><Textarea rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} /></div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <div className="font-display font-extrabold text-lg mb-3">Totais</div>
            <div className="flex justify-between py-1 text-sm"><span className="text-zinc-500">Subtotal</span><span className="font-semibold">{money(subtotal)}</span></div>
            <div className="flex items-center gap-2 mt-2">
              <Input type="number" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} className="flex-1" data-testid="editor-discount" />
              <Select value={discountType} onValueChange={setDiscountType}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="value">R$</SelectItem><SelectItem value="percent">%</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="flex justify-between py-1 text-sm mt-2"><span className="text-zinc-500">Desconto</span><span className="font-semibold text-red-600">- {money(discountValue)}</span></div>
            <div className="border-t border-zinc-200 mt-3 pt-3 flex justify-between items-baseline">
              <span className="text-sm text-zinc-500">Total</span>
              <span className="text-3xl font-display font-black brand-text" data-testid="editor-total">{money(total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search dialog */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="font-display">Adicionar item</DialogTitle></DialogHeader>
          <Tabs value={searchTab} onValueChange={setSearchTab}>
            <TabsList><TabsTrigger value="products" data-testid="search-tab-products">Produtos</TabsTrigger><TabsTrigger value="services" data-testid="search-tab-services">Serviços</TabsTrigger></TabsList>
            <TabsContent value="products" className="pt-2">
              <Input placeholder="Pesquisar produto por nome ou código…" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} data-testid="search-products-input" />
            </TabsContent>
            <TabsContent value="services" className="pt-2">
              <Input placeholder="Pesquisar serviço por nome…" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} data-testid="search-services-input" />
            </TabsContent>
          </Tabs>
          <div className="max-h-80 overflow-auto border border-zinc-200 rounded-md divide-y divide-zinc-100">
            {results.length === 0 ? (
              <div className="p-6 text-center text-zinc-400 text-sm">Nenhum resultado. Cadastre rapidamente:</div>
            ) : results.map((r) => (
              <button key={r.id} onClick={() => addItem(r)} className="w-full text-left px-4 py-3 hover:bg-zinc-50" data-testid={`search-result-${r.id}`}>
                <div className="flex justify-between">
                  <div>
                    <div className="font-semibold">{r.name} {r.sku && <span className="text-xs text-zinc-400 ml-2">{r.sku}</span>}</div>
                    <div className="text-xs text-zinc-500">{r.description || r.unit}</div>
                  </div>
                  <div className="font-semibold brand-text">{money(r.price)}</div>
                </div>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setQuickType(searchTab === "products" ? "product" : "service"); setQuickData({ ...quickData, name: searchQ }); setQuickOpen(true); }} data-testid="search-quick-add">
              <Plus className="w-4 h-4 mr-2" /> Cadastrar novo {searchTab === "products" ? "produto" : "serviço"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick create */}
      <Dialog open={quickOpen} onOpenChange={setQuickOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Cadastro rápido</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2"><Label>Nome</Label><Input value={quickData.name} onChange={(e) => setQuickData({ ...quickData, name: e.target.value })} data-testid="quick-name" /></div>
            <div className="space-y-2"><Label>Preço</Label><Input type="number" step="0.01" value={quickData.price} onChange={(e) => setQuickData({ ...quickData, price: Number(e.target.value) })} data-testid="quick-price" /></div>
            <div className="space-y-2"><Label>Unidade</Label><Input value={quickData.unit} onChange={(e) => setQuickData({ ...quickData, unit: e.target.value })} /></div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea rows={2} value={quickData.description} onChange={(e) => setQuickData({ ...quickData, description: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={saveQuick} className="brand-bg hover:bg-[#008a02] text-white font-bold" data-testid="quick-save">Salvar e adicionar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
