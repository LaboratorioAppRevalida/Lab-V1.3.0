import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checklist, PepBlock } from "@/lib/checklistStorage";
import { Plus, GripVertical, Trash2, CheckCircle2, CircleDot, XCircle } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface PepBlocksEditorProps {
  checklist: Checklist;
  updateChecklist: (data: Partial<Checklist>) => void;
  errors: Record<string, string>;
}

function generateId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(2, 9);
}

export function PepBlocksEditor({ checklist, updateChecklist, errors }: PepBlocksEditorProps) {
  const addBlock = () => {
    const novoBloco: PepBlock = {
      id: generateId(),
      titulo: "",
      texto: "",
      scoreAdequado: 1.0,
      scoreParcial: 0.5
    };
    updateChecklist({ pepBlocks: [...checklist.pepBlocks, novoBloco] });
  };

  const updateBlock = (id: string, data: Partial<PepBlock>) => {
    updateChecklist({
      pepBlocks: checklist.pepBlocks.map(item => item.id === id ? { ...item, ...data } : item)
    });
  };

  const removeBlock = (id: string) => {
    updateChecklist({
      pepBlocks: checklist.pepBlocks.filter(item => item.id !== id)
    });
  };

  const maxScore = checklist.pepBlocks.reduce((sum, block) => sum + block.scoreAdequado, 0);
  const blockErrors = checklist.pepBlocks.some(b => !b.titulo.trim());

  return (
    <Card className="p-6 rounded-2xl shadow-sm border-border/50 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[3px] gradient-primary" />
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg gradient-primary text-white font-bold shadow-sm">
            04
          </div>
          <div>
            <h2 className="text-lg font-bold leading-tight">Padrão Esperado de Procedimento (PEP)</h2>
            <p className="text-sm text-muted-foreground">Blocos de avaliação interativos</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
          <div className="text-sm font-semibold whitespace-nowrap">
            Pontuação máxima: <span className="text-primary">{maxScore.toFixed(1)} pts</span>
          </div>
          <Button variant="outline" size="sm" onClick={addBlock} className="border-primary/50 text-primary hover:bg-primary/5">
            <Plus className="w-4 h-4 mr-2" />
            Adicionar bloco
          </Button>
        </div>
      </div>
      
      {errors.pepBlocks && <p className="text-sm text-destructive mb-4">{errors.pepBlocks}</p>}

      <div className="space-y-6">
        {checklist.pepBlocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl border-border/50 bg-muted/20">
            <p className="text-muted-foreground font-medium mb-4">Nenhum bloco PEP adicionado</p>
            <Button variant="outline" onClick={addBlock}>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar bloco
            </Button>
          </div>
        ) : (
          checklist.pepBlocks.map((block, index) => (
            <PepBlockItem 
              key={block.id} 
              block={block} 
              index={index}
              updateBlock={updateBlock}
              removeBlock={removeBlock}
              hasError={!block.titulo.trim() && blockErrors}
            />
          ))
        )}
      </div>
    </Card>
  );
}

interface PepBlockItemProps {
  block: PepBlock;
  index: number;
  updateBlock: (id: string, data: Partial<PepBlock>) => void;
  removeBlock: (id: string) => void;
  hasError: boolean;
}

