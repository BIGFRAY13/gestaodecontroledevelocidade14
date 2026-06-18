/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import MainLayout from './layouts/MainLayout';
import DashboardPage from './pages/Dashboard';
import LandingPage from './pages/LandingPage';

type AppState = 'landing' | 'dashboard';

export default function App() {
  const [currentView, setCurrentView] = useState<AppState>('landing');
  const [activeTab, setActiveTab] = useState('dashboard');

  const goToDashboard = () => setCurrentView('dashboard');
  
  if (currentView === 'landing') {
    return <LandingPage onStart={goToDashboard} />;
  }

  return (
    <MainLayout 
      onNavigate={setActiveTab} 
      currentPage={activeTab}
      onBackToLanding={() => setCurrentView('landing')}
    >
      {(activeTab === 'dashboard' || activeTab === 'road-config') ? (
        <DashboardPage activeTab={activeTab} />
      ) : (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-2">Página em Construção</h2>
            <p className="text-slate-400">Você está visualizando a seção: <span className="text-brand font-bold uppercase">{activeTab}</span></p>
            <button 
              onClick={() => setActiveTab('dashboard')}
              className="mt-6 px-6 py-2 bg-brand rounded-xl text-sm font-bold cursor-pointer"
            >
              Voltar ao Início
            </button>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
