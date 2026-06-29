import { useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checklist, ImpressoItem } from "@/lib/checklistStorage";
import { Plus, GripVertical, Trash2, ImageIcon, Upload, Loader2 } from "lucide-react";
import { uploadFile, resolveImage } from "@/lib/storageService";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface ImpressosBlockProps {
  checklist: Checklist;
  updateChecklist: (data: Partial<Checklist>) => void;
}

function generateId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(2, 9);
}

export function ImpressosBlock({ checklist, updateChecklist }: ImpressosBlockProps) {
  const addImpresso = () => {
    const novoImpresso: ImpressoItem = {
      id: generateId(),
      titulo: "",
      tipo: "texto",
      conteudo: ""
    };
    updateChecklist({ impressos: [...checklist.impressos, novoImpresso] });
  };

  const updateImpresso = (id: string, data: Partial<ImpressoItem>) => {
    updateChecklist({
      impressos: checklist.impressos.map(item => item.id === id ? { ...item, ...data } : item)
    });
  };

  const removeImpresso = (id: string) => {
    updateChecklist({
      impressos: checklist.impressos.filter(item => item.id !== id)
    });
  };

  return (
    <Card className="p-6 rounded-2xl shadow-sm border-border/50 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[3px] gradient-primary" />
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg gradient-primary text-white font-bold shadow-sm">
            02
          </div>
          <h2 className="text-lg font-bold">Impressos</h2>
        </div>
        <Button variant="outline" size="sm" onClick={addImpresso}>
          <Plus className="w-4 h-4 mr-2" />
          Adicionar impresso
        </Button>
      </div>

      <div className="space-y-4">
        {checklist.impressos.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl border-border/50 bg-muted/20">
            <p className="text-muted-foreground font-medium mb-4">Nenhum impresso adicionado</p>
            <Button variant="outline" onClick={addImpresso}>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar impresso
            </Button>
          </div>
        ) : (
          checklist.impressos.map((item) => (
            <ImpressoCard
              key={item.id}
              item={item}
              onUpdate={(data) => updateImpresso(item.id, data)}
              onRemove={() => removeImpresso(item.id)}
            />
          ))
        )}
      </div>
    </Card>
  );
}

function ImpressoCard({
  item,
  onUpdate,
  onRemove,
}: {
  item: ImpressoItem;
  onUpdate: (data: Partial<ImpressoItem>) => void;
  onRemove: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const result = await uploadFile({ file, bucket: "resumos-media", userId: user.id });
    setUploading(false);
    if (result.error) {
      toast.error(`Upload falhou: ${result.error}`);
    } else {
      onUpdate({ conteudo: result.storagePath! });
      toast.success("Imagem carregada com sucesso");
    }
    e.target.value = "";
  };

  return (
    <Card className="p-4 rounded-xl border bg-card shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <GripVertical className="w-5 h-5 text-muted-foreground/50 cursor-grab" />
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-[1fr_150px] gap-3">
          <Input
            placeholder="Título do impresso (ex: Exames Laboratoriais)"
            value={item.titulo}
            onChange={(e) => onUpdate({ titulo: e.target.value })}
          />
          <Select
            value={item.tipo}
            onValueChange={(val: "texto" | "imagem") => onUpdate({ tipo: val, conteudo: "" })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="texto">Texto</SelectItem>
              <SelectItem value="imagem">Imagem</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      <div className="pl-8">
        {item.tipo === "texto" ? (
          <Textarea
            placeholder="Conteúdo do impresso..."
            className="min-h-[100px]"
            value={item.conteudo}
            onChange={(e) => onUpdate({ conteudo: e.target.value })}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {/* URL manual + botão de upload */}
            <div className="flex gap-2">
              <Input
                placeholder="URL da imagem (ou use o botão ao lado)"
                value={item.conteudo}
                onChange={(e) => onUpdate({ conteudo: e.target.value })}
                className="h-10 rounded-xl flex-1 text-sm"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                disabled={uploading}
                onChange={handleImageUpload}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="h-10 px-3 rounded-xl shrink-0 gap-1.5"
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                <span className="hidden sm:inline text-xs font-semibold">
                  {uploading ? "Enviando…" : "Enviar"}
                </span>
              </Button>
            </div>

            {/* Preview */}
            {item.conteudo ? (
              <div className="rounded-xl overflow-hidden border border-border/60 bg-muted/30 max-h-64 flex items-center justify-center">
                <img
                  src={resolveImage(item.conteudo, "resumos-media")}
                  alt={item.titulo || "Impresso"}
                  className="max-h-64 w-auto object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-28 border-2 border-dashed rounded-xl border-border/50 bg-muted/20">
                <ImageIcon className="w-7 h-7 text-muted-foreground/50 mb-1.5" />
                <p className="text-xs font-medium text-muted-foreground">
                  Cole uma URL ou clique em &quot;Enviar&quot; para fazer upload
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
