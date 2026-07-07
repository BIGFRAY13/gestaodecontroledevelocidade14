import { TelemetryRecord } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'motion/react';
import { 
  X, Award, ShieldAlert, ShieldCheck, AlertTriangle, FileText, 
  Calendar, MapPin, CheckSquare, Clock, Shield, TrendingUp, Gauge, 
  Map, User, ListCollapse
} from 'lucide-react';
import { useRef, useState, useMemo } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface Props {
  data: TelemetryRecord[]; // Filtered active dataset matching filters
  onClose: () => void;
  appliedStartDate?: string;
  appliedEndDate?: string;
  appliedUnidade?: string;
  appliedOperacao?: string;
  dashboardRanking?: any[];
}

export default function DriverRankingReport({
  data,
  onClose,
  appliedStartDate = '',
  appliedEndDate = '',
  appliedUnidade = 'Todas',
  appliedOperacao = 'Todas',
  dashboardRanking
}: Props) {
  const pdfReportRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);

  // Helper function to extract road type
  const getRoadTypeByRecord = (record: any): 'Estrada de Terra' | 'Vicinal Asfaltada' => {
    return record.roadType || 'Estrada de Terra';
  };

  // Helper to safely parse strings or Date objects to Date objects
  const ensureDate = (val: any): Date => {
    if (val instanceof Date) return val;
    if (!val) return new Date();
    try {
      const parsed = new Date(val);
      return isNaN(parsed.getTime()) ? new Date() : parsed;
    } catch (e) {
      return new Date();
    }
  };

  // Helper/Rule to define risk category for an driver based on number of infractions
  const getDriverRisk = (infractionsCount: number) => {
    if (infractionsCount > 5) {
      return {
        label: 'ALTO RISCO',
        badge: '🔴 ALTO RISCO',
        color: '#DC2626', // Red
        bg: '#FEF2F2',
        border: '#FCA5A5',
        recommendation: 'Tratativa imediata, reciclagem operacional e acompanhamento da liderança.'
      };
    } else if (infractionsCount >= 3) {
      return {
        label: 'MÉDIO RISCO',
        badge: '🟡 MÉDIO RISCO',
        color: '#D97706', // Amber/Yellow
        bg: '#FFF7ED',
        border: '#FDBA74',
        recommendation: 'Orientação formal e monitoramento.'
      };
    } else {
      return {
        label: 'BAIXO RISCO',
        badge: '🟢 BAIXO RISCO',
        color: '#059669', // Green
        bg: '#ECFDF5',
        border: '#A7F3D0',
        recommendation: 'Orientação preventiva.'
      };
    }
  };

  // ==========================================
  // FILTRAGEM DO RELATÓRIO DE VELOCIDADE
  // ==========================================
  
  // SEÇÃO 1: Estrada de Terra (> 40 km/h or from dashboardRanking)
  const terraOccurrences = useMemo(() => {
    if (dashboardRanking) {
      const list: TelemetryRecord[] = [];
      dashboardRanking.forEach(drv => {
        if (drv.occurrences) {
          drv.occurrences.forEach((occ: TelemetryRecord) => {
            if (getRoadTypeByRecord(occ) === 'Estrada de Terra') {
              list.push(occ);
            }
          });
        }
      });
      return list.sort((a, b) => b.velocidade - a.velocidade);
    }
    return data.filter(record => {
      const roadType = getRoadTypeByRecord(record);
      const rec = record as any;
      const isInfraction = rec.isInfraction !== undefined ? rec.isInfraction : record.velocidade > (rec.roadLimit || 40);
      return roadType === 'Estrada de Terra' && isInfraction;
    }).sort((a, b) => b.velocidade - a.velocidade);
  }, [data, dashboardRanking]);

  // SEÇÃO 2: Vicinal Asfaltada (> 60 km/h or from dashboardRanking)
  const vicinalOccurrences = useMemo(() => {
    if (dashboardRanking) {
      const list: TelemetryRecord[] = [];
      dashboardRanking.forEach(drv => {
        if (drv.occurrences) {
          drv.occurrences.forEach((occ: TelemetryRecord) => {
            if (getRoadTypeByRecord(occ) === 'Vicinal Asfaltada') {
              list.push(occ);
            }
          });
        }
      });
      return list.sort((a, b) => b.velocidade - a.velocidade);
    }
    return data.filter(record => {
      const roadType = getRoadTypeByRecord(record);
      return roadType === 'Vicinal Asfaltada' && record.velocidade > 60;
    }).sort((a, b) => b.velocidade - a.velocidade);
  }, [data, dashboardRanking]);

  const allFilteredOccurrences = useMemo(() => {
    if (dashboardRanking) {
      const list: TelemetryRecord[] = [];
      dashboardRanking.forEach(drv => {
        if (drv.occurrences) {
          list.push(...drv.occurrences);
        }
      });
      return list;
    }
    return [...terraOccurrences, ...vicinalOccurrences];
  }, [dashboardRanking, terraOccurrences, vicinalOccurrences]);

  // Aggregate operators to build RANKING and DETALHAMENTO
  const reportDriversRanking = useMemo(() => {
    if (dashboardRanking) {
      return dashboardRanking.map(drv => {
        const sortedOccurrences = [...(drv.occurrences || [])].sort((a, b) => {
          return ensureDate(b.dataHora).getTime() - ensureDate(a.dataHora).getTime();
        });
        const lastRecord = sortedOccurrences[0] || {} as TelemetryRecord;
        const lastOccurrence = ensureDate(lastRecord.dataHora);
        const roadTypes = new Set<'Estrada de Terra' | 'Vicinal Asfaltada'>();
        (drv.occurrences || []).forEach((rec: TelemetryRecord) => {
          roadTypes.add(getRoadTypeByRecord(rec));
        });
        
        return {
          name: drv.name,
          matricula: drv.matricula,
          infractionsCount: drv.count,
          maxSpeed: drv.maxSpeed,
          roadTypes,
          lastOccurrence,
          occurrences: drv.occurrences || [],
          lastRecord
        };
      });
    }

    const drivers: {
      [key: string]: {
        name: string;
        matricula: string;
        infractionsCount: number;
        maxSpeed: number;
        roadTypes: Set<'Estrada de Terra' | 'Vicinal Asfaltada'>;
        lastOccurrence: Date;
        occurrences: TelemetryRecord[];
        lastRecord: TelemetryRecord;
      };
    } = {};

    allFilteredOccurrences.forEach(rec => {
      const name = rec.descricaoOperador ? String(rec.descricaoOperador).trim().toUpperCase() : 'MOTORISTA DESCONHECIDO';
      const matricula = rec.matricula ? String(rec.matricula).split('.')[0].replace(/^0+/, '').trim() : '---';
      const key = `${name}_${matricula}`;

      if (!drivers[key]) {
        drivers[key] = {
          name,
          matricula,
          infractionsCount: 0,
          maxSpeed: 0,
          roadTypes: new Set(),
          lastOccurrence: ensureDate(rec.dataHora),
          occurrences: [],
          lastRecord: rec
        };
      }

      const driver = drivers[key];
      driver.infractionsCount += 1;
      driver.maxSpeed = Math.max(driver.maxSpeed, rec.velocidade);
      
      const roadType = getRoadTypeByRecord(rec);
      driver.roadTypes.add(roadType);

      const recDate = ensureDate(rec.dataHora);
      if (recDate.getTime() > driver.lastOccurrence.getTime()) {
        driver.lastOccurrence = recDate;
        driver.lastRecord = rec;
      }

      driver.occurrences.push(rec);
    });

    return Object.values(drivers).sort((a, b) => b.infractionsCount - a.infractionsCount);
  }, [allFilteredOccurrences, dashboardRanking]);

  // Executive summary counts
  const summaryKPIs = useMemo(() => {
    let altoCount = 0;
    let medioCount = 0;
    let baixoCount = 0;

    reportDriversRanking.forEach((drv) => {
      if (drv.infractionsCount > 5) altoCount++;
      else if (drv.infractionsCount >= 3) medioCount++;
      else baixoCount++;
    });

    const maxSpeed = allFilteredOccurrences.length > 0 
      ? Math.max(...allFilteredOccurrences.map(r => r.velocidade)) 
      : 0;

    return {
      totalInfractions: allFilteredOccurrences.length,
      totalDrivers: reportDriversRanking.length,
      totalTerra: terraOccurrences.length,
      totalVicinal: vicinalOccurrences.length,
      altoCount,
      medioCount,
      baixoCount,
      maxSpeedRegistered: maxSpeed
    };
  }, [terraOccurrences, vicinalOccurrences, reportDriversRanking, allFilteredOccurrences]);

  // Determine Evaluated Period String based on actual dataset dates if filters are empty
  const periodText = useMemo(() => {
    if (appliedStartDate && appliedEndDate) {
      try {
        const sDate = format(new Date(appliedStartDate), 'dd/MM/yyyy');
        const eDate = format(new Date(appliedEndDate), 'dd/MM/yyyy');
        return `${sDate} A ${eDate}`;
      } catch (err) {
        return 'PERÍODO SELECIONADO';
      }
    }
    
    if (allFilteredOccurrences.length === 0) return 'PERÍODO COMPLETO';

    try {
      const dates = allFilteredOccurrences.map(r => ensureDate(r.dataHora).getTime());
      const minDate = new Date(Math.min(...dates));
      const maxDate = new Date(Math.max(...dates));
      return `${format(minDate, 'dd/MM/yyyy')} A ${format(maxDate, 'dd/MM/yyyy')}`;
    } catch (e) {
      return 'HISTÓRICO OPERACIONAL';
    }
  }, [appliedStartDate, appliedEndDate, allFilteredOccurrences]);

  // Current Date and Time of Emission
  const invoiceDateTime = useMemo(() => {
    const now = new Date();
    return {
      date: format(now, 'dd/MM/yyyy'),
      time: format(now, 'HH:mm:ss')
    };
  }, []);

  // Automatic analysis generator text based on standard Solinftec requirements
  const getDriverAutomaticAnalysis = (name: string, riskLabel: string, maxSpeed: number, count: number, roadTypes: Set<string>) => {
    const roads = Array.from(roadTypes).join(' e ');
    if (riskLabel === 'ALTO RISCO') {
      return `O operador apresentou condução severamente acima do limite estabelecido para o tipo de via (${roads}), registrando velocidade máxima de ${maxSpeed.toFixed(1).replace('.', ',')} km/h com reincidências de padrão inadequado (${count} infrações). Recomenda-se orientação formal imediata e acompanhamento da condução sob supervisão.`;
    } else if (riskLabel === 'MÉDIO RISCO') {
      return `O operador apresentou condução acima do limite estabelecido para o tipo de via (${roads}), acumulando ${count} infrações e registrando velocidade máxima de ${maxSpeed.toFixed(1).replace('.', ',')} km/h. Recomenda-se orientação imediata e monitoramento contínuo da condução.`;
    } else {
      return `O operador apresentou condução acima do limite estabelecido para o tipo de via de forma pontual (${count} ocorrência) com velocidade máxima registrada de ${maxSpeed.toFixed(1).replace('.', ',')} km/h. Recomenda-se orientação educativa preventiva de segurança.`;
    }
  };

  // PDF Download Trigger
  const handleDownloadPDF = async () => {
    try {
      if (!pdfReportRef.current) return;

      const totalInRanking = dashboardRanking ? dashboardRanking.length : 0;
      const totalInReport = reportDriversRanking.length;

      if (totalInRanking !== totalInReport) {
        alert("Nem todos os motoristas foram incluídos no relatório.");
        return;
      }

      setGenerating(true);

      const canvas = await html2canvas(pdfReportRef.current, {
        scale: 1.8, // High resolution crisp output, scale optimal for memory & canvas limits
        useCORS: true,
        backgroundColor: '#FFFFFF',
        logging: false,
        windowWidth: 1200,
        windowHeight: pdfReportRef.current.scrollHeight || 2000
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const width = 210;
      const height = (canvas.height * width) / canvas.width;
      const pdf = new jsPDF('p', 'mm', [width, height]);
      
      pdf.addImage(imgData, 'JPEG', 0, 0, width, height);
      pdf.save(`RELATORIO_GERENCIAL_EXCESSO_VELOCIDADE_SOLINFTEC_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
      
      alert('Relatório Gerencial de Excesso de Velocidade SOLINFTEC em PDF gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF do ranking:', error);
      alert('Houve um erro técnico ao exportar o PDF. Por favor, tente novamente.');
    } finally {
      setGenerating(false);
    }
  };

  // Dynamic layout renderer (reused for both on-screen scroll preview and offscreen absolute PDF capture elements)
  const renderReportContent = (isPDFPrint: boolean = false) => {
    return (
      <div 
        style={{ 
          backgroundColor: '#FFFFFF',
          padding: isPDFPrint ? '50px 60px' : '0 10px',
          fontFamily: "'Inter', sans-serif" 
        }} 
        className="space-y-10"
      >
        {/* CABEÇALHO */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b-2 border-slate-900 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#0F172A] flex flex-col items-center justify-center text-white border border-slate-700 p-1 shrink-0 shadow-md">
              <div className="text-2xl">🛡️</div>
              <div className="text-[7px] font-black text-[#10B981] uppercase tracking-widest text-center leading-none mt-1">
                SOLINFTEC
              </div>
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-[#0F172A] uppercase">
                SOLINFTEC
              </h1>
              <p className="text-xs font-bold text-[#10B981] uppercase tracking-wider mt-0.5">
                Monitoramento Operacional & Segurança Viária
              </p>
            </div>
          </div>

          <div className="text-left md:text-right text-xs space-y-1">
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase block leading-none">Unidade Avaliada</span>
              <span className="font-extrabold text-slate-800 uppercase text-sm">{appliedUnidade === 'Todas' ? 'Todas as Unidades' : appliedUnidade}</span>
            </div>
            <div className="pt-1">
              <span className="text-[10px] font-black text-slate-400 uppercase block leading-none">Identificação do Documento</span>
              <span className="font-bold text-slate-700">SOLINFTEC-GCV-EMISSÃO: {invoiceDateTime.date} às {invoiceDateTime.time}</span>
            </div>
          </div>
        </div>

        {/* TÍTULO DO RELATÓRIO */}
        <div className="bg-[#0F172A] text-white p-6 md:p-8 rounded-3xl text-center space-y-2 relative overflow-hidden shadow-lg">
          <div className="absolute right-4 bottom-4 text-7xl opacity-5 select-none font-black">SOLINFTEC</div>
          <h2 className="text-2xl md:text-3xl font-black uppercase tracking-wider leading-none text-white">
            RELATÓRIO GERENCIAL DE EXCESSO DE VELOCIDADE
          </h2>
          <div className="text-sm font-extrabold text-[#10B981] tracking-[0.2em] uppercase leading-none mt-2">
            SOLINFTEC
          </div>
          <div className="text-[11px] font-semibold text-slate-300 tracking-[0.25em] h-5 flex items-center justify-center gap-2 uppercase mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse"></span>
            MONITORAMENTO OPERACIONAL E SEGURANÇA VIÁRIA
          </div>
          <div className="mt-4 inline-flex items-center gap-2 bg-white/10 px-4 py-1.5 rounded-full border border-white/10 text-[10px] font-extrabold uppercase tracking-widest text-[#10B981]">
            <Calendar size={12} />
            Período Avaliado: {periodText}
          </div>
        </div>

        {/* RESUMO EXECUTIVO */}
        <div className="space-y-4">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 border-b border-slate-200 pb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]"></span>
            Resumo Executivo do Período
          </h3>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between shadow-sm">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Infrações Identificadas</span>
              <h4 className="text-2xl font-black text-red-600 mt-2">{summaryKPIs.totalInfractions}</h4>
              <span className="text-[8px] text-slate-400 font-bold uppercase mt-1">Acima do Limite de Tratativa</span>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between shadow-sm">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Motoristas Notificados</span>
              <h4 className="text-2xl font-black text-[#0F172A] mt-2">{summaryKPIs.totalDrivers}</h4>
              <span className="text-[8px] text-slate-400 font-bold uppercase mt-1">Condutores Enquadrados</span>
            </div>

            <div className="p-4 bg-[#FFF7ED] border border-amber-200 rounded-2xl flex flex-col justify-between shadow-sm">
              <span className="text-[9px] font-black text-amber-800 uppercase tracking-wider block">Total Estrada de Terra</span>
              <h4 className="text-2xl font-black text-amber-600 mt-2">{summaryKPIs.totalTerra}</h4>
              <span className="text-[8px] text-amber-600 font-bold uppercase mt-1">Velocidades &gt; 45 km/h</span>
            </div>

            <div className="p-4 bg-[#EFF6FF] border border-blue-200 rounded-2xl flex flex-col justify-between shadow-sm">
              <span className="text-[9px] font-black text-blue-800 uppercase tracking-wider block">Total Vicinal Asfaltada</span>
              <h4 className="text-2xl font-black text-blue-600 mt-2">{summaryKPIs.totalVicinal}</h4>
              <span className="text-[8px] text-blue-600 font-bold uppercase mt-1">Velocidades &gt; 65 km/h</span>
            </div>

            <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl flex flex-col justify-between shadow-sm col-span-2 lg:col-span-1">
              <span className="text-[9px] font-black text-purple-800 uppercase tracking-wider block">Velocidade Máxima</span>
              <h4 className="text-2xl font-black text-purple-700 mt-2">
                {summaryKPIs.maxSpeedRegistered > 0 ? `${summaryKPIs.maxSpeedRegistered.toFixed(1).replace('.', ',')} km/h` : '---'}
              </h4>
              <span className="text-[8px] text-purple-500 font-bold uppercase mt-1">Pico Registrado</span>
            </div>
          </div>

          {/* RISK CATEGORY TALLIES BAR */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            <div className="flex items-center gap-3 p-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl text-red-700 text-xs font-bold uppercase">
              <span>🔴 Alto Risco</span>
              <div>
                <span className="text-[8px] text-slate-400 block font-semibold leading-none">ACIMA DE 5 INFRAÇÕES</span>
                <span className="font-extrabold text-sm">{summaryKPIs.altoCount}</span> motoristas qualificados
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-[#FFF7ED] border border-[#FDBA74] rounded-xl text-amber-700 text-xs font-bold uppercase">
              <span>🟡 Médio Risco</span>
              <div>
                <span className="text-[8px] text-slate-400 block font-semibold leading-none">3 A 5 INFRAÇÕES</span>
                <span className="font-extrabold text-sm">{summaryKPIs.medioCount}</span> motoristas qualificados
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl text-emerald-700 text-xs font-bold uppercase">
              <span>🟢 Baixo Risco</span>
              <div>
                <span className="text-[8px] text-slate-400 block font-semibold leading-none">ATÉ 2 INFRAÇÕES</span>
                <span className="font-extrabold text-sm">{summaryKPIs.baixoCount}</span> motoristas qualificados
              </div>
            </div>
          </div>
        </div>

        {/* RANKING DE MOTORISTAS */}
        <div className="space-y-4">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 border-b border-slate-200 pb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]"></span>
            Ranking Geral de Motoristas (Ordem de Reincidência)
          </h3>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#0F172A] text-white text-[10px] font-black uppercase tracking-wider">
                  <th className="p-3 w-14 text-center">Posição</th>
                  <th className="p-3">Nome do Operador</th>
                  <th className="p-3 w-28">Matrícula</th>
                  <th className="p-3 w-32 text-center">Qtd. Infrações</th>
                  <th className="p-3 w-40 text-center">Maior Velocidade</th>
                  <th className="p-3 w-36 text-center">Tipo de Via</th>
                  <th className="p-3 w-36 text-center">Risco</th>
                  <th className="p-3 w-36 text-right">Última Ocorrência</th>
                </tr>
              </thead>
              <tbody>
                {reportDriversRanking.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 font-bold uppercase tracking-wider">
                      Nenhum condutor enquadrado nos limiares de velocidade avaliados.
                    </td>
                  </tr>
                ) : (
                  reportDriversRanking.map((drv, index) => {
                    const risk = getDriverRisk(drv.infractionsCount);
                    const roadTypesStr = Array.from(drv.roadTypes).join(' / ') || 'N/A';
                    return (
                      <tr key={index} className="border-b border-slate-100 hover:bg-slate-50 font-medium text-slate-700">
                        <td className="p-3 text-center font-black text-[#0F172A] border-r border-slate-100 text-sm">{index + 1}</td>
                        <td className="p-3 font-extrabold uppercase text-slate-900 truncate max-w-[200px]">{drv.name}</td>
                        <td className="p-3 font-semibold">{drv.matricula}</td>
                        <td className="p-3 text-center font-black text-sm text-red-600 bg-red-50/20">{drv.infractionsCount}</td>
                        <td className="p-3 text-center font-extrabold text-slate-900">{drv.maxSpeed.toFixed(1).replace('.', ',')} km/h</td>
                        <td className="p-3 text-center text-[10px] text-slate-500 font-bold">{roadTypesStr}</td>
                        <td className="p-3 text-center">
                          <span
                            style={{
                              backgroundColor: risk.bg,
                              color: risk.color,
                              borderColor: risk.border
                            }}
                            className="px-2 py-0.5 text-[8px] font-black rounded-full border uppercase tracking-widest inline-block"
                          >
                            {risk.label}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono text-[10px] text-slate-500">
                          {format(drv.lastOccurrence, 'dd/MM/yyyy HH:mm:ss')}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* DETALHAMENTO COMPLETO DAS INFRAÇÕES */}
        <div className="space-y-6 pt-2">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 border-b border-slate-200 pb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
            Detalhamento Completo das Infrações por Motorista
          </h3>

          <div className="space-y-6">
            {reportDriversRanking.length === 0 ? (
              <div className="p-6 text-center text-slate-400 bg-slate-50 border border-slate-200 rounded-2xl font-bold uppercase tracking-wider text-xs">
                Sem dados para detalhamento individual.
              </div>
            ) : (
              reportDriversRanking.map((drv, idx) => {
                const risk = getDriverRisk(drv.infractionsCount);
                
                // Fetch fields from the driver's records
                const uniqueUnidades = Array.from(new Set(drv.occurrences.map(o => o.unidade).filter(Boolean)));
                const displayUnidades = uniqueUnidades.length > 0 ? uniqueUnidades.join(', ') : (appliedUnidade !== 'Todas' ? appliedUnidade : 'Unidade Principal');
                
                const uniqueOperacoes = Array.from(new Set(drv.occurrences.map(o => o.operacao).filter(Boolean)));
                const displayOperacoes = uniqueOperacoes.length > 0 ? uniqueOperacoes.join(', ') : 'Operação de Safra';
                
                const uniqueFrotas = Array.from(new Set(drv.occurrences.map(o => o.frota).filter(Boolean)));
                const displayFrotas = uniqueFrotas.length > 0 ? uniqueFrotas.join(', ') : 'N/A';

                const analysisText = getDriverAutomaticAnalysis(drv.name, risk.label, drv.maxSpeed, drv.infractionsCount, drv.roadTypes);

                return (
                  <div 
                    key={idx} 
                    className="p-6 bg-slate-50/70 border-2 border-slate-200 rounded-3xl space-y-4 shadow-sm"
                    style={{ pageBreakInside: 'avoid' }}
                  >
                    {/* Header of Driver Card */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-3 border-b border-slate-200">
                      <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Nome do Operador</span>
                        <h4 className="text-lg font-black text-[#0F172A] uppercase leading-tight">{drv.name}</h4>
                      </div>
                      <div className="flex gap-2">
                        <span className="px-3 py-1 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700">
                          Matrícula: <strong>{drv.matricula}</strong>
                        </span>
                        <span 
                          style={{
                            backgroundColor: risk.bg,
                            color: risk.color,
                            borderColor: risk.border
                          }}
                          className="px-3 py-1 rounded-xl border text-[10px] font-black uppercase tracking-wider flex items-center"
                        >
                          {risk.label}
                        </span>
                      </div>
                    </div>

                    {/* Meta Fields Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-semibold text-slate-600 bg-white p-4 rounded-2xl border border-slate-100">
                      <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase block">Unidade</span>
                        <span className="text-slate-800 font-extrabold uppercase">{displayUnidades}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase block">Operação</span>
                        <span className="text-slate-800 font-extrabold uppercase line-clamp-1">{displayOperacoes}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase block">Frota</span>
                        <span className="text-slate-800 font-extrabold uppercase">{displayFrotas}</span>
                      </div>
                    </div>

                    {/* Nested Occurrences Table */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-black text-[#0F172A] uppercase tracking-widest block">Lista de Ocorrências</span>
                      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-100 text-slate-600 font-bold text-[9px] uppercase tracking-wider">
                              <th className="p-3 w-28">Data</th>
                              <th className="p-3 w-24">Hora</th>
                              <th className="p-3">Tipo de Via</th>
                              <th className="p-3 text-center w-36 bg-amber-50">Velocidade</th>
                              <th className="p-3 text-center w-28">Limite</th>
                              <th className="p-3 text-center w-28 text-red-600 font-bold">Excesso</th>
                              <th className="p-3 text-right">Localização no Mapa (GPS)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {drv.occurrences.map((occ, oIdx) => {
                              const roadType = getRoadTypeByRecord(occ);
                              const dateFormatted = format(ensureDate(occ.dataHora), 'dd/MM/yyyy');
                              const timeFormatted = format(ensureDate(occ.dataHora), 'HH:mm:ss');
                              const limitVal = (occ as any).roadLimit || (roadType === 'Estrada de Terra' ? 40 : 60);
                              const excessVal = (occ as any).excesso !== undefined ? (occ as any).excesso : occ.velocidade - limitVal;

                              return (
                                <tr key={oIdx} className="border-b border-slate-100 font-medium hover:bg-slate-50/50">
                                  <td className="p-3 text-slate-700 font-bold">{dateFormatted}</td>
                                  <td className="p-3 text-slate-500">{timeFormatted}</td>
                                  <td className="p-3 text-[10px] font-extrabold text-[#0D9488] uppercase">{roadType}</td>
                                  <td className="p-3 text-center font-black text-amber-700 bg-amber-50/35">{occ.velocidade.toFixed(1).replace('.', ',')} km/h</td>
                                  <td className="p-3 text-center text-slate-500 font-bold">{limitVal} km/h</td>
                                  <td className="p-3 text-center text-red-600 font-black">+{excessVal.toFixed(1).replace('.', ',')} km/h</td>
                                  <td className="p-3 text-right">
                                    <a 
                                      href={`https://www.google.com/maps/search/?api=1&query=${occ.latitude},${occ.longitude}`}
                                      target="_blank" 
                                      referrerPolicy="no-referrer"
                                      className="inline-flex items-center gap-1 text-[10px] font-extrabold p-1 px-2 text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg uppercase tracking-wider"
                                    >
                                      📌 Lat: {occ.latitude?.toFixed(5) || '---'}, Lon: {occ.longitude?.toFixed(5) || '---'}
                                    </a>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Automatic analysis field */}
                    <div className="bg-[#1E293B]/5 p-4 rounded-2xl border border-slate-300/60 text-xs">
                      <span className="text-[10px] font-black text-[#0F172A] uppercase tracking-widest block mb-1">
                        🔍 Análise Automática Gerencial
                      </span>
                      <p className="text-slate-800 font-semibold italic leading-relaxed">
                        &quot;{analysisText}&quot;
                      </p>
                    </div>

                    {/* Safety recommendation */}
                    <div className="p-4 bg-white rounded-2xl border border-dashed border-slate-300 flex flex-col md:flex-row justify-between items-start md:items-center gap-2 text-xs">
                      <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase block">Recomendação de Tratativa</span>
                        <span className="font-bold text-slate-800">{risk.recommendation}</span>
                      </div>
                      <span className="px-3 py-1 bg-slate-100 rounded-md text-[9px] font-black uppercase text-slate-500 tracking-wider">
                        Ação Corretiva Solinftec
                      </span>
                    </div>

                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* SEPARAÇÃO POR TIPO DE VIA */}
        <div style={{ pageBreakBefore: 'always' }} className="space-y-8 pt-4">
          <div className="border-b-2 border-slate-900 pb-2">
            <h3 className="text-sm font-black text-[#0F172A] uppercase tracking-widest flex items-center gap-2">
              📂 Separação por Categoria de Via
            </h3>
          </div>

          {/* SEÇÃO 1: ESTRADA DE TERRA */}
          <div className="space-y-4">
            <div style={{ borderColor: '#D97706' }} className="flex justify-between items-center border-b pb-2">
              <h4 className="text-sm font-black text-[#D97706] uppercase tracking-wider flex items-center gap-2">
                <span>🪵</span> SEÇÃO 1 - ESTRADA DE TERRA (EXCESSOS ACIMA DE 45 KM/H)
              </h4>
              <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black rounded-lg uppercase">
                {terraOccurrences.length} Ocorrências
              </span>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#0F172A] text-white text-[10px] font-black uppercase tracking-wider">
                    <th className="p-3 w-12 text-center">Pos</th>
                    <th className="p-3">Operador</th>
                    <th className="p-3 w-28">Matrícula</th>
                    <th className="p-3 w-24">Frota</th>
                    <th className="p-3">Operação</th>
                    <th className="p-3 w-24">Data</th>
                    <th className="p-3 w-20">Hora</th>
                    <th className="p-3 w-28 text-center bg-amber-950/20">Velocidade</th>
                    <th className="p-3 w-28 text-center">Excesso</th>
                    <th className="p-3 text-right">Localização (GPS)</th>
                  </tr>
                </thead>
                <tbody>
                  {terraOccurrences.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-6 text-center text-slate-400 font-bold uppercase tracking-wider">
                        Nenhum excesso acima de 40,0 km/h registrado em estradas de terra.
                      </td>
                    </tr>
                  ) : (
                    terraOccurrences.map((rec, index) => {
                      const dateFormatted = format(ensureDate(rec.dataHora), 'dd/MM/yyyy');
                      const timeFormatted = format(ensureDate(rec.dataHora), 'HH:mm:ss');
                      const driverName = rec.descricaoOperador ? String(rec.descricaoOperador).trim().toUpperCase() : 'MOTORISTA DESCONHECIDO';
                      const driverMat = rec.matricula ? String(rec.matricula).split('.')[0].replace(/^0+/, '').trim() : '---';
                      const excessSpeed = (rec as any).excesso !== undefined ? (rec as any).excesso : Math.max(0, rec.velocidade - 40);

                      return (
                        <tr key={index} className="border-b border-slate-100 hover:bg-slate-50 font-medium text-slate-700">
                          <td className="p-3 text-center font-black text-slate-900 border-r border-slate-100 text-xs">{index + 1}</td>
                          <td className="p-3 font-extrabold uppercase text-slate-900 truncate max-w-[150px]">{driverName}</td>
                          <td className="p-3 font-bold text-slate-600">{driverMat}</td>
                          <td className="p-3 font-semibold text-slate-500">{rec.frota || '---'}</td>
                          <td className="p-3 text-slate-500 text-[10px] truncate max-w-[120px] uppercase font-bold">{rec.operacao || 'N/A'}</td>
                          <td className="p-3 text-slate-700 font-bold">{dateFormatted}</td>
                          <td className="p-3 text-slate-500">{timeFormatted}</td>
                          <td className="p-3 text-center font-black text-amber-700 bg-amber-500/5 text-sm">
                            {rec.velocidade.toFixed(1).replace('.', ',')} km/h
                          </td>
                          <td className="p-3 text-center font-black text-red-600">
                            +{excessSpeed.toFixed(1).replace('.', ',')} km/h
                          </td>
                          <td className="p-3 text-right font-mono text-[9.5px] text-slate-400">
                            {rec.latitude?.toFixed(5) || '---'}, {rec.longitude?.toFixed(5) || '---'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SEÇÃO 2: VICINAL ASFALTADA */}
          <div className="space-y-4 pt-4">
            <div style={{ borderColor: '#1D61FF' }} className="flex justify-between items-center border-b pb-2">
              <h4 className="text-sm font-black text-[#1D61FF] uppercase tracking-wider flex items-center gap-2">
                <span>🚗</span> SEÇÃO 2 - VICINAL ASFALTADA (EXCESSOS ACIMA DE 60 KM/H)
              </h4>
              <span className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-black rounded-lg uppercase">
                {vicinalOccurrences.length} Ocorrências
              </span>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#0F172A] text-white text-[10px] font-black uppercase tracking-wider">
                    <th className="p-3 w-12 text-center">Pos</th>
                    <th className="p-3">Operador</th>
                    <th className="p-3 w-28">Matrícula</th>
                    <th className="p-3 w-24">Frota</th>
                    <th className="p-3">Operação</th>
                    <th className="p-3 w-24">Data</th>
                    <th className="p-3 w-20">Hora</th>
                    <th className="p-3 w-28 text-center bg-blue-950/20">Velocidade</th>
                    <th className="p-3 w-28 text-center">Excesso</th>
                    <th className="p-3 text-right">Localização (GPS)</th>
                  </tr>
                </thead>
                <tbody>
                  {vicinalOccurrences.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-6 text-center text-slate-400 font-bold uppercase tracking-wider">
                        Nenhum excesso acima de 60,0 km/h registrado em vicinais asfaltadas.
                      </td>
                    </tr>
                  ) : (
                    vicinalOccurrences.map((rec, index) => {
                      const dateFormatted = format(ensureDate(rec.dataHora), 'dd/MM/yyyy');
                      const timeFormatted = format(ensureDate(rec.dataHora), 'HH:mm:ss');
                      const driverName = rec.descricaoOperador ? String(rec.descricaoOperador).trim().toUpperCase() : 'MOTORISTA DESCONHECIDO';
                      const driverMat = rec.matricula ? String(rec.matricula).split('.')[0].replace(/^0+/, '').trim() : '---';
                      const excessSpeed = (rec as any).excesso !== undefined ? (rec as any).excesso : Math.max(0, rec.velocidade - 60);

                      return (
                        <tr key={index} className="border-b border-slate-100 hover:bg-slate-50 font-medium text-slate-700">
                          <td className="p-3 text-center font-black text-slate-900 border-r border-slate-100 text-xs">{index + 1}</td>
                          <td className="p-3 font-extrabold uppercase text-slate-900 truncate max-w-[150px]">{driverName}</td>
                          <td className="p-3 font-bold text-slate-600">{driverMat}</td>
                          <td className="p-3 font-semibold text-slate-500">{rec.frota || '---'}</td>
                          <td className="p-3 text-slate-500 text-[10px] truncate max-w-[120px] uppercase font-bold">{rec.operacao || 'N/A'}</td>
                          <td className="p-3 text-slate-700 font-bold">{dateFormatted}</td>
                          <td className="p-3 text-slate-500">{timeFormatted}</td>
                          <td className="p-3 text-center font-black text-blue-700 bg-blue-500/5 text-sm">
                            {rec.velocidade.toFixed(1).replace('.', ',')} km/h
                          </td>
                          <td className="p-3 text-center font-black text-red-600">
                            +{excessSpeed.toFixed(1).replace('.', ',')} km/h
                          </td>
                          <td className="p-3 text-right font-mono text-[9.5px] text-slate-400">
                            {rec.latitude?.toFixed(5) || '---'}, {rec.longitude?.toFixed(5) || '---'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ASSINATURAS */}
        <div className="pt-16 grid grid-cols-1 md:grid-cols-2 gap-10" style={{ pageBreakInside: 'avoid' }}>
          <div className="flex flex-col items-center">
            <div className="w-2/3 border-b border-slate-400 h-1"></div>
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider mt-3">Responsável pela Emissão</span>
            <span className="text-[9px] text-slate-500 font-extrabold uppercase mt-1">SISTEMA G.C.V PRO SOLINFTEC</span>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-2/3 border-b border-slate-400 h-1"></div>
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider mt-3">Gestor Responsável</span>
            <span className="text-[9px] text-slate-500 font-extrabold uppercase mt-1">SUPERVISÃO DE SEGURANÇA VIÁRIA SOLINFTEC</span>
          </div>
        </div>

        {/* RODAPÉ */}
        <div className="pt-8 border-t border-slate-200 flex justify-between items-center text-[9px] text-slate-400 font-extrabold uppercase tracking-widest" style={{ pageBreakInside: 'avoid' }}>
          <span>SISTEMA DE AUDITORIA DIGITAL SOLINFTEC</span>
          <span>G.C.V PRO - RELATÓRIO OFICIAL</span>
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-4 backdrop-blur-sm overflow-hidden"
    >
      <div
        style={{ backgroundColor: '#FFFFFF' }}
        className="rounded-[32px] w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl"
      >
        {/* MODAL CONTROL HEADER */}
        <div
          style={{ backgroundColor: '#0F172A' }}
          className="p-6 md:p-8 flex items-center justify-between text-white border-b border-white/5 shrink-0"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#10B981]/20 flex items-center justify-center text-[#10B981] border border-[#10B981]/30">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black italic tracking-tight uppercase">RELATÓRIO DE TRATATIVAS</h2>
              <p className="text-[10px] uppercase font-black text-[#10B981] tracking-[0.2em] mt-1">SOLINFTEC MONITORAMENTO VIÁRIO</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadPDF}
              disabled={generating}
              style={{ backgroundColor: '#10B981' }}
              className={`px-5 py-2.5 h-11 rounded-xl text-white text-xs font-black uppercase tracking-wider transition-all shadow-md hover:bg-[#0e9f6e] cursor-pointer flex items-center gap-2 ${generating ? 'opacity-50' : ''}`}
            >
              {generating ? (
                <>Exportando PDF...</>
              ) : (
                <>
                  <span>📄</span> GERAR PDF
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* MODAL BODY (PREVIEW SCREEN) */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-slate-100 flex justify-center">
          <div className="bg-white w-full max-w-5xl rounded-3xl shadow-xl p-8 space-y-8 text-neutral-900 border border-slate-200">
            <div className="text-center py-2 text-slate-500 font-bold text-xs uppercase tracking-widest border-b border-dashed border-slate-200">
              Visualização Prévia do Relatório Oficial de Tratativas (SOLINFTEC)
            </div>

            {renderReportContent(false)}
          </div>
        </div>

        {/* ABSOLUTE OFFSCREEN RENDER AREA FOR HIGH QUALITY CANVAS EXPORT */}
        <div
          ref={pdfReportRef}
          style={{
            position: 'absolute',
            left: '-9999px',
            top: 0,
            width: '1100px',
            height: 'auto',
            backgroundColor: '#FFFFFF',
            padding: '50px 60px',
            color: '#000000'
          }}
        >
          {renderReportContent(true)}
        </div>
      </div>
    </motion.div>
  );
}
