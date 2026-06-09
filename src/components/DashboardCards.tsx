import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, Users, DollarSign, Briefcase, Activity } from 'lucide-react';

interface Props {
  data: {
    title: string;
    value: string | number;
    icon: any;
    color: string;
  }[];
}

export default function DashboardCards({ data }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 justify-items-center justify-center w-full max-w-7xl mx-auto">
      {data.map((kpi, index) => (
        <motion.div
          key={kpi.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          style={{ 
            backgroundColor: '#FFFFFF',
            border: `2px solid ${kpi.color}`,
            width: '3cm',
            height: '3cm',
            minWidth: '3cm',
            maxWidth: '3cm',
            minHeight: '3cm',
            maxHeight: '3cm',
            boxShadow: '0 15px 35px rgba(15, 23, 42, 0.05)'
          }}
          className="p-2.5 flex flex-col justify-between items-center text-center group rounded-[20px] mx-auto transition-all hover:scale-[1.02]"
          id={`kpi-card-${index}`}
        >
          <div className="flex justify-center items-center mt-0.5">
            <div 
              style={{ backgroundColor: `${kpi.color}15` }}
              className="p-1.5 rounded-lg transition-all"
            >
              <kpi.icon style={{ color: kpi.color }} size={14} />
            </div>
          </div>
          
          <div className="flex flex-col items-center justify-center my-auto min-w-0 w-full px-1">
            <p className="text-slate-500 text-[7px] font-black uppercase tracking-[0.08em] mb-0.5 leading-tight w-full truncate">
              {kpi.title}
            </p>
            <h3 style={{ color: '#0F172A' }} className="text-lg font-black tracking-tight leading-none">
              {kpi.value}
            </h3>
          </div>
          
          <div className="w-full mb-0.5 px-1">
            <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 1, delay: 0.5 + index * 0.1 }}
                style={{ backgroundColor: kpi.color }}
                className="h-full"
              />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
