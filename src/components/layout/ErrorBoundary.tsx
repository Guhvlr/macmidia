import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen bg-[#020202] text-white flex flex-col items-center justify-center p-8 text-center">
          <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mb-6 border border-red-500/20">
            <AlertTriangle className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-xl font-black uppercase tracking-widest mb-2">Ops! Algo deu errado</h1>
          <p className="text-white/40 text-sm max-w-md mb-8 font-medium">
            Ocorreu um erro inesperado na interface. Isso pode ser causado por dados corrompidos no cache ou um bug temporário.
          </p>
          
          {this.state.error && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-8 w-full max-w-lg text-left overflow-auto max-h-40 custom-scrollbar">
              <p className="text-red-400 font-mono text-[10px] whitespace-pre-wrap">{this.state.error.stack}</p>
            </div>
          )}

          <div className="flex gap-4">
            <Button 
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              variant="outline"
              className="border-white/10 text-white/60 hover:text-white rounded-xl uppercase font-black tracking-widest text-[10px]"
            >
              <RotateCcw className="w-4 h-4 mr-2" /> Limpar Cache e Recarregar
            </Button>
            <Button 
              onClick={() => window.location.reload()}
              className="bg-primary hover:bg-primary/90 text-white rounded-xl uppercase font-black tracking-widest text-[10px]"
            >
              Tentar Novamente
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
