import { useState } from "react";
import { Checklist, PepBlock } from "@/lib/checklistStorage";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, CircleDot, XCircle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

export function PreviewPaciente({ checklist }: { checklist: Checklist }) {
  // Map of block ID to selected score key
  const [selections, setSelections] = useState<Record<string, "adequado" | "parcial" | "inadequado">>({});

  const handleSelect = (blockId: string, state: "adequado" | "parcial" | "inadequado") => {
    setSelections(prev => ({
      ...prev,
      [blockId]: state
    }));
  };

  const handleReset = () => setSelections({});

  const maxPossible = checklist.pepBlocks.reduce((sum, b) => sum + b.scoreAdequado, 0);
  
  const currentScore = checklist.pepBlocks.reduce((sum, block) => {
    const state = selections[block.id];
    if (state === "adequado") return sum + block.scoreAdequado;
    if (state === "parcial") return sum + block.scoreParcial;
    return sum;
  }, 0);

  const percentage = maxPossible > 0 ? (currentScore / maxPossible) * 100 : 0;

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-32">
      <div className="px-1">
        <h1 className="text-2xl font-bold tracking-tight mb-2">Visão do Paciente (Avaliador)</h1>
        <p className="text-muted-foreground text-sm">Assim que o avaliador verá a estação durante a simulação.</p>
      </div>

      <Card className="p-6 rounded-2xl shadow-sm border-border/50 bg-muted/20">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Roteiro do Paciente</h3>
        <div className="p-4 bg-background rounded-xl border border-border shadow-xs">
          <p className="whitespace-pre-wrap font-medium font-serif leading-relaxed text-[15px]">
            {checklist.roteiroPaciente || "Nenhum roteiro preenchido."}
          </p>
        </div>
      </Card>

      <div className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground ml-1">Padrão Esperado de Procedimento (PEP)</h3>
        
        {checklist.pepBlocks.length === 0 ? (
          <p className="text-muted-foreground p-4 text-center border rounded-xl bg-card">Nenhum bloco PEP cadastrado.</p>
        ) : (
          checklist.pepBlocks.map((block) => (
            <InteractivePepBlock 
              key={block.id} 
              block={block} 
              selectedState={selections[block.id] || null} 
              onSelect={(state) => handleSelect(block.id, state)} 
            />
          ))
        )}
      </div>

      {/* Floating Sticky Score Summary */}
      <div className="fixed bottom-24 right-4 left-4 md:left-auto md:w-[400px] z-30">
        <Card className="p-4 rounded-2xl shadow-lg border-border/50 backdrop-blur-xl bg-background/80 flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pontuação atual</p>
              <p className="text-xl font-extrabold tabular-nums">
                <span className={cn(
                  percentage >= 70 ? "text-emerald-500" : percentage >= 40 ? "text-amber-500" : "text-foreground"
                )}>
                  {currentScore.toFixed(1)}
                </span>
                <span className="text-muted-foreground text-base font-semibold"> / {maxPossible.toFixed(1)} pts</span>
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleReset} title="Reiniciar avalição" className="h-8 w-8 text-muted-foreground">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div 
              className={cn(
                "h-full transition-all duration-500 ease-out",
                percentage >= 70 ? "bg-emerald-500" : percentage >= 40 ? "bg-amber-500" : "bg-primary"
              )}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

function InteractivePepBlock({ 
  block, 
  selectedState, 
  onSelect 
}: { 
  block: PepBlock; 
  selectedState: "adequado" | "parcial" | "inadequado" | null;
  onSelect: (state: "adequado" | "parcial" | "inadequado") => void;
}) {
  const getGlassStyles = () => {
    if (selectedState === "adequado") return "bg-emerald-500/10 dark:bg-emerald-400/10 border-emerald-400/40 shadow-[0_0_24px_-6px_rgba(16,185,129,0.35)] backdrop-blur-md";
    if (selectedState === "parcial") return "bg-amber-400/10 dark:bg-amber-300/10 border-amber-400/40 shadow-[0_0_24px_-6px_rgba(245,158,11,0.35)] backdrop-blur-md";
    if (selectedState === "inadequado") return "bg-rose-500/10 dark:bg-rose-400/10 border-rose-400/40 shadow-[0_0_24px_-6px_rgba(244,63,94,0.35)] backdrop-blur-md";
    return "bg-card border-border/50";
  };

  return (
    <Card className={cn("relative p-5 rounded-2xl border transition-all duration-300", getGlassStyles())}>
      {selectedState && (
        <div className={cn(
          "absolute top-4 right-4 px-2.5 py-0.5 rounded-full text-xs font-bold border backdrop-blur-sm shadow-sm",
          selectedState === "adequado" && "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
          selectedState === "parcial" && "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30",
          selectedState === "inadequado" && "bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-500/30"
        )}>
          {selectedState === "adequado" && "Adequado"}
          {selectedState === "parcial" && "Parcial"}
          {selectedState === "inadequado" && "Inadequado"}
        </div>
      )}

      <div className="mb-4 pr-24">
        <h3 className="text-lg font-bold mb-1 leading-tight">{block.titulo || "Bloco sem título"}</h3>
        {block.texto && <p className="text-muted-foreground text-sm leading-relaxed">{block.texto}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <ScoreButton 
          type="adequado" 
          label="Adequado" 
          score={block.scoreAdequado} 
          isSelected={selectedState === "adequado"} 
          onClick={() => onSelect("adequado")} 
        />
        <ScoreButton 
          type="parcial" 
          label="Parcial" 
          score={block.scoreParcial} 
          isSelected={selectedState === "parcial"} 
          onClick={() => onSelect("parcial")} 
        />
        <ScoreButton 
          type="inadequado" 
          label="Inadequado" 
          score={0} 
          isSelected={selectedState === "inadequado"} 
          onClick={() => onSelect("inadequado")} 
        />
      </div>
    </Card>
  );
}

function ScoreButton({ 
  type, 
  label, 
  score, 
  isSelected, 
  onClick 
}: { 
  type: "adequado" | "parcial" | "inadequado"; 
  label: string; 
  score: number; 
  isSelected: boolean; 
  onClick: () => void; 
}) {
  const Icon = type === "adequado" ? CheckCircle2 : type === "parcial" ? CircleDot : XCircle;
  
  const colors = {
    adequado: {
      selected: "border-emerald-500 bg-emerald-500/10",
      hover: "hover:border-emerald-500/50 hover:bg-emerald-500/5",
      icon: "text-emerald-500"
    },
    parcial: {
      selected: "border-amber-500 bg-amber-500/10",
      hover: "hover:border-amber-500/50 hover:bg-amber-500/5",
      icon: "text-amber-500"
    },
    inadequado: {
      selected: "border-rose-500 bg-rose-500/10",
      hover: "hover:border-rose-500/50 hover:bg-rose-500/5",
      icon: "text-rose-500"
    }
  };

  return (
    <div 
      className={cn(
        "flex flex-row sm:flex-col items-center sm:items-start justify-between sm:justify-start gap-2 p-3 rounded-xl border bg-card/80 cursor-pointer transition-all",
        isSelected ? colors[type].selected : colors[type].hover
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn("w-5 h-5", colors[type].icon)} strokeWidth={1.5} />
        <span className="font-semibold text-sm sm:text-xs">{label}</span>
      </div>
      <span className="tabular-nums font-medium text-sm sm:mt-1 sm:ml-7 text-muted-foreground">{score.toFixed(1)} pts</span>
    </div>
  );
}
