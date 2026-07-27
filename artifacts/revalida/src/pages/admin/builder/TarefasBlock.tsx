import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checklist } from "@/lib/checklistStorage";

interface TarefasBlockProps {
  checklist: Checklist;
  updateChecklist: (data: Partial<Checklist>) => void;
}

export function TarefasBlock({ checklist, updateChecklist }: TarefasBlockProps) {
  return (
    <Card className="p-6 rounded-2xl shadow-sm border-border/50 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[3px] gradient-primary" />
      
      <div className="flex items-center gap-2 mb-6">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg gradient-primary text-white font-bold shadow-sm">
          01
        </div>
        <h2 className="text-lg font-bold">Tarefas</h2>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label className="font-semibold text-sm">Cenário de atuação</Label>
          <Textarea 
            placeholder="Ex: Atendimento ambulatorial na UBS..."
            className="min-h-[100px] resize-y"
            value={checklist.cenarioAtuacao}
            onChange={(e) => updateChecklist({ cenarioAtuacao: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">Descreva o contexto onde o atendimento ocorre (pronto-socorro, UBS, enfermaria, etc). A primeira linha será usada como título do checklist.</p>
        </div>

        <div className="space-y-2">
          <Label className="font-semibold text-sm">Descrição do caso</Label>
          <Textarea 
            placeholder="Resumo clínico do paciente para o candidato..."
            className="min-h-[100px] resize-y"
            value={checklist.descricaoCaso}
            onChange={(e) => updateChecklist({ descricaoCaso: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">Informações clínicas que o candidato lerá antes de entrar na estação.</p>
        </div>

        <div className="space-y-2">
          <Label className="font-semibold text-sm">Tarefas</Label>
          <Textarea 
            placeholder="1. Realizar anamnese...&#10;2. Solicitar exames..."
            className="min-h-[100px] resize-y"
            value={checklist.tarefas}
            onChange={(e) => updateChecklist({ tarefas: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">O que o candidato deve executar na estação (ex: realizar anamnese, dar diagnóstico, orientar tratamento).</p>
        </div>
      </div>
    </Card>
  );
}
