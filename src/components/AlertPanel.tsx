import { motion, AnimatePresence } from 'motion/react';
import { TelemetryRecord } from '../types';
import { AlertCircle, Zap, ShieldAlert, History } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AlertPanelProps {
  data: TelemetryRecord[];
}

export default function AlertPanel({ data }: AlertPanelProps) {
  // Generate critical alerts from data
  const alerts = data.filter(record => record.velocidade > 80)
    .sort((a, b) => b.dataHora.getTime() - a.dataHora.getTime())
    .slice(0, 8);

  return (
    <div className="glass-card p-6 flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 shadow-lg shadow-rose-500/20">
            <ShieldAlert size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white leading-tight tracking-tight">Painel de Alertas</h3>
            <p className="text-[10px] text-rose-500 uppercase font-black tracking-widest">Nível Crítico</p>
          </div>
        </div>
        <History className="text-slate-600 hover:text-slate-300 transition-colors cursor-pointer" size={18} />
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
        <AnimatePresence>
          {alerts.map((alert, idx) => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              key={alert.id}
              className="p-4 rounded-2xl bg-rose-500/[0.03] border border-rose-500/10 hover:bg-rose-500/[0.06] transition-all group"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest bg-rose-500/10 px-2 py-0.5 rounded-full">
                  Excesso: {alert.velocidade} KM/H
                </span>
                <span className="text-[10px] text-slate-500 font-bold">
                  {format(alert.dataHora, "HH:mm:ss", { locale: ptBR })}
                </span>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-bold text-white group-hover:text-rose-400 transition-colors uppercase tracking-tight">
                    {alert.matricula}
                  </p>
                  <p className="text-[11px] text-slate-500 italic mt-0.5 truncate max-w-[200px]">
                    {alert.descricaoOperador}
                  </p>
                </div>
                <Zap size={16} className="text-rose-500 group-hover:scale-125 transition-transform" />
              </div>
            </motion.div>
          ))}

          {alerts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center text-slate-600">
              <AlertCircle size={40} className="mb-3 opacity-20" />
              <p className="text-sm font-medium">Nenhum alerta crítico ativo.</p>
              <p className="text-[10px] uppercase tracking-widest font-black mt-1 opacity-50">Sistema Estabilizado</p>
            </div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-4 pt-4 border-t border-white/5">
         <div className="flex items-center justify-between text-xs font-bold px-2">
            <span className="text-slate-500">Total Hoje:</span>
            <span className="text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-md">
              {data.filter(r => r.velocidade > 80).length} Incidentes
            </span>
         </div>
      </div>
    </div>
  );
}