function PepBlockItem({ block, index, updateBlock, removeBlock, hasError }: PepBlockItemProps) {
  const [previewState, setPreviewState] = useState<"adequado" | "parcial" | "inadequado" | null>(null);

  const getGlassStyles = () => {
    if (previewState === "adequado") return "bg-emerald-500/10 dark:bg-emerald-400/10 border-emerald-400/40 shadow-[0_0_24px_-6px_rgba(16,185,129,0.35)] backdrop-blur-md";
    if (previewState === "parcial") return "bg-amber-400/10 dark:bg-amber-300/10 border-amber-400/40 shadow-[0_0_24px_-6px_rgba(245,158,11,0.35)] backdrop-blur-md";
    if (previewState === "inadequado") return "bg-rose-500/10 dark:bg-rose-400/10 border-rose-400/40 shadow-[0_0_24px_-6px_rgba(244,63,94,0.35)] backdrop-blur-md";
    return "bg-card border-border/50";
  };

  return (
    <Card className={cn("relative p-5 rounded-2xl border transition-all duration-300 scroll-mt-24", getGlassStyles())}>
      {previewState && (
        <div className={cn(
          "absolute top-4 right-12 px-2.5 py-0.5 rounded-full text-xs font-bold border backdrop-blur-sm",
          previewState === "adequado" && "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
          previewState === "parcial" && "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30",
          previewState === "inadequado" && "bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-500/30"
        )}>
          {previewState === "adequado" && "Adequado"}
          {previewState === "parcial" && "Parcial"}
          {previewState === "inadequado" && "Inadequado"}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <GripVertical className="w-4 h-4 cursor-grab" />
              <span className="text-xs font-bold uppercase tracking-wider">Bloco {index + 1}</span>
            </div>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive h-8 w-8 -mr-2" onClick={() => removeBlock(block.id)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>

          <Input 
            placeholder="Título da ação esperada"
            className={cn(
              "text-lg font-semibold border-x-0 border-t-0 border-b rounded-none px-0 h-auto py-1 shadow-none focus-visible:ring-0 focus-visible:border-primary bg-transparent",
              hasError && "border-destructive placeholder:text-destructive/60"
            )}
            value={block.titulo}
            onChange={(e) => updateBlock(block.id, { titulo: e.target.value })}
          />

          <Textarea 
            placeholder="Texto descritivo com mais detalhes sobre a ação esperada..."
            className="min-h-[80px] resize-y mt-2 bg-transparent"
            value={block.texto}
            onChange={(e) => updateBlock(block.id, { texto: e.target.value })}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-1 mb-1">
            <span className="text-xs font-semibold text-muted-foreground">Pontuação (prévia)</span>
          </div>

          {/* Adequado */}
          <div 
            className={cn(
              "flex items-center justify-between p-3 rounded-xl border bg-card/50 cursor-pointer transition-colors",
              previewState === "adequado" ? "border-emerald-500/50 bg-emerald-500/10" : "hover:border-emerald-500/30 hover:bg-emerald-500/5"
            )}
            onClick={() => setPreviewState(previewState === "adequado" ? null : "adequado")}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" strokeWidth={1.5} />
              <span className="font-medium text-sm">Adequado</span>
            </div>
            <Input 
              type="number" 
              step="0.1" 
              min="0"
              className="w-20 h-8 text-right tabular-nums bg-transparent"
              value={block.scoreAdequado}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => updateBlock(block.id, { scoreAdequado: Number(e.target.value) || 0 })}
            />
          </div>

          {/* Parcial */}
          <div 
            className={cn(
              "flex items-center justify-between p-3 rounded-xl border bg-card/50 cursor-pointer transition-colors",
              previewState === "parcial" ? "border-amber-500/50 bg-amber-500/10" : "hover:border-amber-500/30 hover:bg-amber-500/5"
            )}
            onClick={() => setPreviewState(previewState === "parcial" ? null : "parcial")}
          >
            <div className="flex items-center gap-2">
              <CircleDot className="w-5 h-5 text-amber-500" strokeWidth={1.5} />
              <span className="font-medium text-sm">Parcialmente</span>
            </div>
            <Input 
              type="number" 
              step="0.1" 
              min="0"
              className="w-20 h-8 text-right tabular-nums bg-transparent"
              value={block.scoreParcial}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => updateBlock(block.id, { scoreParcial: Number(e.target.value) || 0 })}
            />
          </div>

          {/* Inadequado */}
          <div 
            className={cn(
              "flex items-center justify-between p-3 rounded-xl border bg-card/50 cursor-pointer transition-colors",
              previewState === "inadequado" ? "border-rose-500/50 bg-rose-500/10" : "hover:border-rose-500/30 hover:bg-rose-500/5"
            )}
            onClick={() => setPreviewState(previewState === "inadequado" ? null : "inadequado")}
          >
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-rose-500" strokeWidth={1.5} />
              <span className="font-medium text-sm">Inadequado</span>
            </div>
            <div className="w-20 h-8 flex items-center justify-end pr-3 tabular-nums font-medium text-sm">
              0
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
