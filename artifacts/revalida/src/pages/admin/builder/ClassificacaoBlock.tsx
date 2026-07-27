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
    <Card className="p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 relative overflow-hidden bg-white dark:bg-slate-900">
      {/* Linha de topo verde/teal sólida */}
      <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-teal-500 to-emerald-500" />

      {/* Header do Bloco 01 igual aos demais */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-600 text-white font-bold text-sm shadow-sm shrink-0">
          01
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">
            Classificação
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Informações gerais de identificação do checklist
          </p>
        </div>
      </div>

      {/* Nome do checklist */}
      <div className="space-y-2 mb-4">
        <Label className={`font-semibold text-sm ${errors.title ? "text-rose-500" : "text-slate-700 dark:text-slate-200"}`}>
          Nome do checklist <span className="text-rose-500 font-bold">*</span>
        </Label>
        <Input
          placeholder="Ex: Dor torácica em adulto jovem"
          value={checklist.title || ""}
          onChange={(e) => updateChecklist({ title: e.target.value })}
          className={`h-11 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:border-emerald-500 font-semibold text-base rounded-xl ${
            errors.title ? "border-rose-500 focus-visible:ring-rose-500" : ""
          }`}
        />
        {errors.title && <p className="text-xs text-rose-500 font-semibold">{errors.title}</p>}
      </div>

      {/* Grande área e Subárea */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className={`font-semibold text-sm ${errors.grandeArea ? "text-rose-500" : "text-slate-700 dark:text-slate-200"}`}>
            Grande área
          </Label>
          <Select 
            value={checklist.grandeArea || ""} 
            onValueChange={(val) => updateChecklist({ grandeArea: val })}
          >
            <SelectTrigger className={`h-11 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 font-medium rounded-xl ${
              errors.grandeArea ? "border-rose-500" : ""
            }`}>
              <SelectValue placeholder="Selecione a grande área" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
              {grandesAreas.map(area => (
                <SelectItem key={area} value={area} className="focus:bg-emerald-50 dark:focus:bg-emerald-950/40">
                  {area}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.grandeArea && <p className="text-xs text-rose-500 font-semibold">{errors.grandeArea}</p>}
        </div>

        <div className="space-y-2">
          <Label className={`font-semibold text-sm ${errors.subarea ? "text-rose-500" : "text-slate-700 dark:text-slate-200"}`}>
            Subárea
          </Label>
          <Input 
            placeholder="Ex: Cardiologia"
            value={checklist.subarea || ""}
            onChange={(e) => updateChecklist({ subarea: e.target.value })}
            className={`h-11 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-emerald-500 font-medium rounded-xl ${
              errors.subarea ? "border-rose-500" : ""
            }`}
          />
          {errors.subarea && <p className="text-xs text-rose-500 font-semibold">{errors.subarea}</p>}
        </div>
      </div>
    </Card>
  );
}