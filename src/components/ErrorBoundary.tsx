import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary Global] Ocorreu um erro não tratado:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-slate-900 flex flex-col items-center justify-center p-6 text-white select-none">
          <div className="max-w-md w-full bg-slate-800/80 backdrop-blur-md border border-white/10 rounded-3xl p-8 shadow-2xl text-center space-y-6 animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center justify-center mx-auto">
              <AlertTriangle size={32} />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-black uppercase tracking-tight text-white">Ops! Algo deu errado</h1>
              <p className="text-sm text-slate-400 leading-relaxed">
                Ocorreu um erro inesperado na interface do aplicativo. Mas não se preocupe, seus dados de telemetria continuam protegidos.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-slate-950/80 border border-white/5 rounded-2xl p-4 text-left max-h-[160px] overflow-y-auto">
                <p className="text-[10px] font-black uppercase text-red-400 tracking-wider mb-1">Detalhes Técnicos</p>
                <code className="text-xs font-mono text-slate-300 leading-normal block whitespace-pre-wrap">
                  {this.state.error.message || String(this.state.error)}
                </code>
              </div>
            )}

            <button
              onClick={this.handleReload}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-blue-600/15 hover:scale-[1.02] active:scale-[0.98]"
            >
              <RefreshCw size={14} />
              Recarregar Aplicativo
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
