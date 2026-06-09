import { motion } from 'motion/react';
import { Shield, Zap, BarChart, ChevronRight, Building2, Layout, Lock, Globe, Gauge } from 'lucide-react';
import { useState } from 'react';

interface LandingPageProps {
  onStart: () => void;
}

export default function LandingPage({ onStart }: LandingPageProps) {
  const [view, setView] = useState<'landing' | 'about'>('landing');

  return (
    <div className="h-screen bg-background text-white font-sans overflow-hidden flex flex-col">
      {/* Navbar */}
      <nav className="h-16 border-b border-white/5 flex items-center justify-between px-8 md:px-20 bg-background/80 backdrop-blur-xl z-50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center">
            <Building2 size={18} className="text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight">G.C.V <span className="text-brand">Pro</span></span>
        </div>
        <div className="flex items-center gap-8 text-sm font-medium text-slate-400">
          <button 
            onClick={() => setView(view === 'landing' ? 'about' : 'landing')} 
            className="hover:text-brand transition-colors cursor-pointer text-sm font-medium"
          >
            {view === 'landing' ? 'Sobre' : 'Início'}
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 relative overflow-hidden py-4">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-full bg-brand/10 blur-[120px] rounded-full -z-10" />
        
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <motion.div
            key={view === 'landing' ? 'badge-landing' : 'badge-about'}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/10 border border-brand/20 text-brand text-[10px] font-bold tracking-widest uppercase mb-1"
          >
            <Zap size={12} />
            <span>{view === 'landing' ? 'A Próxima Geração de Gestão' : 'Sobre o Projeto G.C.V'}</span>
          </motion.div>
          
          <motion.div
            key={view === 'landing' ? 'card-landing' : 'card-about'}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.05 }}
            className="relative w-full max-w-2xl md:max-w-3xl mx-auto rounded-[32px] overflow-hidden border border-white/10 shadow-[0_0_60px_rgba(29,78,216,0.12)] group min-h-[320px] md:min-h-[350px] flex flex-col items-center justify-center"
          >
            {/* Background Texture/Image */}
            <div className="absolute inset-0 bg-[#06142e]">
              <img 
                src="https://images.unsplash.com/photo-1555252333-978fead0b0f0?q=80&w=2070&auto=format&fit=crop" 
                className="w-full h-full object-cover opacity-60 grayscale brightness-35 contrast-125 group-hover:scale-105 transition-transform duration-700"
                alt="Truck routing visual background"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-[#06142e]/70 mix-blend-multiply" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#06142e] via-transparent to-transparent" />
            </div>

            {/* Conditionally rendered Content Container */}
            {view === 'landing' ? (
              <div className="relative z-10 py-4 px-4 flex flex-col items-center text-center gap-3 w-full">
                {/* SVG Speedometer - Digital High-Tech Version */}
                <div className="w-36 h-36 md:w-44 md:h-44 relative flex items-center justify-center">
                  <div className="absolute inset-0 bg-brand/10 blur-[60px] rounded-full" />
                  <svg viewBox="0 0 200 200" className="w-full h-full relative z-10 drop-shadow-[0_0_10px_rgba(59,130,246,0.6)]">
                    {/* Outer Glow Ring */}
                    <circle cx="100" cy="100" r="95" fill="none" stroke="rgba(59,130,246,0.05)" strokeWidth="1" />
                    
                    {/* Background Track with segments */}
                    <path 
                      d="M 50 165 A 75 75 0 1 1 150 165" 
                      fill="none" 
                      stroke="rgba(255,255,255,0.05)" 
                      strokeWidth="12" 
                      strokeLinecap="round" 
                      strokeDasharray="2 4"
                    />

                    {/* Main Glow Track (Animated) */}
                    <motion.path 
                      d="M 50 165 A 75 75 0 1 1 150 165" 
                      fill="none" 
                      stroke="#3B82F6" 
                      strokeWidth="10" 
                      strokeLinecap="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 0.75 }}
                      transition={{ duration: 2, ease: "easeInOut", repeat: Infinity, repeatType: "reverse" }}
                      style={{ filter: 'blur(3px)', opacity: 0.6 } as any}
                    />

                    {/* Sharp Progress Arc (Animated) */}
                    <motion.path 
                      d="M 50 165 A 75 75 0 1 1 150 165" 
                      fill="none" 
                      stroke="#60A5FA" 
                      strokeWidth="8" 
                      strokeLinecap="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 0.75 }}
                      transition={{ duration: 2, ease: "easeInOut", repeat: Infinity, repeatType: "reverse" }}
                    />

                    {/* Scale Ticks */}
                    {[...Array(11)].map((_, i) => {
                      const angle = (i * 24) - 210;
                      const cos = Math.cos((angle * Math.PI) / 180);
                      const sin = Math.sin((angle * Math.PI) / 180);
                      const x1 = 100 + 60 * cos;
                      const y1 = 100 + 60 * sin;
                      const x2 = 100 + 68 * cos;
                      const y2 = 100 + 68 * sin;
                      return (
                        <line 
                          key={i} 
                          x1={x1} y1={y1} x2={x2} y2={y2} 
                          stroke="rgba(255,255,255,0.2)" 
                          strokeWidth="2" 
                        />
                      );
                    })}

                    {/* Inner Rotating Ring */}
                    <motion.circle 
                      cx="100" cy="100" r="50" 
                      fill="none" 
                      stroke="rgba(59,130,246,0.1)" 
                      strokeWidth="1" 
                      strokeDasharray="10 20"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                      style={{ originX: '100px', originY: '100px' } as any}
                    />

                    {/* Digital Display */}
                    <g className="font-mono">
                      <motion.text 
                        x="100" y="105" 
                        textAnchor="middle" 
                        fill="white" 
                        fontSize="36" 
                        fontWeight="900"
                        animate={{ opacity: [1, 0.7, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        85.4
                      </motion.text>
                      <text 
                        x="100" y="125" 
                        textAnchor="middle" 
                        fill="#60A5FA" 
                        fontSize="12" 
                        fontWeight="bold" 
                        className="uppercase tracking-[0.3em]"
                      >
                        KM/H
                      </text>
                    </g>
                  </svg>
                </div>

                {/* Logo Content - Centered */}
                <div className="flex flex-col items-center space-y-0 max-w-2xl">
                  <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white leading-[0.8] mb-2 font-sans">
                    G.<span className="text-brand">C</span>.V
                  </h1>
                  <h2 className="text-lg md:text-2xl font-black uppercase tracking-[0.05em] text-white">
                    GESTÃO E CONTROLE DE VELOCIDADE
                  </h2>
                  <p className="text-slate-300 text-xs md:text-sm font-medium mt-1">
                    Mais segurança, mais controle, melhores resultados.
                  </p>
                </div>
              </div>
            ) : (
              <div className="relative z-10 w-full h-full flex flex-col text-left py-6 px-6 md:px-10">
                {/* Header title inside the card */}
                <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-brand/20 border border-brand/30 flex items-center justify-center">
                      <Building2 size={16} className="text-brand" />
                    </div>
                    <div>
                      <h3 className="text-lg md:text-xl font-bold text-white tracking-tight leading-tight">
                        Sobre o G.C.V
                      </h3>
                      <p className="text-[10px] md:text-xs text-brand font-semibold tracking-wider uppercase">
                        Gestão e Controle de Velocidade
                      </p>
                    </div>
                  </div>
                  <span className="hidden sm:inline-block text-[10px] font-mono px-2.5 py-1 rounded bg-brand/10 border border-brand/20 text-brand font-bold uppercase tracking-widest">
                    Institucional
                  </span>
                </div>

                {/* Grid Areas scrollable to make sure there is NO window scrolling */}
                <div className="flex-1 overflow-y-auto max-h-[220px] md:max-h-[280px] pr-2 space-y-4 text-xs md:text-sm text-slate-300 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Missão */}
                    <div className="p-3 bg-white/5 border border-white/5 rounded-2xl relative overflow-hidden group/item">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Shield className="text-brand shrink-0" size={16} />
                        <h4 className="font-bold text-white uppercase tracking-wider text-xs">Missão</h4>
                      </div>
                      <p className="leading-relaxed text-slate-300 text-xs text-justify">
                        Diminuir os riscos de acidentes, reduzir o consumo de combustível, evitar a quebra dos equipamentos e garantir mais segurança para todos nas estradas.
                      </p>
                    </div>

                    {/* Valores */}
                    <div className="p-3 bg-white/5 border border-white/5 rounded-2xl relative overflow-hidden group/item">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Zap className="text-brand shrink-0" size={16} />
                        <h4 className="font-bold text-white uppercase tracking-wider text-xs">Valores</h4>
                      </div>
                      <p className="leading-relaxed text-slate-300 text-xs text-justify">
                        Valorizamos o bem maior: os colaboradores e os usuários das rodovias. Nosso compromisso é com a vida, a responsabilidade e a inovação.
                      </p>
                    </div>
                  </div>

                  {/* História */}
                  <div className="p-3 bg-white/5 border border-white/5 rounded-2xl">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Building2 className="text-brand shrink-0" size={16} />
                      <h4 className="font-bold text-white uppercase tracking-wider text-xs">História</h4>
                    </div>
                    <p className="leading-relaxed text-slate-200 text-xs text-justify">
                      Este aplicativo nasceu da necessidade de enfrentar o alto índice de acidentes e incidentes nas estradas próximas às unidades, trazendo uma solução prática e tecnológica para aumentar a segurança.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Benefícios */}
                    <div className="p-3 bg-white/5 border border-white/5 rounded-2xl">
                      <div className="flex items-center gap-2 mb-2">
                        <Gauge className="text-brand shrink-0" size={16} />
                        <h4 className="font-bold text-white uppercase tracking-wider text-xs">Benefícios</h4>
                      </div>
                      <ul className="space-y-1.5 text-slate-300 text-[11px] md:text-xs">
                        <li className="flex items-start gap-2">
                          <span className="text-brand text-xs font-bold shrink-0">✓</span>
                          <span>Redução de quebras nos equipamentos</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-brand text-xs font-bold shrink-0">✓</span>
                          <span>Diminuição do consumo de combustível</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-brand text-xs font-bold shrink-0">✓</span>
                          <span>Mais controle e tranquilidade para motoristas e gestores</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-brand text-xs font-bold shrink-0">✓</span>
                          <span>Resultados melhores e sustentáveis para empresas e usuários</span>
                        </li>
                      </ul>
                    </div>

                    {/* Visão de Futuro */}
                    <div className="p-3 bg-white/5 border border-white/5 rounded-2xl">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Globe className="text-brand shrink-0" size={16} />
                        <h4 className="font-bold text-white uppercase tracking-wider text-xs">Visão de Futuro</h4>
                      </div>
                      <p className="leading-relaxed text-slate-300 text-xs text-justify">
                        Conscientizar cada vez mais os novos motoristas sobre a importância das boas práticas nas estradas, formando uma geração responsável e comprometida com a segurança.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
          
          <motion.div 
            key={view === 'landing' ? 'actions-landing' : 'actions-about'}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2"
          >
            {view === 'landing' ? (
              <button 
                onClick={onStart}
                className="w-full sm:w-auto px-6 py-3 bg-brand hover:bg-brand/90 text-white rounded-full font-bold text-base shadow-2xl shadow-brand/20 flex items-center justify-center gap-2 group transition-all cursor-pointer"
                id="btn-hero-cta"
              >
                Começar Agora
                <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
            ) : (
              <button 
                onClick={() => setView('landing')}
                className="w-full sm:w-auto px-6 py-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 backdrop-blur-md rounded-full font-bold text-base flex items-center justify-center gap-2 group transition-all cursor-pointer"
                id="btn-back-landing"
              >
                Voltar
              </button>
            )}
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-4 border-t border-white/5 px-8 shrink-0 bg-background">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-brand flex items-center justify-center">
              <Building2 size={14} className="text-white" />
            </div>
            <span className="font-bold text-sm tracking-tight">G.C.V <span className="text-brand">Pro</span></span>
          </div>
          <p className="text-slate-500 text-xs text-center md:text-left">© 2024 G.C.V Pro. Todos os direitos reservados.</p>
          <div className="flex gap-4 text-slate-400 text-xs">
            <a href="#" className="hover:text-brand transition-colors">Privacidade</a>
            <a href="#" className="hover:text-brand transition-colors">Termos</a>
            <a href="#" className="hover:text-brand transition-colors">Contato</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

