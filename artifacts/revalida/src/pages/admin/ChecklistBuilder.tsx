import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { ChevronLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type Checklist } from "@/lib/checklistStorage";
import {
  getChecklistById,
  createChecklist,
  updateChecklist,
  deleteChecklistById,
} from "@/lib/checklistService";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { ClassificacaoBlock } from "./builder/ClassificacaoBlock";
import { TarefasBlock } from "./builder/TarefasBlock";
import { ImpressosBlock } from "./builder/ImpressosBlock";
import { RoteiroBlock } from "./builder/RoteiroBlock";
import { PepBlocksEditor } from "./builder/PepBlock";
import { RawChecklistParserBlock } from "./builder/RawChecklistParser";
import { PreviewMedico } from "./builder/PreviewMedico";
import { PreviewPaciente } from "./builder/PreviewPaciente";

function generateId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(2, 9);
}

const emptyChecklist: Checklist = {
  id: "",
  title: "Novo checklist",
  grandeArea: "",
  subarea: "",
  cenarioAtuacao: "",
  descricaoCaso: "",
  tarefas: "",
  impressos: [],
  roteiroPaciente: "",
  pepBlocks: [
    {
      id: generateId(),
      titulo: "",
      texto: "",
      scoreAdequado: 1.0,
      scoreParcial: 0.5,
    },
  ],
  createdAt: "",
  updatedAt: "",
};

export default function ChecklistBuilder() {
  const [, params] = useRoute("/admin/checklists/editar/:id");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const isEditing = !!params?.id;

  const [checklist, setChecklist] = useState<Checklist>(emptyChecklist);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState("edicao");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isEditing && params?.id) {
      setIsLoading(true);
      getChecklistById(params.id)
        .then((existing) => {
          if (existing) {
            setChecklist(existing);
          } else {
            toast.error("Checklist não encontrado");
            setLocation("/admin/checklists");
          }
        })
        .catch(() => {
          toast.error("Erro ao carregar checklist");
          setLocation("/admin/checklists");
        })
        .finally(() => setIsLoading(false));
    } else {
      setChecklist({ ...emptyChecklist, id: generateId() });
    }
  }, [isEditing, params?.id, setLocation]);

  const updateChecklistData = (data: Partial<Checklist>) => {
    setChecklist((prev) => ({ ...prev, ...data }));
    if (Object.keys(data).length > 0) {
      const field = Object.keys(data)[0];
      if (errors[field]) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;

    const newErrors: Record<string, string> = {};
    if (!checklist.title.trim()) newErrors.title = "Nome do checklist é obrigatório";
    if (!checklist.grandeArea) newErrors.grandeArea = "Grande área é obrigatória";
    if (!checklist.subarea.trim()) newErrors.subarea = "Subárea é obrigatória";
    const hasValidPepBlock = checklist.pepBlocks.some((b) => b.titulo.trim() !== "");
    if (!hasValidPepBlock)
      newErrors.pepBlocks = "Adicione pelo menos um bloco PEP com título";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("Preencha os campos obrigatórios");
      setActiveTab("edicao");
      return;
    }

    setIsSaving(true);
    try {
      if (isEditing && params?.id) {
        await updateChecklist(params.id, user.id, checklist);
      } else {
        await createChecklist(user.id, checklist);
      }
      toast.success("Checklist salvo com sucesso");
      setLocation("/admin/checklists");
    } catch (e) {
      console.warn("[ChecklistBuilder] save error:", e);
      toast.error("Erro ao salvar o checklist. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!checklist.id || !user?.id) return;
    setIsDeleting(true);
    try {
      await deleteChecklistById(checklist.id, user.id);
      toast.success("Checklist excluído");
      setLocation("/admin/checklists");
    } catch (e) {
      console.warn("[ChecklistBuilder] delete error:", e);
      toast.error("Erro ao excluir. Você só pode excluir checklists criados por você.");
    } finally {
      setIsDeleting(false);
    }
  };

  const titleDisplay = checklist.title.trim() || "Novo checklist";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 md:max-w-5xl md:mx-auto">
      {/* Sticky Toolbar */}
      <div className="sticky top-16 z-30 -mx-4 px-4 py-3 backdrop-blur-md bg-background/80 border-b border-border shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/admin/checklists")}
            className="shrink-0 -ml-2"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold text-lg truncate">{titleDisplay}</h1>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          {isEditing && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={isDeleting}
                >
                  {isDeleting && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                  Excluir
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir checklist?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. O checklist será removido
                    permanentemente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="gradient-primary text-white border-0 shadow-sm"
          >
            {isSaving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            Salvar checklist
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex justify-center mb-6 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:pb-0">
          <TabsList className="bg-muted/50 p-1 h-auto rounded-xl inline-flex w-max sm:w-auto">
            <TabsTrigger value="edicao" className="rounded-lg px-4 py-2 font-medium">
              Edição
            </TabsTrigger>
            <TabsTrigger value="medico" className="rounded-lg px-4 py-2 font-medium">
              Visualizar como Médico
            </TabsTrigger>
            <TabsTrigger value="paciente" className="rounded-lg px-4 py-2 font-medium">
              Visualizar como Paciente
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="edicao" className="space-y-6 mt-0">
          <ClassificacaoBlock
            checklist={checklist}
            updateChecklist={updateChecklistData}
            errors={errors}
          />
          <TarefasBlock checklist={checklist} updateChecklist={updateChecklistData} />
          <ImpressosBlock checklist={checklist} updateChecklist={updateChecklistData} />
          <RoteiroBlock checklist={checklist} updateChecklist={updateChecklistData} />
          <RawChecklistParserBlock
            onApply={(blocks) => {
              updateChecklistData({
                pepBlocks: [...checklist.pepBlocks, ...blocks],
              });
            }}
          />
          <PepBlocksEditor
            checklist={checklist}
            updateChecklist={updateChecklistData}
            errors={errors}
          />
        </TabsContent>

        <TabsContent value="medico" className="mt-0">
          <PreviewMedico checklist={checklist} />
        </TabsContent>

        <TabsContent value="paciente" className="mt-0">
          <PreviewPaciente checklist={checklist} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
