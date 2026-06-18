import { TelemetryRecord } from '../types';
import { format } from 'date-fns';
import { motion } from 'motion/react';
import { X, AlertTriangle, FileText } from 'lucide-react';
import { useRef, useState, useMemo, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface Props {
  data: TelemetryRecord[];
  cardCount: number;
  onClose: () => void;
  appliedStartDate: any;
  appliedEndDate: any;
  appliedUnidade: string;
  appliedOperacao: string;
  appliedEmpresa?: string;
  appliedFrente?: string | number;
}

export default function DetailedOccurrencesReport({
  data,
  cardCount,
  onClose,
  appliedStartDate,
  appliedEndDate,
  appliedUnidade,
  appliedOperacao,
  appliedEmpresa = 'Todas',
  appliedFrente = 'Todas'
}: Props) {
  const pdfReportRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Dynamic via type, limit and excess based on GPS location
  const getRoadDetailsByRecord = (record: any) => {
    const type = record.roadType || 'Estrada de Terra';
    const limit = record.roadLimit || 40;
    const excess = record.excesso !== undefined ? record.excesso : Math.max(0, record.velocidade - limit);
    
    let color: string;
    let bgColor: string;
    let borderColor: string;

    if (type === 'Estrada de Terra') {
      color = '#78350F'; // Marrom
      bgColor = '#FEF3C7';
      borderColor = '#F59E0B';
    } else {
      color = '#374151'; // Grafite
      bgColor = '#F3F4F6';
      borderColor = '#9CA3AF';
    }

    return {
      type,
      limit,
      excess,
      color,
      bgColor,
      borderColor
    };
  };

  // Safe Date parsing
  const formatDateSafe = (dateVal: any, formatPattern: string): string => {
    if (!dateVal) return '---';
    try {
      const parsedDate = dateVal instanceof Date ? dateVal : new Date(dateVal);
      if (isNaN(parsedDate.getTime())) return '---';
      return format(parsedDate, formatPattern);
    } catch (e) {
      return '---';
    }
  };

  // Validation: Check if cardCount matches report's data length
  useEffect(() => {
    if (data.length !== cardCount) {
      setValidationError("Nem todas as ocorrências foram incluídas no relatório.");
    } else {
      setValidationError(null);
    }
  }, [data.length, cardCount]);

  // Operator Risk calculation based exclusively on selected/visualized data
  const localOperatorsRisk = useMemo(() => {
    const countsMap = new Map<string, { name: string; matricula: string; occurrences: number; maxSpeed: number }>();
    
    data.forEach(r => {
      const driverName = r.descricaoOperador ? String(r.descricaoOperador).trim().toUpperCase() : 'SEM MOTORISTA';
      const driverMat = r.matricula ? String(r.matricula).split('.')[0].replace(/^0+/, '').trim() : '---';
      const key = driverMat || driverName;
      
      const stats = countsMap.get(key) || { name: driverName, matricula: driverMat, occurrences: 0, maxSpeed: 0 };
      countsMap.set(key, {
        name: driverName,
        matricula: driverMat,
        occurrences: stats.occurrences + 1,
        maxSpeed: Math.max(stats.maxSpeed, r.velocidade)
      });
    });

    return Array.from(countsMap.values()).map(o => {
      let riskLevel: 'ALTO' | 'MÉDIO' | 'BAIXO' = 'BAIXO';
      if (o.occurrences > 5) riskLevel = 'ALTO';
      else if (o.occurrences >= 3) riskLevel = 'MÉDIO';
      
      return {
        ...o,
        riskLevel
      };
    });
  }, [data]);

  // Executive Summary and Statistics
  const summaryStats = useMemo(() => {
    const totalCount = data.length;
    const maxSpeed = totalCount > 0 ? Math.max(...data.map(d => d.velocidade)) : 0;
    const uniqueDrivers = localOperatorsRisk.length;
    
    const altoRiscoCount = localOperatorsRisk.filter(o => o.riskLevel === 'ALTO').length;
    const medioRiscoCount = localOperatorsRisk.filter(o => o.riskLevel === 'MÉDIO').length;
    const baixoRiscoCount = localOperatorsRisk.filter(o => o.riskLevel === 'BAIXO').length;

    // Period consulted formatting
    const startStr = formatDateSafe(appliedStartDate, 'dd/MM/yyyy');
    const endStr = formatDateSafe(appliedEndDate, 'dd/MM/yyyy');
    const period = (startStr !== '---' && endStr !== '---') ? `${startStr} até ${endStr}` : 'Todos os Registros';

    return {
      totalCount,
      uniqueDrivers,
      altoRisco: altoRiscoCount,
      medioRisco: medioRiscoCount,
      baixoRisco: baixoRiscoCount,
      maxSpeed,
      period
    };
  }, [data, localOperatorsRisk, appliedStartDate, appliedEndDate]);

  // Get single occurrence risk classification
  const getOccurrenceRiskClass = (rec: TelemetryRecord): { label: string, color: string, bg: string, border: string } => {
    const driverName = rec.descricaoOperador ? String(rec.descricaoOperador).trim().toUpperCase() : 'SEM MOTORISTA';
    const driverMat = rec.matricula ? String(rec.matricula).split('.')[0].replace(/^0+/, '').trim() : '---';
    const key = driverMat || driverName;
    const opInfo = localOperatorsRisk.find(o => (o.matricula || o.name) === key);
    const risk = opInfo?.riskLevel || 'BAIXO';
    
    if (risk === 'ALTO') {
      return { label: 'ALTO RISCO', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' };
    }
    if (risk === 'MÉDIO') {
      return { label: 'MÉDIO RISCO', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' };
    }
    return { label: 'BAIXO RISCO', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' };
  };

  // PDF Export Trigger
  const handleDownloadPDF = async () => {
    if (validationError) {
      alert(`Erro: ${validationError}`);
      return;
    }

    try {
      if (!pdfReportRef.current) return;
      setGenerating(true);

      const canvas = await html2canvas(pdfReportRef.current, {
        scale: 2, // high graphic fidelity
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
      pdf.save(`RELATORIO_DETALHADO_GCV_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
      
      alert('Relatório de Detalhamento das Ocorrências gerado com sucesso!');
    } catch (error) {
      console.error('Erro na exportização de PDF:', error);
      alert('Ocorreu um erro técnico ao gerar o PDF. Por favor, tente novamente.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black/85 flex items-center justify-center p-4 backdrop-blur-sm"
    >
      <div 
        style={{ backgroundColor: '#FFFFFF' }}
        className="rounded-[32px] w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200 border border-slate-200"
      >
        {/* Modal Top Header Bar */}
        <div 
          style={{ backgroundColor: '#0F172A' }}
          className="p-6 md:p-8 flex items-center justify-between text-white border-b border-white/5"
        >
          <div className="flex items-center gap-6">
            <div>
              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight">📄 Relatório Detalhado</h2>
              <p className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] mt-1">Ocorrências Selecionadas & Auditoria de Velocidade</p>
            </div>
            
            <div className="h-10 w-px bg-white/10 hidden md:block"></div>
            
            <div className="hidden md:flex items-center gap-2.5 bg-white/5 px-4 py-1.5 rounded-lg border border-white/10">
              <span className="text-xs font-black tracking-widest leading-none text-blue-400">SOLINFTEC</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={handleDownloadPDF}
              disabled={generating}
              style={{ backgroundColor: '#1D4ED8' }}
              className={`px-5 h-11 rounded-xl text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-600/20 active:scale-95 cursor-pointer flex items-center gap-2 ${generating ? 'opacity-50' : 'hover:brightness-110'}`}
            >
              {generating ? 'Exportando...' : 'Exportar PDF'}
            </button>
            <button 
              onClick={onClose}
              className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all active:scale-95 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Validation Alert Area if any */}
        {validationError && (
          <div className="bg-red-50 border-b border-red-200 px-8 py-3.5 flex items-center gap-3 text-red-700 text-xs font-black uppercase">
            <AlertTriangle size={18} />
            <span>Erro crítico: {validationError}</span>
          </div>
        )}

        {/* Interactive Scrollable Visual Content Preview */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 bg-slate-50/50">
          
          {/* Header instructions */}
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
            <div className="text-blue-600 mt-0.5"><FileText size={18} /></div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-blue-900 leading-none">Visualização Prévia do Relatório</h4>
              <p className="text-[10px] font-bold text-blue-700 mt-1 uppercase leading-relaxed">
                Este relatório foi gerado com base nas {data.length} ocorrências mostradas e filtradas em tela. Ele obedece fielmente aos limites, filtros de unidade, empresa, operação e período consultado.
              </p>
            </div>
          </div>

          {/* Management Observation Notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <div className="text-amber-700 mt-0.5"><AlertTriangle size={18} /></div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-amber-900 leading-none">Observação Gerencial</h4>
              <p className="text-[10px] font-bold text-amber-800 mt-1 uppercase leading-relaxed">
                Registro identificado por seleção realizada no mapa operacional e classificado conforme critério de velocidade vigente.
              </p>
            </div>
          </div>

          {/* Quick Metrics (Interactive visual preview) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Total Ocorrências</span>
              <h3 className="text-xl font-black text-slate-900 mt-1">{summaryStats.totalCount}</h3>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Total Operadores</span>
              <h3 className="text-xl font-black text-slate-900 mt-1">{summaryStats.uniqueDrivers}</h3>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <span className="text-[8px] font-black uppercase text-red-500 tracking-wider">Alto Risco Op</span>
              <h3 className="text-xl font-black text-red-600 mt-1">{summaryStats.altoRisco}</h3>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Velo Máxima</span>
              <h3 className="text-xl font-black text-orange-600 mt-1">{summaryStats.maxSpeed.toFixed(1).replace('.', ',')} km/h</h3>
            </div>
          </div>

          {/* Miniature preview frame */}
          <div className="border border-slate-200 rounded-[24px] bg-white shadow-inner p-6 overflow-x-auto max-w-full">
            <div className="w-[1000px] mx-auto bg-white p-4">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block text-center mb-6">PREVIEW DAS PÁGINAS DO RELATÓRIO DO PDF</span>
              
              <div className="border-t border-slate-200 pt-4">
                <h1 className="text-lg font-black uppercase text-slate-800 tracking-tight leading-none">Relatório Detalhado de Ocorrências</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Período: {summaryStats.period}</p>
                <div className="grid grid-cols-2 gap-4 mt-4 text-[10px] text-slate-600 bg-slate-50 p-4 rounded-xl font-mono">
                  <div><strong>UNIDADE:</strong> {appliedUnidade}</div>
                  <div><strong>OPERAÇÃO:</strong> {appliedOperacao}</div>
                  <div><strong>EMPRESA:</strong> {appliedEmpresa}</div>
                  <div><strong>FRENTE:</strong> {appliedFrente}</div>
                </div>
              </div>

              {/* Table Preview */}
              <div className="mt-6 border border-slate-100 rounded-xl overflow-hidden text-[9px]">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-900 text-white font-black uppercase">
                      <th className="p-2 border border-slate-800 text-center">Ord</th>
                      <th className="p-2 border border-slate-800">Operador & Matrícula</th>
                      <th className="p-2 border border-slate-800">Unidade & Operação</th>
                      <th className="p-2 border border-slate-800">Data & Hora</th>
                      <th className="p-2 border border-slate-800 text-center">Identificação da Infração</th>
                      <th className="p-2 border border-slate-800">Frota</th>
                      <th className="p-2 border border-slate-800 font-mono">Coordenadas</th>
                      <th className="p-2 border border-slate-800">Risco</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.slice(0, 15).map((rec, index) => {
                      const roadDetails = getRoadDetailsByRecord(rec);
                      const rc = getOccurrenceRiskClass(rec);
                      return (
                        <tr key={rec.id} className="border-b border-slate-100 even:bg-slate-50/50">
                          <td className="p-2 text-center font-bold text-slate-400">{index + 1}</td>
                          <td className="p-2 font-black text-slate-800 text-[10px] uppercase">
                            <div>{rec.descricaoOperador || '---'}</div>
                            <span className="text-[8px] font-bold text-slate-400">MAT: {rec.matricula || '---'}</span>
                          </td>
                          <td className="p-2 font-bold text-slate-600">
                            <div>U: {rec.unidade || '---'}</div>
                            <div className="text-[8px] text-slate-400 truncate max-w-[130px] uppercase">{rec.operacao || '---'}</div>
                          </td>
                          <td className="p-2 font-bold text-slate-500">
                            <div>{formatDateSafe(rec.dataHora, 'dd/MM/yyyy')}</div>
                            <div className="text-[8px] font-mono text-slate-400">{formatDateSafe(rec.dataHora, 'HH:mm:ss')}</div>
                          </td>
                          <td className="p-2">
                            <div className="p-2 rounded-lg border text-center" style={{ backgroundColor: roadDetails.bgColor, borderColor: roadDetails.borderColor, color: roadDetails.color }}>
                              <strong className="block text-[9px] uppercase tracking-tight">{roadDetails.type}</strong>
                              <div className="text-[8px] font-black mt-0.5 space-y-0.5 leading-tight">
                                <p>Limite da Via: {roadDetails.limit} km/h</p>
                                <p>Velocidade Registrada: {rec.velocidade.toFixed(1).replace('.', ',')} km/h</p>
                                <p>Excesso Apurado: +{roadDetails.excess.toFixed(1).replace('.', ',')} km/h</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-2 font-bold text-slate-700">{rec.frota || '---'}</td>
                          <td className="p-2 text-[8px] text-slate-400 font-mono">
                            <div>Lat: {rec.latitude?.toFixed(5)}</div>
                            <div>Lon: {rec.longitude?.toFixed(5)}</div>
                          </td>
                          <td className="p-2">
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black ${rc.bg} ${rc.color} border ${rc.border}`}>
                              {rc.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {data.length > 15 && (
                      <tr>
                        <td colSpan={8} className="p-3 text-center text-slate-450 italic font-bold">
                          + {data.length - 15} registros adicionais inclusos no relatório completo...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Area */}
        <div className="p-5 border-t border-slate-150 bg-white text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">
            Painel G.C.V Pro — Auditoria Digital de Telemetria
          </p>
        </div>

        {/* ========================================================================= */}
        {/* PDF HIDDEN CLEAN AREA FOR HIGH FIDELITY PRINT OUTPUT                     */}
        {/* ========================================================================= */}
        <div
          ref={pdfReportRef}
          style={{
            position: 'absolute',
            left: '-9999px',
            top: 0,
            width: '1200px',
            height: 'auto',
            backgroundColor: '#FFFFFF',
            padding: '45px',
            color: '#0F172A',
            fontFamily: "'Inter', sans-serif"
          }}
        >
          {/* PDF HEADER */}
          <div
            style={{
              backgroundColor: '#0F172A',
              padding: '45px',
              borderRadius: '24px',
              marginBottom: '40px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              border: '1px solid #1E293B'
            }}
          >
            <div>
              <h1 style={{ color: '#FFFFFF', fontSize: '50px', fontWeight: '950', margin: 0, letterSpacing: '-0.03em' }}>
                G.C.V PRO
              </h1>
              <p style={{ color: '#94A3B8', marginTop: '10px', fontSize: '18px', fontWeight: '800', textTransform: 'uppercase' }}>
                Relatório de Auditoria e Detalhamento de Ocorrências
              </p>
            </div>
            
            <div style={{ backgroundColor: '#1E293B', padding: '15px 35px', borderRadius: '14px', border: '2px solid #334155' }}>
              <div style={{ color: '#FACC15', fontSize: '32px', fontWeight: '950', letterSpacing: '0.15em' }}>
                SOLINFTEC
              </div>
            </div>
          </div>

          {/* REPORT METADATA FILTER BLOCK */}
          <div 
            style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr 1.5fr', 
              gap: '20px', 
              backgroundColor: '#F8FAFC', 
              border: '2px solid #E2E8F0', 
              borderRadius: '20px', 
              padding: '24px', 
              marginBottom: '30px', 
              fontSize: '13px' 
            }}
          >
            <div>
              <strong style={{ color: '#475569', fontSize: '10px', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '900' }}>Unidade Consultada</strong>
              <span style={{ fontWeight: '900', color: '#0F172A', fontSize: '15px' }}>{appliedUnidade}</span>
            </div>
            <div>
              <strong style={{ color: '#475569', fontSize: '10px', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '900' }}>Operação Ativa</strong>
              <span style={{ fontWeight: '900', color: '#0F172A', fontSize: '15px' }}>{appliedOperacao}</span>
            </div>
            <div>
              <strong style={{ color: '#475569', fontSize: '10px', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '900' }}>Período de Monitoramento</strong>
              <span style={{ fontWeight: '900', color: '#1D4ED8', fontSize: '15px' }}>{summaryStats.period}</span>
            </div>
            <div>
              <strong style={{ color: '#475569', fontSize: '10px', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '900' }}>Empresa / Filtro</strong>
              <span style={{ fontWeight: '900', color: '#0F172A', fontSize: '14px' }}>{appliedEmpresa}</span>
            </div>
            <div>
              <strong style={{ color: '#475569', fontSize: '10px', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '900' }}>Frente de Trabalho</strong>
              <span style={{ fontWeight: '900', color: '#0F172A', fontSize: '14px' }}>{appliedFrente}</span>
            </div>
            <div>
              <strong style={{ color: '#445569', fontSize: '10px', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '900' }}>Total de Registros</strong>
              <span style={{ fontWeight: '900', color: '#10B981', fontSize: '14px' }}>{summaryStats.totalCount} Registros Visíveis</span>
            </div>
          </div>

          {/* OBSERVACAO GERENCIAL - OBRIGATÓRIA */}
          <div 
            style={{ 
              backgroundColor: '#FEF3C7', 
              border: '2px solid #F59E0B', 
              borderRadius: '20px', 
              padding: '20px 30px', 
              marginBottom: '35px', 
              fontSize: '13px',
              color: '#78350F',
              fontWeight: '800',
              textTransform: 'uppercase',
              letterSpacing: '0.02em',
              lineHeight: '1.5'
            }}
          >
            ⚠️ Registro identificado por seleção realizada no mapa operacional e classificado conforme critério de velocidade vigente.
          </div>

          {/* RESUMO EXECUTIVO DO RELATÓRIO CHIP CARDS */}
          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '-0.01em', marginBottom: '15px', color: '#0F172A', borderBottom: '1px solid #CBD5E1', paddingBottom: '8px' }}>
              📊 Resumo Executivo
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px' }}>
              <div style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', padding: '20px', borderRadius: '16px' }}>
                <span style={{ color: '#1E40AF', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', display: 'block', letterSpacing: '0.05em' }}>Total Ocorrências</span>
                <span style={{ fontSize: '32px', fontWeight: '950', color: '#1D4ED8', display: 'block', marginTop: '5px' }}>{summaryStats.totalCount}</span>
              </div>
              <div style={{ backgroundColor: '#F3E8FF', border: '1px solid #E9D5FF', padding: '20px', borderRadius: '16px' }}>
                <span style={{ color: '#6B21A8', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', display: 'block', letterSpacing: '0.05em' }}>Qtd de Operadores</span>
                <span style={{ fontSize: '32px', fontWeight: '950', color: '#7E22CE', display: 'block', marginTop: '5px' }}>{summaryStats.uniqueDrivers}</span>
              </div>
              <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', padding: '20px', borderRadius: '16px' }}>
                <span style={{ color: '#991B1B', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', display: 'block', letterSpacing: '0.05em' }}>Operadores Alto Risco</span>
                <span style={{ fontSize: '32px', fontWeight: '950', color: '#DC2626', display: 'block', marginTop: '5px' }}>{summaryStats.altoRisco}</span>
              </div>
              <div style={{ backgroundColor: '#FEFCE8', border: '1px solid #FDE047', padding: '20px', borderRadius: '16px' }}>
                <span style={{ color: '#854D0E', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', display: 'block', letterSpacing: '0.05em' }}>Velocidade Máxima</span>
                <span style={{ fontSize: '32px', fontWeight: '950', color: '#CA8A04', display: 'block', marginTop: '5px' }}>{summaryStats.maxSpeed.toFixed(1).replace('.', ',')} <span style={{ fontSize: '13px', fontWeight: '700' }}>km/h</span></span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '15px' }}>
              <div style={{ backgroundColor: '#FFF7ED', border: '1px solid #FFEDD5', padding: '20px', borderRadius: '16px' }}>
                <span style={{ color: '#9A3412', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', display: 'block', letterSpacing: '0.05em' }}>Operadores Médio Risco</span>
                <span style={{ fontSize: '24px', fontWeight: '950', color: '#C2410C', display: 'block', marginTop: '5px' }}>{summaryStats.medioRisco} Condutores</span>
              </div>
              <div style={{ backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', padding: '20px', borderRadius: '16px' }}>
                <span style={{ color: '#065F46', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', display: 'block', letterSpacing: '0.05em' }}>Operadores Baixo Risco</span>
                <span style={{ fontSize: '24px', fontWeight: '950', color: '#059669', display: 'block', marginTop: '5px' }}>{summaryStats.baixoRisco} Condutores</span>
              </div>
            </div>
          </div>

          {/* DETALHAMENTO DAS OCORRÊNCIAS (FULL TABLE) */}
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '-0.01em', marginBottom: '15px', color: '#0F172A', borderBottom: '1px solid #CBD5E1', paddingBottom: '8px' }}>
              📋 Detalhamento de Ocorrências com Identificação da Infração
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '2px solid #E2E8F0', color: '#475569', textTransform: 'uppercase', fontWeight: '900' }}>
                  <th style={{ padding: '12px 10px', textAlign: 'center', borderRight: '1px solid #E2E8F0' }}>Ord</th>
                  <th style={{ padding: '12px 10px', textAlign: 'left', borderRight: '1px solid #E2E8F0' }}>Operador & Matrícula</th>
                  <th style={{ padding: '12px 10px', textAlign: 'left', borderRight: '1px solid #E2E8F0' }}>Identificação da Infração (Tipo de Via, Limite & Excesso)</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center', borderRight: '1px solid #E2E8F0' }}>Risco</th>
                  <th style={{ padding: '12px 10px', textAlign: 'left', borderRight: '1px solid #E2E8F0' }}>Unidade & Operação</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center', borderRight: '1px solid #E2E8F0' }}>Frota</th>
                  <th style={{ padding: '12px 10px', textAlign: 'left', borderRight: '1px solid #E2E8F0' }}>Data & Hora</th>
                  <th style={{ padding: '12px 10px', textAlign: 'left' }}>Coordenadas</th>
                </tr>
              </thead>
              <tbody>
                {data.map((rec, index) => {
                  const roadDetails = getRoadDetailsByRecord(rec);
                  const rc = getOccurrenceRiskClass(rec);
                  return (
                    <tr 
                      key={rec.id} 
                      style={{ 
                        borderBottom: '1px solid #E2E8F0',
                        backgroundColor: index % 2 === 0 ? '#FFFFFF' : '#FCFDFE'
                      }}
                    >
                      <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 'bold', color: '#94A3B8', borderRight: '1px solid #E2E8F0' }}>{index + 1}</td>
                      
                      {/* Operator & Matricula */}
                      <td style={{ padding: '12px 10px', borderRight: '1px solid #E2E8F0' }}>
                        <div style={{ fontWeight: '900', color: '#0F172A', textTransform: 'uppercase', fontSize: '11px' }}>
                          {rec.descricaoOperador || '---'}
                        </div>
                        <div style={{ color: '#64748B', fontWeight: '800', fontSize: '9px', marginTop: '2px' }}>
                          Mat: {rec.matricula || '---'}
                        </div>
                      </td>

                      {/* Identificacao da Infracao */}
                      <td style={{ padding: '12px 10px', borderRight: '1px solid #E2E8F0', backgroundColor: roadDetails.bgColor + '30' }}>
                        <div style={{ color: roadDetails.color, fontWeight: '950', fontSize: '12px', textTransform: 'uppercase' }}>
                          TIPO DE VIA: {roadDetails.type}
                        </div>
                        
                        <div style={{ marginTop: '5px', fontSize: '10px', color: '#334155', fontWeight: '700', lineHeight: '1.4' }}>
                          <div>Limite da Via: <span style={{ fontWeight: '900' }}>{roadDetails.limit} km/h</span></div>
                          <div style={{ color: '#DC2626' }}>Velocidade Registrada: <span style={{ fontWeight: '900' }}>{rec.velocidade.toFixed(1).replace('.', ',')} km/h</span></div>
                          <div style={{ color: '#EA580C' }}>Excesso Apurado: <span style={{ fontWeight: '900' }}>+{roadDetails.excess.toFixed(1).replace('.', ',')} km/h</span></div>
                        </div>
                      </td>

                      {/* Classificacao de Risco */}
                      <td style={{ padding: '12px 10px', textAlign: 'center', borderRight: '1px solid #E2E8F0' }}>
                        <span 
                          style={{ 
                            display: 'inline-block',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontWeight: '950',
                            fontSize: '8px',
                            border: '1px solid',
                            borderColor: rc.color.includes('red') ? '#FCA5A5' : rc.color.includes('amber') ? '#FDBA74' : '#A7F3D0',
                            color: rc.color.includes('red') ? '#B91C1C' : rc.color.includes('amber') ? '#C2410C' : '#047857',
                            backgroundColor: rc.color.includes('red') ? '#FEF2F2' : rc.color.includes('amber') ? '#FFF7ED' : '#ECFDF5',
                            textTransform: 'uppercase'
                          }}
                        >
                          {rc.label}
                        </span>
                      </td>

                      {/* Unidade & Operacao */}
                      <td style={{ padding: '12px 10px', borderRight: '1px solid #E2E8F0' }}>
                        <div style={{ fontWeight: '900', color: '#334155' }}>Unid: {rec.unidade || '---'}</div>
                        <div style={{ color: '#64748B', fontSize: '9px', marginTop: '2px', textTransform: 'uppercase', fontWeight: '700' }}>{rec.operacao || '---'}</div>
                      </td>

                      {/* Frota */}
                      <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: '900', color: '#0F172A', borderRight: '1px solid #E2E8F0' }}>
                        {rec.frota || '---'}
                      </td>

                      {/* Data & Hora */}
                      <td style={{ padding: '12px 10px', borderRight: '1px solid #E2E8F0', fontSize: '10px', fontWeight: '700', color: '#334155' }}>
                        <div>{formatDateSafe(rec.dataHora, 'dd/MM/yyyy')}</div>
                        <div style={{ color: '#64748B', fontSize: '9px', marginTop: '2px', fontFamily: 'monospace' }}>{formatDateSafe(rec.dataHora, 'HH:mm:ss')}</div>
                      </td>

                      {/* Coordenadas */}
                      <td style={{ padding: '12px 10px', fontSize: '9px', color: '#64748B', fontFamily: 'monospace', fontWeight: '600' }}>
                        <div>Lat: {rec.latitude?.toFixed(6) || '---'}</div>
                        <div style={{ marginTop: '2px' }}>Long: {rec.longitude?.toFixed(6) || '---'}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* SIGNATURE AND METADATA */}
          <div style={{ marginTop: '55px', borderTop: '2px solid #E2E8F0', paddingTop: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#64748B' }}>
            <div>
              <strong>Processado eletronicamente por:</strong> lucianogermano13@gmail.com
              <br />
              <strong>Data de Geração:</strong> {formatDateSafe(new Date(), 'dd/MM/yyyy HH:mm:ss')}
            </div>
            <div style={{ textAlign: 'right', fontWeight: 'bold', textTransform: 'uppercase', color: '#0F172A' }}>
              Painel G.C.V Pro — Auditoria Digital de Telemetria
            </div>
          </div>
        </div>

      </div>
    </motion.div>
  );
}
