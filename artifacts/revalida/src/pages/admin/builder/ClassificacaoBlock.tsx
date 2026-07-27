import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checklist } from "@/lib/checklistStorage";

interface ClassificacaoBlockProps {
  checklist: Checklist;
  updateChecklist: (data: Partial<Checklist>) => void;
  errors: Record<string, string>;
}

export function ClassificacaoBlock({ checklist, updateChecklist, errors }: ClassificacaoBlockProps) {
  const grandesAreas = [
    "Clínica médica",
    "Cirurgia",
    "Pediatria",
    "Ginecologia e Obstetrícia",
    "Medicina de Família e Comunidade"
  ];

  return (
    <Card className="p-6 rounded-2xl shadow-sm border-border/50 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[3px] gradient-primary" />
      <h2 className="text-lg font-bold mb-4">Classificação</h2>

      <div className="space-y-2 mb-4">
        <Label className={errors.title ? "text-destructive" : ""}>
          Nome do checklist <span className="text-destructive">*</span>
        </Label>
        <Input
          placeholder="Ex: Dor torácica em adulto jovem"
          value={checklist.title}
          onChange={(e) => updateChecklist({ title: e.target.value })}
          className={`text-base font-semibold ${errors.title ? "border-destructive" : ""}`}
        />
        {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className={errors.grandeArea ? "text-destructive" : ""}>Grande área</Label>
          <Select 
            value={checklist.grandeArea} 
            onValueChange={(val) => updateChecklist({ grandeArea: val })}
          >
            <SelectTrigger className={errors.grandeArea ? "border-destructive" : ""}>
              <SelectValue placeholder="Selecione a grande área" />
            </SelectTrigger>
            <SelectContent>
              {grandesAreas.map(area => (
                <SelectItem key={area} value={area}>{area}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.grandeArea && <p className="text-xs text-destructive">{errors.grandeArea}</p>}
        </div>

        <div className="space-y-2">
          <Label className={errors.subarea ? "text-destructive" : ""}>Subárea</Label>
          <Input 
            placeholder="Ex: Cardiologia"
            value={checklist.subarea}
            onChange={(e) => updateChecklist({ subarea: e.target.value })}
            className={errors.subarea ? "border-destructive" : ""}
          />
          {errors.subarea && <p className="text-xs text-destructive">{errors.subarea}</p>}
        </div>
      </div>
    </Card>
  );
}
