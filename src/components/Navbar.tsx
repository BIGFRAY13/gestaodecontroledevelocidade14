import { Bell, Search, User, Menu } from 'lucide-react';

interface NavbarProps {
  toggleSidebar: () => void;
  isSidebarOpen: boolean;
}

export default function Navbar({ toggleSidebar, isSidebarOpen }: NavbarProps) {
  return (
    <header className="h-20 border-b border-white/5 bg-background/50 backdrop-blur-xl flex items-center justify-between px-8 sticky top-0 z-40">
      <div className="flex items-center gap-4">
        {!isSidebarOpen && (
          <button 
            onClick={toggleSidebar}
            className="p-2 hover:bg-white/5 rounded-lg text-slate-400 cursor-pointer md:hidden"
            id="mobile-menu-toggle"
          >
            <Menu size={20} />
          </button>
        )}
        <div className="hidden md:flex items-center bg-white/5 border border-white/10 rounded-xl px-4 py-2 w-96 focus-within:border-brand/50 transition-all">
          <Search size={18} className="text-slate-500" />
          <input 
            type="text" 
            placeholder="Pesquisar..." 
            className="bg-transparent border-none outline-none ml-3 text-sm w-full text-slate-200 placeholder:text-slate-600"
            id="global-search"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <button className="relative p-2 text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-lg transition-all cursor-pointer" id="notifications-btn">
          <Bell size={20} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-brand rounded-full border-2 border-background" />
        </button>
        
        <div className="flex items-center gap-3 pl-6 border-l border-white/10">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold truncate leading-none">Luciano Germano</p>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Administrator</span>
          </div>
          <button className="w-10 h-10 rounded-full bg-brand/20 border border-brand/20 flex items-center justify-center text-brand cursor-pointer hover:scale-105 transition-all" id="profile-btn">
            <User size={20} />
          </button>
        </div>
      </div>
    </header>
  );
}
