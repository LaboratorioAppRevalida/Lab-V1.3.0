import { useState } from "react";
import { ClipboardPaste, Wand2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import type { PepBlock } from "@/lib/checklistStorage";

function generateId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(2, 9);
}

export function parseChecklistToForm(rawText: string): PepBlock[] {
  const lines = rawText.split("\n");
  const result: PepBlock[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const match = line.match(/^(.+?)\s*[-–—]\s*(\d+(?:[.,]\d+)?)\s*$/);
    if (!match) continue;

    const titulo = match[1].trim();
    const scoreAdequado = parseFloat(match[2].replace(",", "."));

    if (!titulo || isNaN(scoreAdequado) || scoreAdequado < 0) continue;

    result.push({
      id: generateId(),
      titulo,
      texto: "",
      scoreAdequado,
      scoreParcial: Math.round((scoreAdequado / 2) * 10) / 10,
    });
  }

  return result;
}

interface Props {
  onApply: (blocks: PepBlock[]) => void;
}

export function RawChecklistParserBlock({ onApply }: Props) {
  const [raw, setRaw] = useState("");
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const handleApply = () => {
    setFeedback(null);
    if (!raw.trim()) {
      setFeedback({ type: "error", msg: "Cole o checklist antes de preencher." });
      return;
    }
    try {
      const blocks = parseChecklistToForm(raw);
      if (blocks.length === 0) {
        setFeedback({
          type: "error",
          msg: "Nenhuma linha válida encontrada. Certifique-se de usar o formato: Descrição - pontuação (ex: Realiza higiene das mãos - 0.5)",
        });
        return;
      }
      onApply(blocks);
      setFeedback({ type: "success", msg: `${blocks.length} item${blocks.length > 1 ? "s" : ""} adicionado${blocks.length > 1 ? "s" : ""} ao editor.` });
      setRaw("");
    } catch {
      setFeedback({ type: "error", msg: "Ocorreu um erro ao processar o texto. Tente novamente." });
    }
  };

  return (
    <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setFeedback(null); }}
        className="w-full flex items-center gap-3 px-6 py-4 hover:bg-muted/40 transition-colors text-left"
      >
        <div className="w-8 h-8 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-300 flex items-center justify-center shrink-0">
          <ClipboardPaste className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">Colar checklist bruto</div>
          <div className="text-xs text-muted-foreground">
            Cole um checklist em texto e preencha o editor automaticamente — opcional
          </div>
        </div>
        <span className="text-xs font-semibold text-muted-foreground shrink-0">
          {open ? "Fechar ▲" : "Abrir ▼"}
        </span>
      </button>

      {open && (
        <div className="px-6 pb-6 flex flex-col gap-4 border-t border-border/50">
          <div className="pt-4 flex flex-col gap-1.5">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Cole cada item em uma linha, no formato{" "}
              <code className="font-mono bg-muted px-1 py-0.5 rounded text-[11px]">
                Descrição - pontuação
              </code>
              . Linhas inválidas são ignoradas.
            </p>
            <p className="text-xs text-muted-foreground/70">
              Exemplo: <span className="font-mono">Realiza higiene das mãos - 0.5</span>
            </p>
          </div>

          <Textarea
            value={raw}
            onChange={(e) => { setRaw(e.target.value); setFeedback(null); }}
            placeholder={"Realiza higiene das mãos - 0.5\nApresenta-se ao paciente - 0.5\nInvestiga dor abdominal - 1.0\nSolicita exame físico abdominal - 1.5"}
            className="min-h-[180px] font-mono text-sm resize-y"
          />

          {feedback && (
            <div
              className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${
                feedback.type === "success"
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-300/40"
                  : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-300/40"
              }`}
            >
              {feedback.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span>{feedback.msg}</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button
              type="button"
              onClick={handleApply}
              className="gradient-primary text-white border-0 shadow-sm"
            >
              <Wand2 className="w-4 h-4 mr-2" />
              Preencher automaticamente
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => { setRaw(""); setFeedback(null); }}
              className="text-muted-foreground"
            >
              Limpar
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
            Os itens serão <strong>adicionados</strong> ao editor existente. Você pode editar, reordenar ou remover qualquer item depois. O salvamento segue o fluxo normal.
          </p>
        </div>
      )}
    </Card>
  );
}
