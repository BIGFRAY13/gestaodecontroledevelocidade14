import { TelemetryRecord, CorrectiveAction } from '../types';
import { format } from 'date-fns';
import { motion } from 'motion/react';
import { X, ShieldAlert, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useRef, useState, useMemo } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface Props {
  data: TelemetryRecord[];
  searchedSpeed: number | null;
  onClose: () => void;
  onPDFGenerated?: (records: TelemetryRecord[]) => void;
  correctiveActions?: CorrectiveAction[];
}

export default function CMAAReport({ 
  data, 
  searchedSpeed, 
  onClose, 
  onPDFGenerated,
  correctiveActions = []
}: Props) {
  const reportRef = useRef<HTMLDivElement>(null);
  const pdfReportRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const [opinionText, setOpinionText] = useState(
    "É imprescindível a correção imediata da velocidade de operação. O respeito aos limites estabelecidos não apenas melhora drasticamente a segurança operacional, mas também evita o desgaste acentuado e quebras prematuras de componentes críticos como Tirantes, Molas e Balanças.\n\nA redução da velocidade de impacto em estradas não pavimentadas previne diretamente o surgimento de trincas estruturais nos tanques e o rompimento de grampos do equipamento, garantindo maior disponibilidade mecânica e redução de custos corretivos."
  );

  // Helper to obtain Computed status of occurrence based on registered actions
  const getOccurrenceStatus = (id: string) => {
    const relevantActions = correctiveActions.filter(act => act.occurrenceId === id);
    if (relevantActions.length === 0) return { label: 'PENDENTE', color: 'text-red-600 bg-red-100 border-red-200' };
    
    // Check if "Encerrado" is selected within actionTypes list
    const isClosed = relevantActions.some(act => act.actionTypes.includes('Encerrado'));
    if (isClosed) return { label: 'CONCLUÍDA', color: 'text-emerald-700 bg-emerald-100 border-emerald-200' };
    
    return { label: 'EM TRATATIVA', color: 'text-amber-700 bg-amber-100 border-amber-200' };
  };

  const getOccurrenceActionsSummary = (id: string) => {
    const relevantActions = correctiveActions.filter(act => act.occurrenceId === id);
    if (relevantActions.length === 0) return 'Nenhuma';
    return relevantActions.map(r => r.actionTypes.join(', ')).join(' | ');
  };

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

  const handleDownloadPDF = async () => {
    try {
      if (!pdfReportRef.current) return;
      setGenerating(true);

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

  // Module 02 - Calculate operator risk index inside the report active list
  const operatorRiskIndexLocal = useMemo(() => {
    const countsMap = new Map<string, { name: string; matricula: string; count: number; maxSpeed: number }>();
    
    data.forEach(r => {
      const driverName = r.descricaoOperador ? String(r.descricaoOperador).trim().toUpperCase() : 'SEM MOTORISTA';
      const driverMat = r.matricula ? String(r.matricula).split('.')[0].replace(/^0+/, '').trim() : '---';
      const key = driverMat || driverName;
      
      const stats = countsMap.get(key) || { name: driverName, matricula: driverMat, count: 0, maxSpeed: 0 };
      countsMap.set(key, {
        name: driverName,
        matricula: driverMat,
        count: stats.count + 1,
        maxSpeed: Math.max(stats.maxSpeed, r.velocidade)
      });
    });

    return Array.from(countsMap.values()).map(o => {
      let riskLevel: 'ALTO' | 'MÉDIO' | 'BAIXO' = 'BAIXO';
      let riskColor = 'text-green-600 bg-green-50 border-green-200';
      if (o.count > 5) {
        riskLevel = 'ALTO';
        riskColor = 'text-red-600 bg-red-50 border-red-200';
      } else if (o.count >= 3) {
        riskLevel = 'MÉDIO';
        riskColor = 'text-amber-600 bg-amber-50 border-amber-200';
      }
      return { ...o, riskLevel, riskColor };
    }).sort((a, b) => b.count - a.count);
  }, [data]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm"
    >
      <div 
        style={{ backgroundColor: '#FFFFFF' }}
        className="rounded-[32px] w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200"
      >
        <div 
          style={{ backgroundColor: '#0F172A' }}
          className="p-8 flex items-center justify-between text-white border-b border-white/5"
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

          <div className="flex items-center gap-3">
            <button 
              onClick={handleDownloadPDF}
              disabled={generating}
              style={{ backgroundColor: '#DC2626' }}
              className={`px-6 h-12 rounded-2xl text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-red-600/20 active:scale-95 cursor-pointer flex items-center gap-2 ${generating ? 'opacity-50' : ''}`}
            >
              {generating ? 'Exportando PDF...' : 'Gerar PDF'}
            </button>
            <button 
              onClick={onClose}
              className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all active:scale-95 cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 bg-white pdf-safe" ref={reportRef} style={{ backgroundColor: '#FFFFFF' }}>
          <div className="max-w-4xl mx-auto space-y-8">
            
            {/* Report Header Logo */}
            <div className="flex justify-between items-start mb-6 border-b border-slate-200 pb-6" style={{ borderColor: '#E2E8F0' }}>
              <div>
                <h3 className="text-xl font-bold" style={{ color: '#1E293B' }}>CMAA - Energia que Transforma</h3>
                <p className="text-xs font-bold uppercase tracking-widest mt-1" style={{ color: '#64748B' }}>G.C.V PRO - Logística Inteligente</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase" style={{ color: '#94A3B8' }}>Data do Relatório</p>
                <p className="text-sm font-bold" style={{ color: '#475569' }}>{format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-[32px] p-8 border border-blue-100 transition-all hover:shadow-md" style={{ backgroundColor: '#EFF6FF' }}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-4 font-bold">Speeds Detected</p>
                    <h3 className="text-6xl font-black text-blue-700 leading-none">{speedsDetected.length}</h3>
                </div>
                <div className="rounded-[32px] p-8 border border-orange-100 transition-all hover:shadow-md" style={{ backgroundColor: '#FFF7ED' }}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-orange-600 mb-4 font-bold">Alert Zone</p>
                    <h3 className="text-6xl font-black text-orange-700 leading-none">{alertZone.length}</h3>
                </div>
            </div>

            {/* Operator Risk Index inside Report */}
            <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
                <div className="bg-[#0F172A] p-5 px-8 flex items-center justify-between text-white">
                    <h4 className="text-xs font-black uppercase tracking-widest">Índice de Risco dos Operadores</h4>
                    <span className="text-[9px] font-mono font-bold bg-white/15 px-3 py-1 rounded-full uppercase tracking-wider">Classificação de Condutores</span>
                </div>
                <div className="p-4 overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] text-slate-400 font-extrabold tracking-widest">
                          <th className="p-3 uppercase">Matrícula</th>
                          <th className="p-3 uppercase">Nome do Operador</th>
                          <th className="p-3 uppercase text-center">Quantidade Ocorrências</th>
                          <th className="p-3 uppercase text-center">Velocidade Máxima</th>
                          <th className="p-3 uppercase text-right">Classificação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {operatorRiskIndexLocal.slice(0, 10).map((op, idx) => (
                          <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50">
                            <td className="p-3 font-bold text-slate-700">{op.matricula}</td>
                            <td className="p-3 font-semibold uppercase text-slate-900">{op.name}</td>
                            <td className="p-3 text-center font-black text-sm">{op.count}</td>
                            <td className="p-3 text-center font-bold text-slate-800">{op.maxSpeed.toFixed(1)} km/h</td>
                            <td className="p-3 text-right">
                              <span className={`px-2 py-1 border rounded-full text-[9px] font-black tracking-wider ${op.riskColor}`}>
                                {op.riskLevel} RISCO
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                </div>
            </div>

            {/* Main Telemetry Table with Status and Actions */}
            <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
                <div className="bg-[#0F172A] p-5 px-8 flex items-center justify-between text-white">
                    <h4 className="text-xs font-black uppercase tracking-widest">Detalhamento de Ocorrências</h4>
                    <h4 className="text-xl font-black italic tracking-tighter">Limites Reais de Via</h4>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="p-4 px-6 text-[9px] font-black uppercase text-slate-400 tracking-widest">Matrícula</th>
                        <th className="p-4 px-6 text-[9px] font-black uppercase text-slate-400 tracking-widest">Nome do Colaborador</th>
                        <th className="p-4 px-6 text-[9px] font-black uppercase text-slate-400 tracking-widest text-center">Velocidade</th>
                        <th className="p-4 px-6 text-[9px] font-black uppercase text-slate-400 tracking-widest text-center">Status</th>
                        <th className="p-4 px-6 text-[9px] font-black uppercase text-slate-400 tracking-widest">Ações Registradas</th>
                        <th className="p-4 px-6 text-[9px] font-black uppercase text-slate-400 tracking-widest text-right">Data/Hora</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((item, index) => {
                        const statusObj = getOccurrenceStatus(item.id);
                        return (
                          <tr key={`${item.id}-${index}`} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                            <td className="p-4 px-6 text-xs font-bold text-slate-600">{item.matricula}</td>
                            <td className="p-4 px-6 text-xs font-black uppercase text-slate-900 max-w-xs text-left">
                              <div>{item.descricaoOperador}</div>
                              <div className="text-[9px] font-black tracking-normal text-slate-400 mt-0.5 whitespace-nowrap">
                                Via: {(item as any).roadType || 'Estrada de Terra'} ({(item as any).roadLimit || 40} km/h) | Excess: +{Number((item as any).excesso || (item.velocidade - 40)).toFixed(1).replace('.', ',')} km/h
                              </div>
                            </td>
                            <td className="p-4 px-6 text-sm font-black text-blue-600 text-center">
                              {Number(item.velocidade).toFixed(1).replace('.', ',')} km/h
                            </td>
                            <td className="p-4 px-6 text-center">
                              <span className={`px-2 py-0.5 text-[8px] font-extrabold uppercase border rounded-full tracking-wider ${statusObj.color}`}>
                                {statusObj.label}
                              </span>
                            </td>
                            <td className="p-4 px-6 text-[10px] font-semibold text-slate-500 max-w-[150px] truncate">
                              {getOccurrenceActionsSummary(item.id)}
                            </td>
                            <td className="p-4 px-6 text-xs font-medium text-slate-400 tabular-nums text-right">
                              {format(item.dataHora, "dd/MM/yyyy HH:mm:ss")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
            </div>

            {/* Técnico/Segurança Observação */}
            <div 
                style={{ backgroundColor: '#F8FAFC', border: '2px solid #CBD5E1' }}
                className="p-8 rounded-3xl space-y-4"
            >
                <div className="flex justify-between items-center sm:flex-row flex-col gap-2">
                    <h4 style={{ color: '#0F172A' }} className="text-xs font-black uppercase tracking-[0.15em]">
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
                    placeholder="Escreva aqui as observações ou parecer técnico..."
                />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-white text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">
                Painel G.C.V Pro — Auditoria Digital de Telemetria
            </p>
        </div>

        {/* PDF HIDDEN CLEAN AREA FOR HIGH FIDELITY OUTPUT */}
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
          {/* PDF HEADER */}
          <div
            style={{
              backgroundColor: '#0F172A',
              padding: '40px',
              borderRadius: '30px',
              marginBottom: '35px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div>
              <h1 style={{ color: '#FFFFFF', fontSize: '52px', fontWeight: '900', margin: 0, letterSpacing: '-0.02em' }}>
                G.C.V PRO
              </h1>
              <p style={{ color: '#94A3B8', marginTop: '8px', fontSize: '18px', fontWeight: '500' }}>
                Relatório Executivo de Velocidade (Logística & Tratativas)
              </p>
            </div>
            
            <div style={{ 
              backgroundColor: '#1E293B', 
              padding: '15px 35px', 
              borderRadius: '2px', 
              border: '2px solid #334155',
              display: 'flex',
              alignItems: 'center',
              gap: '15px'
            }}>
              <div style={{ color: 'white', fontSize: '36px', fontWeight: '900', letterSpacing: '0.1em' }}>
                SOLINFTEC
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px', marginBottom: '35px' }}>
            <div style={{ backgroundColor: '#EFF6FF', padding: '30px', borderRadius: '25px', border: '1px solid #BFDBFE' }}>
              <h3 style={{ margin: 0, color: '#1E40AF', fontSize: '16px', fontWeight: '900' }}>SPEEDS DETECTED</h3>
              <h1 style={{ fontSize: '64px', color: '#1D4ED8', fontWeight: '900', margin: '15px 0 0 0' }}>{speedsDetected.length}</h1>
            </div>

            <div style={{ backgroundColor: '#FFF7ED', padding: '30px', borderRadius: '25px', border: '1px solid #FFEDD5' }}>
              <h3 style={{ margin: 0, color: '#C2410C', fontSize: '16px', fontWeight: '900' }}>ALERT ZONE</h3>
              <h1 style={{ fontSize: '64px', color: '#EA580C', fontWeight: '900', margin: '15px 0 0 0' }}>{alertZone.length}</h1>
            </div>
          </div>

          {/* Table 1: Operator Risk Index in PDF */}
          <div style={{ border: '1px solid #E2E8F0', borderRadius: '20px', overflow: 'hidden', marginBottom: '35px' }}>
            <div style={{ backgroundColor: '#0F172A', color: 'white', padding: '20px 30px', fontWeight: '900', fontSize: '18px' }}>
              Índice de Risco por Operador (TOP 10)
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#FFFFFF', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                  <th style={{ padding: '15px 25px', textAlign: 'left', fontWeight: 'bold', color: '#475569' }}>MATRÍCULA</th>
                  <th style={{ padding: '15px 25px', textAlign: 'left', fontWeight: 'bold', color: '#475569' }}>OPERADOR</th>
                  <th style={{ padding: '15px 25px', textAlign: 'center', fontWeight: 'bold', color: '#475569' }}>OCORRÊNCIAS</th>
                  <th style={{ padding: '15px 25px', textAlign: 'center', fontWeight: 'bold', color: '#475569' }}>VELOCIDADE MÁXIMA</th>
                  <th style={{ padding: '15px 25px', textAlign: 'right', fontWeight: 'bold', color: '#475569' }}>GRAU DE RISCO</th>
                </tr>
              </thead>
              <tbody>
                {operatorRiskIndexLocal.slice(0, 10).map((op, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '15px 25px', fontWeight: 'bold', color: '#1E293B' }}>{op.matricula}</td>
                    <td style={{ padding: '15px 25px', fontWeight: '900', color: '#0F172A', textTransform: 'uppercase' }}>{op.name}</td>
                    <td style={{ padding: '15px 25px', textAlign: 'center', fontWeight: '900', fontSize: '15px' }}>{op.count}</td>
                    <td style={{ padding: '15px 25px', textAlign: 'center', fontWeight: 'bold', color: '#EA580C' }}>{op.maxSpeed.toFixed(1)} km/h</td>
                    <td style={{ padding: '15px 25px', textAlign: 'right', fontWeight: '950' }}>{op.riskLevel} RISCO</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table 2: Occurrence List detailing Status & Actions */}
          <div style={{ border: '1px solid #E2E8F0', borderRadius: '20px', overflow: 'hidden', marginBottom: '35px' }}>
            <div style={{ backgroundColor: '#0F172A', color: 'white', padding: '20px 30px', fontWeight: '900', fontSize: '18px', display: 'flex', justifyContent: 'space-between' }}>
              <span>Detalhamento de Ocorrências com Tratativas e Ações Corretivas</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#FFFFFF', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                  <th style={{ padding: '15px 25px', textAlign: 'left', fontWeight: 'bold', color: '#475569' }}>MATRÍCULA</th>
                  <th style={{ padding: '15px 25px', textAlign: 'left', fontWeight: 'bold', color: '#475569' }}>COLABORADOR</th>
                  <th style={{ padding: '15px 25px', textAlign: 'center', fontWeight: 'bold', color: '#475569' }}>VELOCIDADE</th>
                  <th style={{ padding: '15px 25px', textAlign: 'center', fontWeight: 'bold', color: '#475569' }}>STATUS</th>
                  <th style={{ padding: '15px 25px', textAlign: 'left', fontWeight: 'bold', color: '#475569' }}>AÇÕES REGISTRADAS</th>
                  <th style={{ padding: '15px 25px', textAlign: 'right', fontWeight: 'bold', color: '#475569' }}>DATA/HORA</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item, index) => {
                  const statusObj = getOccurrenceStatus(item.id);
                  return (
                    <tr key={`${item.id}-${index}`} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '15px 25px', fontWeight: 'bold' }}>{item.matricula}</td>
                      <td style={{ padding: '15px 25px', fontWeight: 'bold', textTransform: 'uppercase', textAlign: 'left' }}>
                        <div>{item.descricaoOperador}</div>
                        <div style={{ fontSize: '9px', fontWeight: '800', color: '#64748B', marginTop: '3px' }}>
                          Via: {(item as any).roadType || 'Estrada de Terra'} ({(item as any).roadLimit || 40} km/h) — Excess: +{Number((item as any).excesso || (item.velocidade - 40)).toFixed(1).replace('.', ',')} km/h
                        </div>
                      </td>
                      <td style={{ padding: '15px 25px', textAlign: 'center', fontWeight: '900', color: '#1D4ED8' }}>{Number(item.velocidade).toFixed(1)} km/h</td>
                      <td style={{ padding: '15px 25px', textAlign: 'center', fontWeight: '900' }}>{statusObj.label}</td>
                      <td style={{ padding: '15px 25px', color: '#475569' }}>{getOccurrenceActionsSummary(item.id)}</td>
                      <td style={{ padding: '15px 25px', textAlign: 'right', color: '#94A3B8' }}>{format(item.dataHora, "dd/MM/yyyy HH:mm:ss")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Technical opinion */}
          <div style={{ padding: '30px', backgroundColor: '#F8FAFC', borderRadius: '25px', border: '1.5px solid #CBD5E1' }}>
            <h4 style={{ color: '#0F172A', fontSize: '16px', fontWeight: '900', marginBottom: '15px' }}>PARECER TÉCNICO DE ENGENHARIA / SEGURANÇA VIÁRIA</h4>
            <div style={{ color: '#334155', fontSize: '14px', lineHeight: '1.7', whiteSpace: 'pre-wrap', fontWeight: '500' }}>
              {opinionText}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
