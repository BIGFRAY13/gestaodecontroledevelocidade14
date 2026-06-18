import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  ArrowLeft,
  Building2
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  onNavigate: (page: string) => void;
  currentPage: string;
  onBackToLanding?: () => void;
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'road-config', label: 'Configuração de Vias', icon: Settings },
];

export default function Sidebar({ isOpen, toggleSidebar, onNavigate, currentPage, onBackToLanding }: SidebarProps) {
  return (
    <motion.aside
      initial={false}
      animate={{ width: isOpen ? 280 : 80 }}
      className="relative h-screen bg-[#0A0F1D] border-r border-white/5 flex flex-col z-50 shrink-0"
    >
      {/* Logo Section */}
      <div className="h-20 flex items-center px-6 gap-3 overflow-hidden">
        <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center shrink-0 shadow-lg shadow-brand/20">
          <Building2 className="text-white w-6 h-6" />
        </div>
        <AnimatePresence>
          {isOpen && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="font-bold text-xl tracking-tight whitespace-nowrap"
            >
              G.C.V <span className="text-brand">Pro</span>
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Toggle Button */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-24 w-6 h-6 bg-brand rounded-full flex items-center justify-center text-white shadow-xl hover:scale-110 transition-transform cursor-pointer"
        id="sidebar-toggle"
      >
        {isOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all relative group cursor-pointer ${
                isActive 
                  ? 'bg-brand/10 text-brand' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
              id={`nav-item-${item.id}`}
            >
              <item.icon className={`shrink-0 ${isActive ? 'text-brand' : 'text-slate-400 group-hover:text-slate-200'}`} size={20} />
              <AnimatePresence>
                {isOpen && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="whitespace-nowrap font-medium"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
              {isActive && (
                <motion.div 
                  layoutId="active-indicator"
                  className="absolute left-0 w-1 h-6 bg-brand rounded-full"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/5">
        <button 
          onClick={onBackToLanding}
          className="w-full flex items-center gap-3 p-3 text-slate-400 hover:text-brand hover:bg-brand/5 rounded-xl transition-all cursor-pointer"
          id="logout-button"
        >
          <ArrowLeft size={20} />
          {isOpen && <span className="font-medium">Voltar</span>}
        </button>
      </div>
    </motion.aside>
  );
}
