import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return { hasError: true, message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught render error:", error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-xl p-8 flex flex-col items-center gap-6 text-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>

          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-semibold text-foreground">
              Ops! Algo deu errado
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Ocorreu um erro inesperado na renderização do aplicativo.
              Recarregue a página para tentar novamente.
            </p>
            {this.state.message && (
              <p className="mt-1 text-xs text-muted-foreground/60 font-mono bg-muted rounded-lg px-3 py-2 break-all">
                {this.state.message}
              </p>
            )}
          </div>

          <button
            onClick={this.handleReload}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 active:opacity-80"
          >
            <RefreshCw className="w-4 h-4" />
            Recarregar aplicativo
          </button>
        </div>
      </div>
    );
  }
}
