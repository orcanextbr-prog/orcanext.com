import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  ArrowRight, Check, Menu, X, Zap, Send, Eye, ShieldCheck, PenLine, Receipt,
  FileText, Users, Package, Wrench, MessageSquare, Sparkles, Smartphone,
  Building2, Layers, Palette, ArrowDown,
} from "lucide-react";

/* ---------- shared motion presets ---------- */
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } },
};
const stagger = { show: { transition: { staggerChildren: 0.08 } } };

function Reveal({ children, className = "", delay = 0, testid }) {
  const rm = useReducedMotion();
  return (
    <motion.div
      data-testid={testid}
      className={className}
      initial={rm ? false : "hidden"}
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      variants={{ hidden: fadeUp.hidden, show: { ...fadeUp.show, transition: { ...fadeUp.show.transition, delay } } }}
    >
      {children}
    </motion.div>
  );
}

/* ---------- Header ---------- */
function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const items = [
    { href: "#recursos", label: "Recursos" },
    { href: "#como-funciona", label: "Como funciona" },
    { href: "#planos", label: "Planos" },
    { href: "#faq", label: "FAQ" },
  ];
  return (
    <header
      className={`sticky top-0 z-50 transition-all ${scrolled ? "bg-white/85 backdrop-blur-xl border-b border-zinc-200 shadow-[0_1px_0_rgba(0,0,0,0.03)]" : "bg-white/60 backdrop-blur"} `}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between px-5 md:px-8 h-16">
        <Link to="/" className="flex items-center gap-2" data-testid="header-logo">
          <img src="/logo.png" alt="OrçaNext" className="w-7 h-7" />
          <span className="text-lg md:text-xl font-display font-black tracking-tight">
            Orça<span className="brand-text">Next</span>
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-zinc-700">
          {items.map((i) => (
            <a key={i.href} href={i.href} className="hover:text-black transition">{i.label}</a>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-3">
          <Link to="/login" data-testid="header-login-link" className="text-sm font-bold hover:text-[#00AD02] transition">
            Entrar
          </Link>
          <Link to="/register" data-testid="header-cta">
            <Button className="brand-bg hover:bg-[#008a02] text-white font-bold rounded-xl h-10 px-5">
              COMEÇAR GRÁTIS
            </Button>
          </Link>
        </div>
        <button
          className="md:hidden w-10 h-10 grid place-items-center rounded-lg hover:bg-zinc-100"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          data-testid="header-menu-toggle"
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>
      {open && (
        <div className="md:hidden bg-white border-t border-zinc-200 px-5 py-5 space-y-3" data-testid="header-mobile-menu">
          {items.map((i) => (
            <a key={i.href} href={i.href} onClick={() => setOpen(false)}
              className="block py-2 text-base font-semibold">{i.label}</a>
          ))}
          <div className="pt-3 border-t border-zinc-200 flex gap-3">
            <Link to="/login" onClick={() => setOpen(false)} className="flex-1">
              <Button variant="outline" className="w-full rounded-xl h-11 border-black font-bold">Entrar</Button>
            </Link>
            <Link to="/register" onClick={() => setOpen(false)} className="flex-1">
              <Button className="w-full rounded-xl h-11 brand-bg text-white font-bold">COMEÇAR GRÁTIS</Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

/* ---------- Hero + animated quote mockup ---------- */
function AnimatedQuoteMockup() {
  const rm = useReducedMotion();
  const steps = [
    { icon: Send, label: "Enviado" },
    { icon: Eye, label: "Visualizado" },
    { icon: ShieldCheck, label: "Aprovado" },
    { icon: PenLine, label: "Assinado" },
  ];
  return (
    <div className="relative">
      {/* soft brand glow */}
      <div className="absolute -top-10 -left-10 w-72 h-72 brand-bg opacity-10 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute -bottom-10 -right-10 w-72 h-72 bg-black opacity-5 blur-3xl rounded-full pointer-events-none" />
      <motion.div
        initial={rm ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.15 }}
        className="relative rounded-2xl bg-white border border-zinc-200 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.25)] p-5 md:p-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-zinc-500">Orçamento</div>
            <div className="text-lg md:text-2xl font-display font-black">Nº 2026-0042</div>
          </div>
          <Badge className="rounded-md brand-bg text-white">APROVADO</Badge>
        </div>

        <div className="mt-4 rounded-xl border border-zinc-200 divide-y divide-zinc-100 overflow-hidden">
          {[
            ["Instalação de painel solar 5kWp", "1", "R$ 18.900,00"],
            ["Consultoria técnica", "3h", "R$ 750,00"],
            ["Suporte pós-instalação", "1", "R$ 490,00"],
          ].map((r, i) => (
            <div key={i} className="grid grid-cols-6 items-center px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm">
              <div className="col-span-3 font-semibold truncate">{r[0]}</div>
              <div className="col-span-1 text-zinc-500">{r[1]}</div>
              <div className="col-span-2 text-right font-bold">{r[2]}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-baseline justify-between border-t border-zinc-200 pt-3">
          <span className="text-xs md:text-sm text-zinc-500">Total</span>
          <span className="font-display text-2xl md:text-3xl font-black brand-text">R$ 20.140,00</span>
        </div>

        {/* Status pipeline animation */}
        <motion.div
          className="mt-5 grid grid-cols-4 gap-2"
          variants={stagger}
          initial={rm ? false : "hidden"}
          animate="show"
        >
          {steps.map((s, i) => (
            <motion.div
              key={s.label}
              variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { delay: 0.4 + i * 0.25 } } }}
              className="rounded-lg bg-zinc-100 px-2 py-2 flex items-center gap-1.5 md:gap-2"
            >
              <span className="w-6 h-6 rounded-md brand-bg text-white grid place-items-center shrink-0">
                <s.icon className="w-3 h-3" />
              </span>
              <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider truncate">{s.label}</span>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      {/* floating "signed" chip */}
      <motion.div
        initial={rm ? false : { opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, delay: 1.6 }}
        className="hidden sm:flex absolute -bottom-5 -right-3 md:-right-6 bg-black text-white rounded-xl px-4 py-3 items-center gap-2 shadow-2xl"
      >
        <div className="w-7 h-7 rounded-lg brand-bg grid place-items-center"><PenLine className="w-4 h-4" /></div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-white/60 font-bold">Assinado</div>
          <div className="text-xs font-bold">há 2 minutos</div>
        </div>
      </motion.div>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 subtle-grid opacity-60 pointer-events-none" />
      <div className="max-w-7xl mx-auto px-5 md:px-8 pt-10 md:pt-20 pb-16 md:pb-28 grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
        <Reveal>
          <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-5">
            <span className="w-2 h-2 rounded-full brand-bg animate-pulse" /> Do orçamento ao fechamento.
          </div>
          <h1 className="font-display font-black text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tighter text-black">
            Transforme seus orçamentos em{" "}
            <span className="brand-text">oportunidades de venda.</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-zinc-600 leading-relaxed max-w-xl">
            Crie orçamentos profissionais, envie em segundos e deixe seu cliente aprovar e assinar online.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            <Link to="/register" data-testid="hero-cta-primary" className="w-full sm:w-auto">
              <Button className="w-full brand-bg hover:bg-[#008a02] text-white font-bold rounded-xl h-12 px-7 text-base">
                COMEÇAR GRÁTIS <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <a href="#como-funciona" data-testid="hero-cta-secondary" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full h-12 px-7 rounded-xl border-black text-black font-bold hover:bg-zinc-50">
                CONHECER O ORÇANEXT
              </Button>
            </a>
          </div>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-500">
            <div className="flex items-center gap-2"><Check className="w-4 h-4 brand-text" /> 15 orçamentos grátis</div>
            <div className="flex items-center gap-2"><Check className="w-4 h-4 brand-text" /> Sem cartão de crédito</div>
          </div>
        </Reveal>

        <Reveal delay={0.15}>
          <AnimatedQuoteMockup />
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- Problem ---------- */
function Problem() {
  const items = [
    { i: FileText, t: "Word e Excel confusos" },
    { i: FileText, t: "PDFs manuais demorados" },
    { i: MessageSquare, t: "Conversas espalhadas pelo WhatsApp" },
    { i: Layers, t: "Informações desorganizadas" },
    { i: Eye, t: "Sem acompanhamento do que foi visto" },
    { i: PenLine, t: "Sem aceite formal do cliente" },
  ];
  return (
    <section className="bg-zinc-50 border-y border-zinc-200 py-16 md:py-24">
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <Reveal className="max-w-2xl">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-3">O problema</div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight">
            Ainda perde tempo criando orçamentos?
          </h2>
          <p className="mt-4 text-zinc-600 text-base md:text-lg leading-relaxed">
            Word, Excel, PDFs manuais e conversas espalhadas pelo WhatsApp podem tornar um processo simples muito mais demorado.
          </p>
        </Reveal>

        <motion.div
          className="mt-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4"
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
        >
          {items.map((x, i) => (
            <motion.div key={i} variants={fadeUp}
              className="bg-white border border-zinc-200 rounded-xl p-5 flex items-start gap-3">
              <span className="w-9 h-9 shrink-0 rounded-lg bg-zinc-100 text-zinc-500 grid place-items-center">
                <x.i className="w-4 h-4" />
              </span>
              <div>
                <div className="text-xs font-bold text-zinc-400">0{i + 1}</div>
                <div className="mt-0.5 font-semibold">{x.t}</div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <Reveal className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-1 brand-bg rounded-full" />
            <p className="text-lg md:text-xl font-display font-bold">Existe uma forma mais simples.</p>
          </div>
          <a href="#como-funciona" data-testid="problem-cta">
            <Button variant="outline" className="rounded-xl border-black font-bold h-11 px-5">
              CONHECER O ORÇANEXT <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </a>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- Antes / Depois ---------- */
function Transformation() {
  const before = ["Word", "Excel", "WhatsApp", "Arquivos soltos", "Planilhas manuais"];
  const after  = ["Clientes", "Produtos & serviços", "Orçamentos", "Aprovação", "Assinatura", "Recibos"];
  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <Reveal className="max-w-2xl">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-3">Transformação</div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight">
            De ferramentas espalhadas para{" "}
            <span className="brand-text">um só lugar.</span>
          </h2>
        </Reveal>

        <div className="mt-10 grid md:grid-cols-[1fr_auto_1fr] items-stretch gap-4 md:gap-6">
          <Reveal className="rounded-2xl bg-zinc-50 border border-zinc-200 p-6 md:p-7">
            <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Antes</div>
            <div className="mt-2 font-display text-2xl md:text-3xl font-black">O caos</div>
            <ul className="mt-5 space-y-2.5">
              {before.map((x) => (
                <li key={x} className="flex items-center gap-2 text-zinc-600">
                  <X className="w-4 h-4 text-zinc-400" /> <span className="line-through decoration-zinc-300">{x}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          <div className="hidden md:flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="w-12 h-12 rounded-full brand-bg text-white grid place-items-center shadow-lg"
            >
              <ArrowRight className="w-5 h-5" />
            </motion.div>
          </div>
          <div className="md:hidden flex items-center justify-center py-2">
            <ArrowDown className="w-5 h-5 brand-text" />
          </div>

          <Reveal delay={0.1} className="rounded-2xl bg-black text-white p-6 md:p-7 border border-black relative overflow-hidden">
            <div className="absolute -top-16 -right-16 w-56 h-56 brand-bg opacity-20 blur-3xl rounded-full" />
            <div className="text-[11px] font-bold uppercase tracking-widest text-[#00AD02]">Depois</div>
            <div className="mt-2 font-display text-2xl md:text-3xl font-black text-white">OrçaNext</div>
            <ul className="mt-5 grid grid-cols-2 gap-2.5">
              {after.map((x) => (
                <li key={x} className="flex items-center gap-2 text-white/90">
                  <Check className="w-4 h-4 brand-text" /> <span className="font-semibold">{x}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ---------- Como funciona (Criar → Enviar → Aprovar → Assinar → Receber) ---------- */
function HowItWorks() {
  const steps = [
    { i: FileText,     t: "CRIAR",   d: "Monte seu orçamento em poucos minutos." },
    { i: Send,         t: "ENVIAR",  d: "Compartilhe por link ou PDF." },
    { i: ShieldCheck,  t: "APROVAR", d: "Seu cliente aprova online, sem precisar criar conta." },
    { i: PenLine,      t: "ASSINAR", d: "Receba a assinatura diretamente pelo orçamento." },
    { i: Receipt,      t: "RECEBER", d: "Registre o pagamento e gere seu recibo." },
  ];
  return (
    <section id="como-funciona" className="py-16 md:py-24 bg-zinc-50 border-y border-zinc-200">
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <Reveal className="max-w-2xl">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-3">Como funciona</div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight">
            Veja como é simples.
          </h2>
          <p className="mt-4 text-zinc-600 text-base md:text-lg">
            Tudo o que você precisa para transformar um orçamento em negócio fechado.
          </p>
        </Reveal>

        <motion.ol
          className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4"
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
        >
          {steps.map((s, i) => (
            <motion.li
              key={s.t}
              variants={fadeUp}
              className="relative rounded-2xl bg-white border border-zinc-200 p-5 hover:-translate-y-1 hover:border-zinc-300 transition"
            >
              <div className="flex items-center justify-between">
                <span className="w-10 h-10 rounded-xl brand-bg text-white grid place-items-center">
                  <s.i className="w-4 h-4" />
                </span>
                <span className="text-[11px] font-black tracking-widest text-zinc-300">0{i + 1}</span>
              </div>
              <div className="mt-4 font-display font-black text-lg">{s.t}</div>
              <p className="mt-1.5 text-sm text-zinc-500 leading-snug">{s.d}</p>
            </motion.li>
          ))}
        </motion.ol>
      </div>
    </section>
  );
}

/* ---------- Benefícios ---------- */
function Benefits() {
  return (
    <section id="recursos" className="bg-black text-white py-16 md:py-24 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
      <div className="max-w-6xl mx-auto px-5 md:px-8 relative">
        <Reveal className="max-w-2xl">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#00AD02] mb-3">Benefícios</div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
            Mais profissional. Mais rápido. Mais organizado.
          </h2>
        </Reveal>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Reveal className="md:row-span-2 md:col-span-1 brand-bg rounded-2xl p-7 flex flex-col justify-between min-h-[300px]">
            <Zap className="w-10 h-10 text-white" />
            <div>
              <div className="font-display text-2xl md:text-3xl font-black text-white">Rapidez extrema</div>
              <p className="mt-3 text-white/90">Crie um orçamento completo em minutos. Pesquisa em tempo real de clientes, produtos e serviços cadastrados.</p>
            </div>
          </Reveal>

          {[
            { i: FileText,     t: "Crie mais rápido",   d: "Orçamentos profissionais sem perder tempo." },
            { i: Send,         t: "Envie em segundos",  d: "Compartilhe por link ou PDF." },
            { i: ShieldCheck,  t: "Aprovação online",   d: "Seu cliente aprova sem precisar criar conta." },
            { i: PenLine,      t: "Assinatura",         d: "Receba o aceite diretamente pelo orçamento." },
            { i: Wrench,       t: "Organização",        d: "Clientes, produtos, serviços e orçamentos em um só lugar." },
            { i: Receipt,      t: "Recibos",            d: "Registre pagamentos e gere recibos profissionais." },
          ].map((b, i) => (
            <Reveal
              key={b.t}
              delay={0.05 * i}
              className="rounded-2xl bg-zinc-900 border border-zinc-800 p-6 hover:border-[#00AD02]/50 transition"
            >
              <b.i className="w-7 h-7 brand-text" />
              <div className="mt-4 font-display font-black text-lg text-white">{b.t}</div>
              <p className="text-sm text-zinc-400 mt-1">{b.d}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Feito para prestadores de serviços ---------- */
function ForServiceProviders() {
  const cats = [
    "Eletricistas", "Técnicos", "Instaladores", "Pintores",
    "Designers", "Consultores", "Autônomos", "Pequenas empresas",
  ];
  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="max-w-6xl mx-auto px-5 md:px-8 grid lg:grid-cols-2 gap-10 items-center">
        <Reveal>
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-3">Para quem vende serviços</div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight">
            Feito para quem vende serviços.
          </h2>
          <p className="mt-4 text-zinc-600 text-base md:text-lg leading-relaxed">
            Se você trabalha com serviços, sabe que um orçamento profissional pode ser a diferença entre apenas enviar um preço e realmente transmitir valor.
          </p>
        </Reveal>

        <motion.div
          className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 md:gap-3"
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
        >
          {cats.map((c) => (
            <motion.div
              key={c}
              variants={fadeUp}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm font-semibold text-center hover:border-[#00AD02] hover:text-[#00AD02] transition"
            >
              {c}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ---------- Prova social (preparada, sem inventar) ---------- */
function SocialProof() {
  return (
    <section className="py-16 md:py-20 bg-zinc-50 border-y border-zinc-200">
      <div className="max-w-4xl mx-auto px-5 md:px-8 text-center">
        <Reveal>
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-3">Feito para profissionais</div>
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-black tracking-tight leading-tight">
            Construído para profissionais que querem vender de forma mais profissional.
          </h2>
          <p className="mt-4 text-zinc-500 text-base md:text-lg">
            Interface pensada em cada detalhe para transmitir credibilidade em cada orçamento.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- Resultado: comum vs profissional ---------- */
function Result() {
  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <Reveal className="max-w-2xl">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-3">O resultado</div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight">
            Seu orçamento não precisa ser apenas um preço.
          </h2>
          <p className="mt-4 text-zinc-600 text-base md:text-lg leading-relaxed">
            Ele pode transmitir profissionalismo, facilitar a decisão do cliente e acelerar o fechamento.
          </p>
        </Reveal>

        <div className="mt-10 grid md:grid-cols-2 gap-4 md:gap-6">
          <Reveal className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 md:p-8">
            <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Orçamento comum</div>
            <div className="mt-4 rounded-lg bg-white border border-dashed border-zinc-300 p-5 space-y-2 text-sm">
              <div className="text-zinc-500">Serviço: pintura</div>
              <div className="text-zinc-500">Quantidade: 1</div>
              <div className="text-zinc-500">Valor: R$ 1.500,00</div>
              <div className="text-zinc-400 text-xs pt-2">Enviado via WhatsApp — sem link, sem aceite, sem organização.</div>
            </div>
          </Reveal>

          <Reveal delay={0.1} className="rounded-2xl bg-black text-white p-6 md:p-8 relative overflow-hidden">
            <div className="absolute -top-16 -right-16 w-60 h-60 brand-bg opacity-20 blur-3xl rounded-full" />
            <div className="text-[11px] font-bold uppercase tracking-widest text-[#00AD02]">Orçamento profissional</div>
            <div className="mt-4 rounded-lg bg-zinc-900 border border-zinc-800 p-5 space-y-2">
              <div className="flex justify-between items-center">
                <div className="text-white font-semibold">Nº 2026-0042</div>
                <Badge className="rounded-md brand-bg text-white">ASSINADO</Badge>
              </div>
              <div className="text-zinc-300 text-sm">Pintura completa · Materiais inclusos</div>
              <div className="pt-2 flex items-baseline justify-between">
                <span className="text-xs text-zinc-400">Total</span>
                <span className="font-display text-2xl md:text-3xl font-black brand-text">R$ 1.500,00</span>
              </div>
              <div className="pt-2 grid grid-cols-4 gap-1.5">
                {["ENVIADO", "VISTO", "APROVADO", "ASSINADO"].map((s) => (
                  <span key={s} className="text-[10px] text-center font-bold rounded-md bg-zinc-800 text-white py-1.5">{s}</span>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ---------- Pricing ---------- */
function Pricing() {
  const [cycle, setCycle] = useState("monthly");
  const freeFeat = [
    "Até 15 orçamentos",
    "Clientes",
    "Produtos",
    "Serviços",
    "Link público",
    "PDF",
    "Aprovação online",
    "Assinatura eletrônica",
    "Marca d'água OrçaNext",
  ];
  const proFeat = [
    "Orçamentos ilimitados",
    "Clientes ilimitados",
    "Produtos ilimitados",
    "Serviços ilimitados",
    "Modelos ilimitados",
    "Sem marca d'água",
    "PDF profissional",
    "Personalização",
    "Recibos",
    "Recursos profissionais",
  ];
  return (
    <section id="planos" className="py-16 md:py-24 bg-zinc-50 border-y border-zinc-200">
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <Reveal className="max-w-2xl">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-3">Planos</div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight">
            Comece grátis. Evolua quando precisar.
          </h2>
        </Reveal>

        <Reveal className="mt-8 inline-flex bg-white border border-zinc-200 rounded-full p-1" delay={0.05}>
          <button
            data-testid="pricing-toggle-monthly"
            onClick={() => setCycle("monthly")}
            className={`px-4 md:px-5 py-2 text-sm font-bold rounded-full transition ${cycle === "monthly" ? "bg-black text-white" : "text-zinc-600"}`}
          >
            Mensal
          </button>
          <button
            data-testid="pricing-toggle-yearly"
            onClick={() => setCycle("yearly")}
            className={`px-4 md:px-5 py-2 text-sm font-bold rounded-full transition inline-flex items-center gap-2 ${cycle === "yearly" ? "bg-black text-white" : "text-zinc-600"}`}
          >
            Anual <span className={`text-[10px] font-black rounded px-1.5 py-0.5 ${cycle === "yearly" ? "brand-bg text-white" : "bg-zinc-100 text-[#00AD02]"}`}>-20%</span>
          </button>
        </Reveal>

        <div className="mt-8 grid md:grid-cols-2 gap-5 md:gap-6">
          {/* Gratuito */}
          <Reveal className="bg-white border border-zinc-200 rounded-2xl p-7 md:p-8" testid="pricing-free-card">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">Gratuito</div>
            <div className="mt-2 flex items-baseline gap-2">
              <div className="font-display text-4xl md:text-5xl font-black">R$ 0</div>
              <div className="text-zinc-500">para começar</div>
            </div>
            <p className="mt-2 text-zinc-500">Ideal para começar.</p>
            <ul className="mt-6 space-y-2.5 text-sm">
              {freeFeat.map((f) => (
                <li key={f} className="flex gap-2"><Check className="w-4 h-4 brand-text mt-0.5 shrink-0" /><span>{f}</span></li>
              ))}
            </ul>
            <Link to="/register" className="block mt-8" data-testid="pricing-free-cta">
              <Button variant="outline" className="w-full h-11 rounded-xl border-black font-bold">COMEÇAR GRÁTIS</Button>
            </Link>
          </Reveal>

          {/* Profissional */}
          <Reveal delay={0.1} className="relative bg-black text-white rounded-2xl p-7 md:p-8 border-2 border-[#00AD02] overflow-hidden" testid="pricing-pro-card">
            <div className="absolute -top-24 -right-24 w-64 h-64 brand-bg opacity-20 blur-3xl rounded-full" />
            <div className="absolute top-4 right-5">
              <Badge className="rounded-md brand-bg text-white">MAIS ESCOLHIDO</Badge>
            </div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#00AD02]">Profissional</div>
            <div className="mt-2 flex items-baseline gap-2">
              <div className="font-display text-4xl md:text-5xl font-black text-white" data-testid="pricing-pro-price">
                {cycle === "monthly" ? "R$ 49,90" : "R$ 39,90"}
              </div>
              <div className="text-zinc-400">/mês</div>
            </div>
            <div className="mt-2 text-zinc-400 text-sm min-h-[20px]">
              {cycle === "monthly"
                ? "ou R$ 478,80/ano (equivalente a R$ 39,90/mês)"
                : "cobrado anualmente — R$ 478,80/ano"}
            </div>
            <p className="mt-4 text-white/90">Orçamentos ilimitados para quem quer crescer.</p>
            <ul className="mt-6 space-y-2.5 text-sm">
              {proFeat.map((f) => (
                <li key={f} className="flex gap-2"><Check className="w-4 h-4 brand-text mt-0.5 shrink-0" /><span>{f}</span></li>
              ))}
            </ul>
            <Link to="/register" className="block mt-8" data-testid="pricing-pro-cta">
              <Button className="w-full h-12 rounded-xl brand-bg hover:bg-[#008a02] text-white font-bold text-base">
                ASSINAR PROFISSIONAL
              </Button>
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ---------- CTA intermediário ---------- */
function MidCTA() {
  return (
    <section className="py-14 md:py-20 bg-white">
      <div className="max-w-4xl mx-auto px-5 md:px-8">
        <Reveal className="relative overflow-hidden rounded-3xl bg-black text-white p-8 md:p-14 border border-black">
          <div className="absolute -right-16 -top-16 w-72 h-72 brand-bg opacity-20 blur-3xl rounded-full pointer-events-none" />
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#00AD02] mb-3">Pronto para começar?</div>
          <h2 className="font-display text-2xl sm:text-3xl md:text-5xl font-black tracking-tight text-white leading-tight">
            Pronto para deixar seus orçamentos mais profissionais?
          </h2>
          <p className="mt-4 text-zinc-300 max-w-2xl">
            Comece grátis com até 15 orçamentos. Quando sua operação crescer, evolua para o Profissional.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            <Link to="/register" data-testid="mid-cta-primary" className="w-full sm:w-auto">
              <Button className="w-full brand-bg hover:bg-[#008a02] text-white font-bold rounded-xl h-12 px-7 text-base">
                COMEÇAR GRÁTIS <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <a href="#planos" data-testid="mid-cta-secondary" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full h-12 px-7 rounded-xl bg-transparent border-white text-white font-bold hover:bg-white hover:text-black">
                VER PLANOS
              </Button>
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- FAQ ---------- */
function FAQ() {
  const faqs = [
    ["O que é o OrçaNext?", "Um SaaS brasileiro para criar, enviar, aprovar e receber aceite eletrônico de orçamentos profissionais."],
    ["Como funciona?", "Você cadastra seus clientes, produtos e serviços, cria um orçamento em minutos, envia por link ou PDF e recebe a aprovação e assinatura do seu cliente online."],
    ["Preciso instalar alguma coisa?", "Não. É totalmente online, acessível pelo navegador em qualquer dispositivo."],
    ["Posso usar pelo celular?", "Sim. A interface é 100% responsiva para desktop, tablet e smartphone."],
    ["Meu cliente precisa criar uma conta?", "Não. O cliente aprova e assina pelo link público, sem cadastro."],
    ["Posso enviar pelo WhatsApp?", "Sim. Cada orçamento gera um link público para compartilhar por WhatsApp, e-mail ou onde preferir."],
    ["Posso gerar PDF?", "Sim. Todo orçamento pode ser exportado em PDF profissional."],
    ["Meu cliente pode aprovar online?", "Sim, com um clique no link público — sem precisar criar conta."],
    ["Meu cliente pode assinar?", "Sim. A assinatura eletrônica é feita diretamente no próprio orçamento."],
    ["Quantos orçamentos posso criar gratuitamente?", "O plano gratuito permite criar até 15 orçamentos."],
    ["O que acontece depois dos 15 orçamentos?", "Você continua podendo acessar seus dados e gerenciar os orçamentos existentes, mas precisará do plano Profissional para criar novos orçamentos."],
    ["O plano Profissional possui limite?", "Não. O plano Profissional possui criação ilimitada de orçamentos."],
    ["Quanto custa o Profissional?", "R$ 49,90/mês ou R$ 478,80/ano (equivalente a R$ 39,90/mês)."],
    ["Posso cancelar?", "Sim, a qualquer momento. Seus dados permanecem preservados mesmo em caso de downgrade."],
  ];
  return (
    <section id="faq" className="py-16 md:py-24 bg-zinc-50 border-y border-zinc-200">
      <div className="max-w-3xl mx-auto px-5 md:px-8">
        <Reveal>
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-3">FAQ</div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight">Perguntas frequentes.</h2>
        </Reveal>
        <Reveal delay={0.05}>
          <Accordion type="single" collapsible className="mt-8" data-testid="faq-accordion">
            {faqs.map(([q, a], i) => (
              <AccordionItem key={i} value={`q${i}`} className="border-zinc-200">
                <AccordionTrigger className="text-left font-display font-bold text-base md:text-lg hover:no-underline">{q}</AccordionTrigger>
                <AccordionContent className="text-zinc-600 text-sm md:text-base">{a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- Final CTA ---------- */
function FinalCTA() {
  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="max-w-4xl mx-auto px-5 md:px-8 text-center">
        <Reveal>
          <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#00AD02] mb-4">
            <Sparkles className="w-4 h-4" /> Pronto para começar?
          </div>
          <h2 className="font-display font-black text-3xl sm:text-4xl md:text-6xl tracking-tighter leading-[1.05]">
            Seu próximo orçamento pode ser o começo do{" "}
            <span className="brand-text">próximo negócio.</span>
          </h2>
          <p className="mt-5 text-zinc-600 text-base md:text-lg max-w-2xl mx-auto">
            Comece gratuitamente e descubra uma forma mais profissional de criar, enviar e fechar seus orçamentos.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
            <Link to="/register" data-testid="final-cta" className="w-full sm:w-auto">
              <Button className="w-full brand-bg hover:bg-[#008a02] text-white font-bold rounded-xl h-13 px-8 text-base" style={{ height: "3.25rem" }}>
                COMEÇAR GRÁTIS <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <a href="#planos" data-testid="final-cta-secondary" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full rounded-xl border-black text-black font-bold hover:bg-zinc-50" style={{ height: "3.25rem", padding: "0 2rem" }}>
                VER PLANOS
              </Button>
            </a>
          </div>
          <p className="mt-5 text-sm text-zinc-500">15 orçamentos grátis. Sem cartão de crédito.</p>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- Footer ---------- */
function Footer() {
  return (
    <footer className="bg-black text-white pt-14 pb-10">
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <div className="flex flex-col md:flex-row justify-between gap-10">
          <div className="max-w-sm">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="OrçaNext" className="w-8 h-8" />
              <span className="text-xl font-display font-black">
                Orça<span className="brand-text">Next</span>
              </span>
            </div>
            <p className="mt-3 text-zinc-400 text-sm">Crie. Envie. Aprove. Receba.<br/>Do orçamento ao fechamento.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-sm text-zinc-400">
            <div className="space-y-2">
              <div className="uppercase text-[11px] tracking-widest text-white font-bold">Produto</div>
              <a href="#recursos" className="block hover:text-white">Recursos</a>
              <a href="#como-funciona" className="block hover:text-white">Como funciona</a>
              <a href="#planos" className="block hover:text-white">Planos</a>
              <a href="#faq" className="block hover:text-white">FAQ</a>
            </div>
            <div className="space-y-2">
              <div className="uppercase text-[11px] tracking-widest text-white font-bold">Conta</div>
              <Link to="/login" className="block hover:text-white">Entrar</Link>
              <Link to="/register" className="block hover:text-white">Criar conta</Link>
              <Link to="/forgot-password" className="block hover:text-white">Esqueci a senha</Link>
            </div>
            <div className="space-y-2">
              <div className="uppercase text-[11px] tracking-widest text-white font-bold">Legal</div>
              <a href="#" className="block hover:text-white">Termos de Uso</a>
              <a href="#" className="block hover:text-white">Política de Privacidade</a>
              <a href="mailto:contato@orcanext.com" className="block hover:text-white">Contato</a>
              <Link to="/login" className="block hover:text-white">Suporte</Link>
            </div>
          </div>
        </div>
        <div className="mt-12 pt-6 border-t border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs text-zinc-500">
          <div>© {new Date().getFullYear()} OrçaNext — Todos os direitos reservados.</div>
          <div className="flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5" /> Feito no Brasil
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ---------- Page ---------- */
export default function Landing() {
  useEffect(() => {
    // Improve default document title/description on the landing route.
    document.title = "OrçaNext";
  }, []);
  return (
    <div className="App bg-white text-black selection:bg-[#00AD02] selection:text-white" data-testid="landing-page">
      <Header />
      <Hero />
      <Problem />
      <Transformation />
      <HowItWorks />
      <Benefits />
      <ForServiceProviders />
      <SocialProof />
      <Result />
      <Pricing />
      <MidCTA />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}
