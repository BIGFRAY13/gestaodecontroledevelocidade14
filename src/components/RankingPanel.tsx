import { motion } from 'motion/react';
import { TelemetryRecord } from '../types';
import { Award, AlertTriangle, TrendingDown } from 'lucide-react';

interface RankingPanelProps {
  data: TelemetryRecord[];
}

export default function RankingPanel({ data }: RankingPanelProps) {
  // Logic to calculate ranking by operator (e.g., speed violations)
  const ranking = Array.from(data.reduce((acc, curr) => {
    const operator = curr.descricaoOperador || 'Desconhecido';
    if (!acc.has(operator)) {
      acc.set(operator, { name: operator, violations: 0, avgSpeed: 0, count: 0 });
    }
    const stats = acc.get(operator)!;
    if (curr.velocidade > 60) stats.violations += 1;
    stats.avgSpeed += curr.velocidade;
    stats.count += 1;
    return acc;
  }, new Map<string, any>()).values())
  .map(s => ({ ...s, avgSpeed: Math.round(s.avgSpeed / s.count) }))
  .sort((a, b) => a.violations - b.violations || b.count - a.count);

  return (
    <div className="glass-card p-6 flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Award className="text-brand" size={20} />
          Ranking de Performance
        </h3>
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Top 5 Operadores</span>
      </div>

      <div className="space-y-4 flex-1">
        {ranking.slice(0, 5).map((item, idx) => (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            key={item.name} 
            className="group flex items-center gap-4 p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/10 transition-all"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
              idx === 0 ? 'bg-brand/20 text-brand' : 
              idx === 1 ? 'bg-slate-500/20 text-slate-400' : 
              'bg-white/5 text-slate-600'
            }`}>
              #{idx + 1}
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{item.name}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1">
                  Vel. Média: <span className="text-slate-300">{item.avgSpeed}km/h</span>
                </span>
              </div>
            </div>

            <div className="text-right">
              <div className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest ${item.violations > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                {item.violations > 0 ? <AlertTriangle size={12} /> : <Award size={12} />}
                {item.violations} Infrações
              </div>
            </div>
          </motion.div>
        ))}

        {ranking.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500 italic">
            <TrendingDown size={32} className="mb-2 opacity-20" />
            <p className="text-xs">Nenhum dado para ranqueamento.</p>
          </div>
        )}
      </div>
      
      <button className="mt-4 w-full py-3 text-xs font-bold text-brand hover:bg-brand/5 rounded-xl transition-all">
        Ver Relatório Completo
      </button>
    </div>
  );
}
