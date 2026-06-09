import { TelemetryRecord } from '../types';
import { format } from 'date-fns';
import { motion } from 'motion/react';
import { X, Printer, Send, CheckCircle2, FileDown, ShieldAlert, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useRef, useState, useMemo } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface Props {
  data: TelemetryRecord[];
  searchedSpeed: number | null;
  onClose: () => void;
  onPDFGenerated?: (records: TelemetryRecord[]) => void;
}

export default function CMAAReport({ data, searchedSpeed, onClose, onPDFGenerated }: Props) {
  const reportRef = useRef<HTMLDivElement>(null);
  const pdfReportRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const [opinionText, setOpinionText] = useState(
    "É imprescindível a correção imediata da velocidade de operação. O respeito aos limites estabelecidos não apenas melhora drasticamente a segurança operacional, mas também evita o desgaste acentuado e quebras prematuras de componentes críticos como Tirantes, Molas e Balanças.\n\nA redução da velocidade de impacto em estradas não pavimentadas previne diretamente o surgimento de trincas estruturais nos tanques e o rompimento de grampos do equipamento, garantindo maior disponibilidade mecânica e redução de custos corretivos."
  );

  const occurrenceRanking = useMemo(() => {
    const ranking: { [key: string]: { id: string; name: string; matricula: string | number; speed: number; count: number } } = {};
    data.forEach(item => {
      const name = item.descricaoOperador || 'SEM MOTORISTA';
      if (!ranking[name]) {
        ranking[name] = {
          id: item.id,
          name: name,
          matricula: item.matricula,
          speed: item.velocidade,
          count: 0
        };
      }
      ranking[name].count += 1;
      if (item.velocidade > ranking[name].speed) {
        ranking[name].speed = item.velocidade;
      }
    });
    return Object.values(ranking).sort((a, b) => b.count - a.count);
  }, [data]);

  const speedsDetected = useMemo(() => {
    if (searchedSpeed === null) return data;
    return data.filter(item => Math.floor(item.velocidade) === searchedSpeed);
  }, [data, searchedSpeed]);

  const alertZone = useMemo(() => {
    if (searchedSpeed === null) return [];
    return data.filter(item => Math.floor(item.velocidade) === searchedSpeed + 5);
  }, [data, searchedSpeed]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    try {
      if (!pdfReportRef.current) return;
      setGenerating(true);

      // Scroll components to top or set virtual window size so PDF is fully rendered
      const canvas = await html2canvas(pdfReportRef.current, {
        scale: 2, // crisp high quality
        useCORS: true,
        backgroundColor: '#FFFFFF',
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 1200,
        windowHeight: pdfReportRef.current.scrollHeight || 1600
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const width = 210;
      const height = (canvas.height * width) / canvas.width;
      const pdf = new jsPDF('p', 'mm', [width, height]);
      
      pdf.addImage(imgData, 'JPEG', 0, 0, width, height);

      pdf.save(`RELATORIO_GCV_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
      
      // Notify parent of successful PDF generation to lock into history
      onPDFGenerated?.(data);

      alert('Relatório PDF gerado com sucesso!');
    } catch (error) {
      console.error('Erro detalhado ao gerar PDF:', error);
      alert('Houve um erro técnico ao gerar o PDF. Tentando novamente...');
    } finally {
      setGenerating(false);
    }
  };

  const getRiskInfo = (speed: number) => {
    if (speed > 70) return { label: 'Crítico', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', icon: ShieldAlert };
    if (speed >= 60) return { label: 'Alerta', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', icon: AlertTriangle };
    return { label: 'Normal', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: ShieldCheck };
  };

  const handleWhatsAppShare = () => {
    if (data.length === 0) return;

    let message = "*RELATÓRIO CMAA - ULTRAPASSAGEM*\n\n";
    message += "⚠️ Segue o resumo das ocorrências registradas:\n\n";

    data.slice(0, 10).forEach((item, index) => {
      message += `*${index + 1}. ${item.descricaoOperador}*\n`;
      message += `Código: ${item.matricula}\n`;
      message += `Data: ${format(item.dataHora, "dd/MM/yyyy HH:mm:ss")}\n`;
      message += `Velocidade: ${Number(item.velocidade).toFixed(2).replace('.', ',')} km/h\n\n`;
    });

    if (data.length > 10) message += `... e mais ${data.length - 10} registros.\n\n`;

    message += "_Gerado via QPAINEL INTELIGENTE - G.C.V PRO_";

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
    >
      <div 
        style={{ backgroundColor: '#FFFFFF' }}
        className="rounded-[32px] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
      >
        <div 
          style={{ backgroundColor: '#0F172A' }}
          className="p-8 flex items-center justify-between text-white"
        >
          <div className="flex items-center gap-8">
            <div>
              <h2 className="text-4xl font-black italic tracking-tighter leading-none">G.C.V PRO</h2>
              <p className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] mt-2">Relatório Executivo de Velocidade</p>
            </div>
            
            <div className="h-12 w-px bg-white/10 hidden md:block"></div>
            
            <div className="hidden md:flex items-center gap-3 bg-white/5 px-4 py-2 rounded-lg border border-white/10">
              <div className="w-8 h-8 rounded bg-brand/20 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M50 10L90 40L50 90L10 40L50 10Z" stroke="#3B82F6" strokeWidth="4" />
                </svg>
              </div>
              <span className="text-sm font-black tracking-widest leading-none">SOLINFTEC</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={handleDownloadPDF}
              disabled={generating}
              style={{ backgroundColor: '#DC2626' }}
              className={`px-6 h-12 rounded-2xl text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-red-600/20 active:scale-95 ${generating ? 'opacity-50' : ''}`}
            >
              {generating ? 'Exportando PDF...' : 'Gerar PDF'}
            </button>
            <button 
              onClick={onClose}
              className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all active:scale-95"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 bg-white pdf-safe" ref={reportRef} style={{ backgroundColor: '#FFFFFF' }}>
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="flex justify-between items-start mb-10 border-b border-slate-200 pb-6" style={{ borderColor: '#E2E8F0' }}>
              <div>
                <h3 className="text-xl font-bold" style={{ color: '#1E293B' }}>CMAA - Energia que Transforma</h3>
                <p className="text-xs font-bold uppercase tracking-widest mt-1" style={{ color: '#64748B' }}>G.C.V PRO - Logística Inteligente</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase" style={{ color: '#94A3B8' }}>Data do Relatório</p>
                <p className="text-sm font-bold" style={{ color: '#475569' }}>{format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-[32px] p-8 border border-blue-100 transition-all hover:shadow-md" style={{ backgroundColor: '#EFF6FF' }}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-6">Speeds Detected</p>
                    <h3 className="text-7xl font-black text-blue-700 leading-none">{speedsDetected.length}</h3>
                </div>
                <div className="rounded-[32px] p-8 border border-orange-100 transition-all hover:shadow-md" style={{ backgroundColor: '#FFF7ED' }}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-orange-600 mb-6">Alert Zone</p>
                    <h3 className="text-7xl font-black text-orange-700 leading-none">{alertZone.length}</h3>
                </div>
            </div>

            <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
                <div className="bg-[#0F172A] p-6 px-8 flex items-center justify-between text-white">
                    <h4 className="text-sm font-black uppercase tracking-widest">Detalhamento de Ocorrências</h4>
                    <h4 className="text-2xl font-black italic tracking-tighter">Estrada de Terra</h4>
                    <div className="w-20 hidden md:block"></div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="p-6 px-8 text-[10px] font-black uppercase text-slate-400 tracking-widest">Matrícula</th>
                        <th className="p-6 px-8 text-[10px] font-black uppercase text-slate-400 tracking-widest">Nome do Colaborador</th>
                        <th className="p-6 px-8 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Velocidade</th>
                        <th className="p-6 px-8 text-[10px] font-black uppercase text-slate-400 tracking-widest">Local</th>
                        <th className="p-6 px-8 text-[10px] font-black uppercase text-slate-400 tracking-widest">Data/Hora</th>
                        <th className="p-6 px-8 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Frota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((item, index) => (
                        <tr key={`${item.id}-${index}`} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <td className="p-6 px-8 text-sm font-bold text-slate-600">{item.matricula}</td>
                          <td className="p-6 px-8 text-sm font-black uppercase text-slate-900 leading-tight max-w-xs">{item.descricaoOperador}</td>
                          <td className="p-6 px-8 text-lg font-black text-blue-600 text-center">
                            {Number(item.velocidade).toFixed(2).replace('.', ',')} km/h
                          </td>
                          <td className="p-6 px-8 text-xs font-bold uppercase text-slate-400 tracking-tight leading-relaxed max-w-[200px]">{item.operacao}</td>
                          <td className="p-6 px-8 text-xs font-medium text-slate-400 tabular-nums whitespace-nowrap">
                            {format(item.dataHora, "dd/MM/yyyy HH:mm:ss")}
                          </td>
                          <td className="p-6 px-8 text-xs font-bold uppercase text-slate-900 tracking-tight leading-relaxed text-right">{item.frota || '---'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            </div>

            {/* Técnico/Segurança Observação - INTERACTIVE EDITABLE AREA */}
            <div 
                style={{ backgroundColor: '#F8FAFC', border: '2px solid #CBD5E1' }}
                className="p-8 rounded-3xl space-y-4"
            >
                <div className="flex justify-between items-center sm:flex-row flex-col gap-2">
                    <h4 style={{ color: '#0F172A' }} className="text-xs font-black uppercase tracking-[0.2em]">
                        Parecer Técnico de Engenharia / Observações do Relatório
                    </h4>
                    <span className="text-[9px] bg-blue-100 text-blue-700 font-extrabold uppercase px-2.5 py-1 rounded-full tracking-wider">
                        Editável em tempo real no PDF
                    </span>
                </div>
                
                <textarea
                    value={opinionText}
                    onChange={(e) => setOpinionText(e.target.value)}
                    style={{ border: '1px solid #CBD5E1', color: '#334155' }}
                    className="w-full h-36 p-4 rounded-2xl text-xs font-bold leading-relaxed focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none bg-white shadow-inner"
                    placeholder="Escreva aqui as observações ou parecer técnico que deseja que saia no relatório..."
                />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-white text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">
                Painel G.C.V Pro — Auditoria Digital de Teletria
            </p>
        </div>

        {/* PDF HIDDEN CLEAN AREA */}
        <div
          ref={pdfReportRef}
          style={{
            position: 'absolute',
            left: '-9999px',
            top: 0,
            width: '1200px',
            height: 'auto',
            backgroundColor: '#FFFFFF',
            padding: '40px',
            color: '#000000',
            fontFamily: "'Inter', sans-serif"
          }}
        >
          {/* Header */}
          <div
            style={{
              backgroundColor: '#0F172A',
              padding: '40px',
              borderRadius: '30px',
              marginBottom: '40px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div>
              <h1
                style={{
                  color: '#FFFFFF',
                  fontSize: '56px',
                  fontWeight: '900',
                  margin: 0,
                  letterSpacing: '-0.02em'
                }}
              >
                G.C.V PRO
              </h1>
              <p
                style={{
                  color: '#94A3B8',
                  marginTop: '8px',
                  fontSize: '20px',
                  fontWeight: '500'
                }}
              >
                Relatório Executivo de Velocidade
              </p>
            </div>
            
            {/* Logo area matching the image */}
            <div style={{ 
              backgroundColor: '#1E293B', 
              padding: '20px 40px', 
              borderRadius: '2px', 
              border: '2px solid #334155',
              display: 'flex',
              alignItems: 'center',
              gap: '20px'
            }}>
              <svg width="60" height="60" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M50 10L90 40L50 90L10 40L50 10Z" stroke="white" strokeWidth="2" />
                <path d="M10 40L90 40" stroke="white" strokeWidth="1" />
                <path d="M50 10L50 90" stroke="white" strokeWidth="1" />
                <path d="M30 25L70 25L70 65L30 65L30 25Z" stroke="white" strokeWidth="1" />
              </svg>
              <div style={{ color: 'white', fontSize: '42px', fontWeight: '900', letterSpacing: '0.1em' }}>
                SOLINFTEC
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '30px',
              marginBottom: '50px'
            }}
          >
            <div
              style={{
                backgroundColor: '#EFF6FF',
                padding: '40px',
                borderRadius: '30px',
                border: '1px solid #BFDBFE'
              }}
            >
              <h3
                style={{
                  margin: 0,
                  color: '#1E40AF',
                  fontSize: '18px',
                  fontWeight: '900',
                  letterSpacing: '0.05em'
                }}
              >
                SPEEDS DETECTED
              </h3>
              <h1
                style={{
                  marginTop: '25px',
                  fontSize: '72px',
                  color: '#1D4ED8',
                  fontWeight: '900',
                  margin: '20px 0 0 0'
                }}
              >
                {speedsDetected.length}
              </h1>
            </div>

            <div
              style={{
                backgroundColor: '#FFF7ED',
                padding: '40px',
                borderRadius: '30px',
                border: '1px solid #FFEDD5'
              }}
            >
              <h3
                style={{
                  margin: 0,
                  color: '#C2410C',
                  fontSize: '18px',
                  fontWeight: '900',
                  letterSpacing: '0.05em'
                }}
              >
                ALERT ZONE
              </h3>
              <h1
                style={{
                  marginTop: '25px',
                  fontSize: '72px',
                  color: '#EA580C',
                  fontWeight: '900',
                  margin: '20px 0 0 0'
                }}
              >
                {alertZone.length}
              </h1>
            </div>
          </div>

          {/* Table Container */}
          <div
            style={{
              borderRadius: '25px',
              overflow: 'hidden',
              marginBottom: '40px',
              border: '1px solid #E2E8F0'
            }}
          >
            {/* Table Title Bar */}
            <div
              style={{
                backgroundColor: '#0F172A',
                color: '#FFFFFF',
                padding: '30px 40px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span style={{ fontWeight: '900', fontSize: '24px' }}>Detalhamento de Ocorrências</span>
              <span style={{ fontWeight: '900', fontSize: '32px' }}>Estrada de Terra</span>
              <span style={{ width: '200px' }}></span> {/* Spacer to keep title centered */}
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#FFFFFF' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '25px 40px', textAlign: 'left', fontSize: '14px', color: '#94A3B8', fontWeight: '900' }}>MATRÍCULA</th>
                  <th style={{ padding: '25px 40px', textAlign: 'left', fontSize: '14px', color: '#94A3B8', fontWeight: '900' }}>NOME DO COLABORADOR</th>
                  <th style={{ padding: '25px 40px', textAlign: 'center', fontSize: '14px', color: '#94A3B8', fontWeight: '900' }}>VELOCIDADE</th>
                  <th style={{ padding: '25px 40px', textAlign: 'left', fontSize: '14px', color: '#94A3B8', fontWeight: '900' }}>LOCAL</th>
                  <th style={{ padding: '25px 40px', textAlign: 'left', fontSize: '14px', color: '#94A3B8', fontWeight: '900' }}>DATA/HORA</th>
                  <th style={{ padding: '25px 40px', textAlign: 'right', fontSize: '14px', color: '#94A3B8', fontWeight: '900' }}>FROTA</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item, index) => (
                  <tr key={`${item.id}-${index}`} style={{ borderBottom: '1px solid #F8FAFC' }}>
                    <td style={{ padding: '25px 40px', fontSize: '16px', fontWeight: '700', color: '#1E293B' }}>{item.matricula}</td>
                    <td style={{ padding: '25px 40px', fontSize: '16px', fontWeight: '900', textTransform: 'uppercase', color: '#0F172A' }}>{item.descricaoOperador}</td>
                    <td style={{ padding: '25px 40px', fontSize: '20px', fontWeight: '900', textAlign: 'center', color: '#2563EB' }}>
                      {Number(item.velocidade).toFixed(2).replace('.', ',')} km/h
                    </td>
                    <td style={{ padding: '25px 40px', fontSize: '14px', textTransform: 'uppercase', color: '#64748B', fontWeight: '500' }}>{item.operacao}</td>
                    <td style={{ padding: '25px 40px', fontSize: '14px', color: '#94A3B8' }}>{format(item.dataHora, "dd/MM/yyyy HH:mm:ss")}</td>
                    <td style={{ padding: '25px 40px', fontSize: '14px', fontWeight: '900', color: '#0F172A', textAlign: 'right' }}>{item.frota || '---'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Technical Opinion */}
          <div style={{ marginTop: '50px', padding: '40px', backgroundColor: '#F8FAFC', borderRadius: '30px', border: '2px solid #CBD5E1' }}>
            <h4 style={{ color: '#0F172A', fontSize: '18px', fontWeight: '900', marginBottom: '20px', letterSpacing: '0.05em' }}>PARECER TÉCNICO DE ENGENHARIA</h4>
            <div 
              style={{ 
                color: '#475569', 
                fontSize: '16px', 
                lineHeight: '1.7', 
                fontWeight: '700',
                whiteSpace: 'pre-wrap'
              }}
            >
              {opinionText}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
