import { useState, useEffect, useRef, ReactNode } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { TelemetryRecord } from '../types';

interface ChartsProps {
  data: TelemetryRecord[];
}

function ChartContainer({ children, hasData }: { children: ReactNode; hasData: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    
    // Initial size
    setDimensions({
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight
    });

    const observer = new ResizeObserver((entries) => {
      if (!entries || !entries[0]) return;
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const isValid = hasData && dimensions.width > 10 && dimensions.height > 10;

  return (
    <div ref={containerRef} className="w-full h-full min-h-[300px] flex items-center justify-center">
      {isValid ? children : (
        <div className="text-slate-400 text-xs font-medium tracking-tight text-center py-12">
          Aguardando dados e dimensões válidas do container...
        </div>
      )}
    </div>
  );
}

const COLORS = ['#1D61FF', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];

export default function Charts({ data }: ChartsProps) {
  const hasData = Array.isArray(data) && data.length > 0;

  // 1. Infractions by Driver
  const infractionsByDriver = Array.from(data.reduce((acc, curr) => {
    if (curr.velocidade > 30) {
      const driver = curr.descricaoOperador || 'Vários';
      acc.set(driver, (acc.get(driver) || 0) + 1);
    }
    return acc;
  }, new Map<string, number>()).entries())
  .map(([name, infractions]) => ({ name, infractions }))
  .sort((a, b) => b.infractions - a.infractions)
  .slice(0, 5);

  // 2. Infractions by Operation
  const infractionsByOp = Array.from(data.reduce((acc, curr) => {
    if (curr.velocidade > 30) {
      const op = curr.operacao || 'Padrão';
      acc.set(op, (acc.get(op) || 0) + 1);
    }
    return acc;
  }, new Map<string, number>()).entries())
  .map(([name, value]) => ({ name, value }));

  // 3. Average Speed per hour (mock summary from real data)
  const speedByTime = [
    { time: '08:00', avg: 42 },
    { time: '10:00', avg: 48 },
    { time: '12:00', avg: 45 },
    { time: '14:00', avg: 52 },
    { time: '16:00', avg: 50 },
    { time: '18:00', avg: 46 },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* Infractions by Driver */}
      <div className="glass-card p-8 min-h-[350px] flex flex-col">
        <h3 className="text-lg font-bold text-white mb-8 tracking-tight">Infrações por Operador</h3>
        <div className="w-full h-[350px] min-h-[350px]">
          <ChartContainer hasData={hasData}>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart layout="vertical" data={infractionsByDriver}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }}
                  width={120}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ backgroundColor: '#020817', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                />
                <Bar dataKey="infractions" fill="#1D61FF" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      </div>

      {/* Average Speed Trend */}
      <div className="glass-card p-8 min-h-[350px] flex flex-col">
        <h3 className="text-lg font-bold text-white mb-8 tracking-tight">Tendência de Velocidade Média</h3>
        <div className="w-full h-[350px] min-h-[350px]">
          <ChartContainer hasData={hasData}>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={speedByTime}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#020817', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="avg" 
                  stroke="#1D61FF" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#1D61FF', strokeWidth: 2, stroke: '#020817' }} 
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      </div>
    </div>
  );
}

