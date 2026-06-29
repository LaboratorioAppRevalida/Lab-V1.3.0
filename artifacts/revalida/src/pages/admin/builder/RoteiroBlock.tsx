import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checklist } from "@/lib/checklistStorage";

interface RoteiroBlockProps {
  checklist: Checklist;
  updateChecklist: (data: Partial<Checklist>) => void;
}

export function RoteiroBlock({ checklist, updateChecklist }: RoteiroBlockProps) {
  return (
    <Card className="p-6 rounded-2xl shadow-sm border-border/50 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[3px] gradient-primary" />
      
      <div className="flex items-center gap-2 mb-6">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg gradient-primary text-white font-bold shadow-sm">
          03
        </div>
        <h2 className="text-lg font-bold">Roteiro do paciente</h2>
      </div>

      <div className="space-y-2">
        <Label className="font-semibold text-sm">Roteiro do paciente</Label>
        <Textarea 
          placeholder="Você é João, 55 anos. Veio mostrar seus exames..."
          className="min-h-[180px] resize-y"
          value={checklist.roteiroPaciente}
          onChange={(e) => updateChecklist({ roteiroPaciente: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">Será exibido no topo da visão do paciente (ator) durante a simulação.</p>
      </div>
    </Card>
  );
}
