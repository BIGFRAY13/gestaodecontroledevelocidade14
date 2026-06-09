import { ReactNode, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';

interface LayoutProps {
  children: ReactNode;
  onNavigate: (page: string) => void;
  currentPage: string;
  onBackToLanding?: () => void;
}

export default function Layout({ children, onNavigate, currentPage, onBackToLanding }: LayoutProps) {
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-background flex text-slate-200">
      <Sidebar 
        isOpen={isSidebarOpen} 
        toggleSidebar={() => setSidebarOpen(!isSidebarOpen)} 
        onNavigate={onNavigate}
        currentPage={currentPage}
        onBackToLanding={onBackToLanding}
      />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar 
          toggleSidebar={() => setSidebarOpen(!isSidebarOpen)} 
          isSidebarOpen={isSidebarOpen}
        />
        
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
