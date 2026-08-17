import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowRight, FileText, Send, ShieldCheck, PenLine, Receipt, Users, Package, Wrench, Zap, Clock, Sparkles } from "lucide-react";

const HERO_IMG = "https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzNTl8MHwxfHNlYXJjaHwxfHxmcmVlbGFuY2VyJTIwd29ya2luZyUyMGxhcHRvcHxlbnwwfHx8fDE3ODY1MDE4NTB8MA&ixlib=rb-4.1.0&q=85";
const AVATAR_1 = "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA3MDR8MHwxfHNlYXJjaHwzfHxzbWlsaW5nJTIwcHJvZmVzc2lvbmFsJTIwcG9ydHJhaXR8ZW58MHx8fHwxNzg2NTAxODUwfDA&ixlib=rb-4.1.0&q=85";
const AVATAR_2 = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA3MDR8MHwxfHNlYXJjaHwyfHxzbWlsaW5nJTIwcHJvZmVzc2lvbmFsJTIwcG9ydHJhaXR8ZW58MHx8fHwxNzg2NTAxODUwfDA&ixlib=rb-4.1.0&q=85";

function Header() {
  return (
    <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-xl border-b border-zinc-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2" data-testid="header-logo">
          <span className="w-8 h-8 rounded-md brand-bg flex items-center justify-center text-white font-black">O</span>
          <span className="text-xl font-display font-extrabold">Orça<span className="brand-text">Next</span></span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-700">
          <a href="#recursos" className="hover:text-black">Recursos</a>
          <a href="#como-funciona" className="hover:text-black">Como funciona</a>
          <a href="#planos" className="hover:text-black">Planos</a>
          <a href="#depoimentos" className="hover:text-black">Depoimentos</a>
          <a href="#faq" className="hover:text-black">FAQ</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link to="/login" data-testid="header-login-link" className="text-sm font-semibold hidden sm:inline-block">Entrar</Link>
          <Link to="/register" data-testid="header-cta">
            <Button className="brand-bg hover:bg-[#008a02] text-white font-semibold">COMEÇAR GRÁTIS</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 subtle-grid opacity-70 pointer-events-none" />
      <div className="max-w-7xl mx-auto px-6 py-16 md:py-28 grid md:grid-cols-2 gap-14 items-center">
        <div className="fade-up">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 mb-6">
            <span className="w-2 h-2 rounded-full brand-bg" /> Do orçamento ao fechamento
          </div>
          <h1 className="font-display font-black text-5xl sm:text-6xl lg:text-7xl leading-[0.95] tracking-tighter text-black">
            Crie, envie e aprove seus orçamentos <span className="brand-text">em poucos minutos.</span>
          </h1>
          <p className="mt-6 text-lg text-zinc-600 leading-relaxed max-w-xl">
            Com o OrçaNext, você cria orçamentos profissionais, envia por link ou PDF, recebe a aprovação do cliente, coleta aceite eletrônico e organiza seus recebimentos.
          </p>
          <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 max-w-xl">
            <p className="text-sm text-zinc-700"><b className="text-black">Comece grátis com até 15 orçamentos por mês.</b></p>
            <p className="text-sm text-zinc-600 mt-1">Precisa de mais? Tenha <b className="brand-text">orçamentos ilimitados por R$ 49,90/mês</b>.</p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/register" data-testid="hero-cta-primary">
              <Button className="brand-bg hover:bg-[#008a02] text-white font-bold px-7 h-12 text-base">COMEÇAR GRÁTIS <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </Link>
            <a href="#planos" data-testid="hero-cta-secondary">
              <Button variant="outline" className="h-12 px-7 border-black text-black font-bold hover:bg-zinc-50">QUERO ORÇAMENTOS ILIMITADOS</Button>
            </a>
          </div>
          <div className="mt-8 flex items-center gap-6 text-sm text-zinc-500">
            <div className="flex items-center gap-2"><Check className="w-4 h-4 brand-text" /> 15 orçamentos/mês grátis</div>
            <div className="flex items-center gap-2"><Check className="w-4 h-4 brand-text" /> Sem cartão</div>
          </div>
        </div>
        <div className="relative">
          <div className="absolute -top-8 -left-8 w-64 h-64 brand-bg rounded-2xl opacity-10 blur-3xl" />
          <div className="relative bg-white border border-zinc-200 rounded-2xl p-6 shadow-xl fade-up">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-zinc-500">Orçamento</div>
                <div className="text-2xl font-display font-extrabold">Nº 2026-0042</div>
              </div>
              <Badge className="bg-[#00AD02] text-white rounded-md">APROVADO</Badge>
            </div>
            <div className="rounded-lg border border-zinc-200 divide-y divide-zinc-100">
              {[["Instalação de painel solar 5kWp", "1", "R$ 18.900,00"], ["Consultoria técnica", "3h", "R$ 750,00"], ["Suporte pós-instalação", "1", "R$ 490,00"]].map((r, i) => (
                <div key={i} className="grid grid-cols-6 items-center px-4 py-3 text-sm">
                  <div className="col-span-3 font-medium text-black">{r[0]}</div>
                  <div className="col-span-1 text-zinc-500">{r[1]}</div>
                  <div className="col-span-2 text-right font-semibold">{r[2]}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-between items-center border-t border-zinc-200 pt-4">
              <span className="text-sm text-zinc-500">Total</span>
              <span className="text-3xl font-display font-black brand-text">R$ 20.140,00</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="text-xs bg-zinc-100 rounded-md py-2 text-center font-semibold">ENVIADO</div>
              <div className="text-xs bg-zinc-200 rounded-md py-2 text-center font-semibold">VISUALIZADO</div>
              <div className="text-xs brand-bg text-white rounded-md py-2 text-center font-semibold">ASSINADO</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Problem() {
  const items = ["Word e Excel confusos", "PDFs manuais demorados", "WhatsApp desorganizado", "Sem acompanhamento de aprovação", "Sem aceite formal do cliente", "Documentos pouco profissionais"];
  return (
    <section className="bg-zinc-50 border-y border-zinc-200 py-20">
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-2xl">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 mb-3">O problema</div>
          <h2 className="font-display text-4xl md:text-5xl font-black tracking-tight">Fazer orçamento não deveria ser complicado.</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4 mt-10">
          {items.map((t, i) => (
            <div key={i} className="bg-white border border-zinc-200 rounded-xl p-5">
              <div className="text-2xl font-display font-black text-zinc-300">0{i+1}</div>
              <div className="mt-2 font-semibold">{t}</div>
            </div>
          ))}
        </div>
        <div className="mt-10 flex items-center gap-3">
          <div className="w-10 h-1 brand-bg rounded-full" />
          <p className="text-xl font-display font-bold">O OrçaNext resolve isso em um só lugar.</p>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { icon: Users, t: "Cadastre o cliente" },
    { icon: Package, t: "Adicione produtos e serviços" },
    { icon: FileText, t: "Crie o orçamento" },
    { icon: Send, t: "Envie por link ou PDF" },
    { icon: ShieldCheck, t: "Cliente aprova" },
    { icon: PenLine, t: "Aceite eletrônico" },
    { icon: Receipt, t: "Pagamento & recibo" },
  ];
  return (
    <section id="como-funciona" className="py-20">
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-2xl">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 mb-3">Como funciona</div>
          <h2 className="font-display text-4xl md:text-5xl font-black tracking-tight">Do orçamento ao fechamento, tudo em um só lugar.</h2>
        </div>
        <div className="mt-10 grid md:grid-cols-7 gap-3">
          {steps.map((s, i) => (
            <div key={i} className="bg-white border border-zinc-200 rounded-xl p-4 flex md:flex-col items-center md:items-start gap-3 hover-lift">
              <div className="w-9 h-9 rounded-md brand-bg text-white flex items-center justify-center"><s.icon className="w-4 h-4" /></div>
              <div className="text-sm font-semibold leading-tight">{s.t}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Benefits() {
  return (
    <section id="recursos" className="bg-black text-white py-20">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400 mb-3">Benefícios</div>
        <h2 className="font-display text-4xl md:text-5xl font-black tracking-tight text-white">Feito para quem vende com profissionalismo.</h2>
        <div className="mt-10 grid md:grid-cols-4 gap-4">
          <div className="md:row-span-2 md:col-span-2 bg-[#00AD02] rounded-2xl p-8 flex flex-col justify-between min-h-[300px]">
            <Zap className="w-10 h-10" />
            <div>
              <div className="font-display text-3xl font-black">Rapidez extrema</div>
              <p className="mt-3 text-white/90 max-w-md">Crie um orçamento completo em menos de 2 minutos. Pesquisa em tempo real de produtos e serviços cadastrados.</p>
            </div>
          </div>
          {[
            { i: Sparkles, t: "Profissionalismo", d: "Documentos com aparência premium." },
            { i: Send, t: "Praticidade", d: "Compartilhe por link ou PDF." },
            { i: ShieldCheck, t: "Aprovação", d: "Cliente aprova online." },
            { i: PenLine, t: "Aceite eletrônico", d: "Assinatura no próprio orçamento." },
            { i: Wrench, t: "Organização", d: "Clientes, produtos e serviços centralizados." },
            { i: Receipt, t: "Recibos", d: "Registre pagamentos e gere recibos." },
          ].map((b, i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover-lift">
              <b.i className="w-7 h-7 brand-text" />
              <div className="mt-4 font-display font-extrabold text-lg">{b.t}</div>
              <div className="text-sm text-zinc-400 mt-1">{b.d}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="planos" className="py-20 bg-zinc-50 border-y border-zinc-200">
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-2xl">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 mb-3">Planos</div>
          <h2 className="font-display text-4xl md:text-5xl font-black tracking-tight">Escolha o plano ideal para o seu negócio</h2>
          <p className="mt-3 text-zinc-600 text-lg">Comece grátis e evolua quando precisar.</p>
        </div>
        <div className="mt-10 grid md:grid-cols-2 gap-6">
          {/* Gratuito */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-8" data-testid="pricing-free-card">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Gratuito</div>
            <div className="mt-2 flex items-baseline gap-2">
              <div className="font-display text-5xl font-black">R$ 0</div>
              <div className="text-zinc-500">/para começar</div>
            </div>
            <div className="text-zinc-500 mt-1">Perfeito para dar os primeiros passos.</div>
            <div className="mt-6 space-y-2 text-sm">
              {[
                "Até 15 orçamentos por mês",
                "Cadastro de clientes",
                "Cadastro de produtos",
                "Cadastro de serviços",
                "Pesquisa de produtos e serviços",
                "Link público",
                "PDF",
                "Aprovação online",
                "Assinatura eletrônica",
                "Recursos básicos",
                "Marca d'água “Criado com OrçaNext”",
              ].map((f) => (
                <div key={f} className="flex gap-2"><Check className="w-4 h-4 brand-text mt-0.5" /><span>{f}</span></div>
              ))}
            </div>
            <Link to="/register" className="block mt-8" data-testid="pricing-free-cta">
              <Button variant="outline" className="w-full h-11 border-black font-bold">COMEÇAR GRÁTIS</Button>
            </Link>
          </div>

          {/* Profissional */}
          <div className="relative bg-black text-white rounded-2xl p-8 border-2 border-[#00AD02]" data-testid="pricing-pro-card">
            <div className="absolute -top-3 right-6"><Badge className="brand-bg text-white rounded-md">MAIS ESCOLHIDO</Badge></div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">Profissional</div>
            <div className="mt-2 flex items-baseline gap-2">
              <div className="font-display text-6xl font-black !text-white leading-none" data-testid="pricing-pro-price">R$ 49,90</div>
              <div className="text-zinc-400 text-lg">/mês</div>
            </div>
            <div className="text-zinc-400 mt-2">ou R$ 478,80/ano (equivalente a R$ 39,90/mês)</div>
            <p className="mt-4 text-white/90">Orçamentos ilimitados para quem quer crescer.</p>
            <div className="mt-6 space-y-2 text-sm">
              {[
                "Orçamentos ilimitados",
                "Clientes ilimitados",
                "Produtos ilimitados",
                "Serviços ilimitados",
                "Modelos ilimitados",
                "Recibos ilimitados",
                "Sem marca d'água",
                "PDF profissional",
                "Modelo vertical",
                "Modelo horizontal",
                "Personalização",
                "Aprovação online",
                "Assinatura eletrônica",
              ].map((f) => (
                <div key={f} className="flex gap-2"><Check className="w-4 h-4 brand-text mt-0.5" /><span>{f}</span></div>
              ))}
            </div>
            <Link to="/register" className="block mt-8" data-testid="pricing-pro-cta">
              <Button className="w-full h-12 brand-bg hover:bg-[#008a02] text-white font-bold text-base">QUERO SER PROFISSIONAL</Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function UpgradeCallout() {
  return (
    <section className="py-16 bg-white">
      <div className="max-w-4xl mx-auto px-6">
        <div className="relative overflow-hidden rounded-3xl bg-black text-white p-10 md:p-14 border-2 border-[#00AD02]">
          <div className="absolute -right-20 -top-20 w-72 h-72 brand-bg opacity-20 blur-3xl rounded-full pointer-events-none" />
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#00AD02] mb-3">Evolua quando precisar</div>
          <h2 className="font-display text-3xl md:text-5xl font-black tracking-tight !text-white">15 orçamentos por mês são suficientes para começar.</h2>
          <p className="mt-4 text-zinc-300 text-lg max-w-2xl">Quando seu negócio crescer, você não precisa mudar de ferramenta. Basta evoluir para o <b className="text-white">OrçaNext Profissional</b>.</p>
          <div className="mt-6 flex items-baseline gap-3">
            <div className="font-display text-5xl md:text-6xl font-black brand-text leading-none">R$ 49,90</div>
            <div className="text-zinc-300 text-lg">/mês</div>
          </div>
          <p className="mt-1 text-zinc-400">Orçamentos ilimitados.</p>
          <a href="#planos" data-testid="upgrade-callout-cta" className="inline-block mt-8">
            <Button className="brand-bg hover:bg-[#008a02] text-white font-bold h-12 px-8 text-base">QUERO ORÇAMENTOS ILIMITADOS <ArrowRight className="ml-2 h-4 w-4" /></Button>
          </a>
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  const t = [
    { n: "Marina Rocha", r: "Arquiteta autônoma", q: "Antes eu perdia horas fazendo orçamento no Word. Hoje mando um link e o cliente já aprova.", a: AVATAR_1 },
    { n: "Carla Duarte", r: "Prestadora de serviços", q: "O aceite eletrônico deu credibilidade ao meu trabalho. Fecho mais rápido, com menos atrito.", a: AVATAR_2 },
  ];
  return (
    <section id="depoimentos" className="py-20">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 mb-3">Depoimentos</div>
        <h2 className="font-display text-4xl md:text-5xl font-black tracking-tight">Feito para pequenos negócios.</h2>
        <div className="mt-10 grid md:grid-cols-2 gap-6">
          {t.map((x, i) => (
            <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-8 hover-lift">
              <p className="text-lg font-display font-semibold leading-snug">&ldquo;{x.q}&rdquo;</p>
              <div className="mt-6 flex items-center gap-3">
                <img src={x.a} alt={x.n} className="w-10 h-10 rounded-full object-cover" />
                <div>
                  <div className="font-semibold">{x.n}</div>
                  <div className="text-xs text-zinc-500">{x.r}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const faqs = [
    ["O que é o OrçaNext?", "Um SaaS brasileiro para criar, enviar, aprovar e receber aceite eletrônico de orçamentos profissionais."],
    ["Preciso instalar alguma coisa?", "Não. É totalmente online, acessível pelo navegador em qualquer dispositivo."],
    ["Posso usar pelo celular?", "Sim. A interface é 100% responsiva para desktop, tablet e smartphone."],
    ["Posso enviar orçamento pelo WhatsApp?", "Sim. Cada orçamento gera um link público para compartilhar por WhatsApp, e-mail ou onde preferir."],
    ["Quantos orçamentos posso criar gratuitamente?", "O plano gratuito permite criar até 15 novos orçamentos por mês."],
    ["O limite de 15 orçamentos é mensal?", "Sim. O limite é renovado a cada ciclo mensal."],
    ["O que acontece quando eu atingir 15 orçamentos?", "Você continuará podendo acessar e gerenciar seus orçamentos existentes, mas precisará aguardar o próximo ciclo mensal ou migrar para o plano Profissional para criar novos orçamentos."],
    ["Posso criar orçamentos ilimitados?", "Sim. O plano Profissional permite criar orçamentos ilimitados."],
    ["Quanto custa o plano Profissional?", "O plano Profissional custa R$ 49,90 por mês ou R$ 478,80 por ano."],
    ["Posso gerar recibos?", "Sim, no plano Profissional você pode emitir recibos ilimitados em PDF."],
    ["Posso cancelar?", "Sim, a qualquer momento. Seus dados permanecem preservados mesmo em caso de downgrade."],
  ];
  return (
    <section id="faq" className="py-20 bg-zinc-50 border-t border-zinc-200">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 mb-3">FAQ</div>
        <h2 className="font-display text-4xl md:text-5xl font-black tracking-tight">Perguntas frequentes.</h2>
        <Accordion type="single" collapsible className="mt-8" data-testid="faq-accordion">
          {faqs.map(([q, a], i) => (
            <AccordionItem key={i} value={`q${i}`} className="border-zinc-200">
              <AccordionTrigger className="text-left font-display font-bold text-lg hover:no-underline">{q}</AccordionTrigger>
              <AccordionContent className="text-zinc-600">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <h2 className="font-display font-black text-4xl md:text-6xl tracking-tighter">Pronto para transformar seus orçamentos em negócios fechados?</h2>
        <p className="mt-4 text-zinc-600 text-lg">Comece gratuitamente com até 15 orçamentos por mês. Quando precisar de mais, tenha orçamentos ilimitados por apenas <b className="brand-text">R$ 49,90/mês</b>.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/register" data-testid="final-cta">
            <Button className="brand-bg hover:bg-[#008a02] text-white font-bold h-14 px-10 text-base">COMEÇAR GRÁTIS <ArrowRight className="ml-2 h-4 w-4" /></Button>
          </Link>
          <a href="#planos" data-testid="final-cta-secondary">
            <Button variant="outline" className="h-14 px-10 border-black text-black font-bold hover:bg-zinc-50 text-base">QUERO ORÇAMENTOS ILIMITADOS</Button>
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-black text-white py-14">
      <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between gap-8">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-md brand-bg flex items-center justify-center font-black">O</span>
            <span className="text-xl font-display font-extrabold">OrçaNext</span>
          </div>
          <p className="mt-3 text-zinc-400 text-sm max-w-xs">Crie. Envie. Aprove. Receba. Do orçamento ao fechamento.</p>
        </div>
        <div className="grid grid-cols-2 gap-8 text-sm text-zinc-400">
          <div className="space-y-2">
            <div className="uppercase text-xs tracking-widest text-white font-bold">Produto</div>
            <a href="#recursos" className="block hover:text-white">Recursos</a>
            <a href="#como-funciona" className="block hover:text-white">Como funciona</a>
            <a href="#planos" className="block hover:text-white">Planos</a>
            <a href="#faq" className="block hover:text-white">FAQ</a>
          </div>
          <div className="space-y-2">
            <div className="uppercase text-xs tracking-widest text-white font-bold">Legal</div>
            <a href="#" className="block hover:text-white">Termos de Uso</a>
            <a href="#" className="block hover:text-white">Política de Privacidade</a>
            <Link to="/login" className="block hover:text-white">Entrar</Link>
          </div>
        </div>
      </div>
      <div className="mt-10 text-center text-xs text-zinc-500">© {new Date().getFullYear()} OrçaNext</div>
    </footer>
  );
}

export default function Landing() {
  return (
    <div className="App" data-testid="landing-page">
      <Header />
      <Hero />
      <Problem />
      <HowItWorks />
      <Benefits />
      <UpgradeCallout />
      <Pricing />
      <Testimonials />
      <FAQ />
      <CTA />
      <Footer />
    </div>
  );
}
