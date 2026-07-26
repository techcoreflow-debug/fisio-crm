import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  erro: Error | null;
}

/**
 * Rede de segurança final: se algo quebrar durante o render (um bug que
 * escapou de todo o resto), a pessoa vê uma explicação e um botão pra
 * recarregar — nunca uma tela branca sem nenhum aviso.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { erro: null };

  static getDerivedStateFromError(erro: Error): State {
    return { erro };
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[Fisio] Erro não capturado:", erro, info.componentStack);
  }

  render() {
    if (this.state.erro) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-surface px-4 text-center">
          <AlertTriangle className="h-8 w-8 text-critical-400" />
          <p className="font-display font-semibold text-ink">Algo deu errado</p>
          <p className="max-w-md text-sm text-ink-soft">{this.state.erro.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-md bg-clinical-500 px-4 py-2 text-sm font-medium text-white hover:bg-clinical-600"
          >
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
