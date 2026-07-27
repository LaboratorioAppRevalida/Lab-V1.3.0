import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useRoute } from "wouter";
import {
  ChevronLeft,
  Save,
  Trash2,
  Plus,
  AlignLeft,
  Image as ImageIcon,
  ArrowUp,
  ArrowDown,
  Heading2,
  X,
  Loader2,
  Upload,
  Video as VideoIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  newResumo,
  newBlock,
  RESUMO_AREAS,
  parseVideoUrl,
  type Resumo,
  type ResumoBlock,
  type ResumoBlockType,
} from "@/lib/resumosStorage";
import {
  getResumoById,
  createResumo,
  updateResumo,
  deleteResumoById,
} from "@/lib/resumosService";
import { uploadFile, resolveImage } from "@/lib/storageService";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function ResumoEditor() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute<{ id: string }>("/admin/resumos/editar/:id");
  const { user } = useAuth();
  const editingId = params?.id;

  const [resumo, setResumo] = useState<Resumo>(newResumo());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isExisting = !!editingId;

  useEffect(() => {
    if (editingId) {
      setIsLoading(true);
      getResumoById(editingId)
        .then((found) => {
          if (found) {
            setResumo(found);
          } else {
            toast.error("Resumo não encontrado");
            setLocation("/admin/resumos");
          }
        })
        .catch(() => {
          toast.error("Erro ao carregar resumo");
          setLocation("/admin/resumos");
        })
        .finally(() => setIsLoading(false));
    } else {
      setResumo(newResumo());
    }
  }, [editingId, setLocation]);

  const handleAddBlock = (type: ResumoBlockType) => {
    setResumo({ ...resumo, blocks: [...resumo.blocks, newBlock(type)] });
  };

  const handleUpdateBlock = (id: string, content: string, alt?: string) => {
    setResumo({
      ...resumo,
      blocks: resumo.blocks.map((b) =>
        b.id === id ? { ...b, content, alt: alt ?? b.alt } : b,
      ),
    });
  };

  const handleRemoveBlock = (id: string) => {
    setResumo({ ...resumo, blocks: resumo.blocks.filter((b) => b.id !== id) });
  };

  const handleMove = (id: string, dir: -1 | 1) => {
    const idx = resumo.blocks.findIndex((b) => b.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= resumo.blocks.length) return;
    const next = [...resumo.blocks];
    [next[idx], next[target]] = [next[target], next[idx]];
    setResumo({ ...resumo, blocks: next });
  };

  const handleSave = async () => {
    if (!user?.id) return;
    if (!resumo.titulo.trim()) {
      toast.error("Adicione um título antes de salvar.");
      return;
    }
    if (resumo.blocks.length === 0) {
      toast.error("Adicione pelo menos um bloco de conteúdo.");
      return;
    }

    setIsSaving(true);
    try {
      if (isExisting && editingId) {
        await updateResumo(editingId, user.id, { ...resumo, titulo: resumo.titulo.trim() });
      } else {
        await createResumo(user.id, { ...resumo, titulo: resumo.titulo.trim() });
      }
      toast.success("Resumo salvo");
      setLocation("/admin/resumos");
    } catch (e) {
      console.warn("[ResumoEditor] save error:", e);
      toast.error("Erro ao salvar o resumo. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingId || !user?.id) return;
    setIsDeleting(true);
    try {
      await deleteResumoById(editingId, user.id);
      setConfirmDelete(false);
      toast.success("Resumo excluído");
      setLocation("/admin/resumos");
    } catch (e) {
      console.warn("[ResumoEditor] delete error:", e);
      toast.error("Erro ao excluir. Você só pode excluir resumos criados por você.");
    } finally {
      setIsDeleting(false);
    }
  };

  const headerLabel = useMemo(
    () => resumo.titulo.trim() || (isExisting ? "Resumo sem título" : "Novo resumo"),
    [resumo.titulo, isExisting],
  );

  const embedUrl = parseVideoUrl(resumo.video_url ?? "");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* TOOLBAR */}
      <div className="sticky top-16 sm:top-[68px] z-20 -mx-4 px-4 py-3 bg-background/85 backdrop-blur-md border-b border-border/60">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setLocation("/admin/resumos")}
            className="p-2 rounded-lg hover:bg-muted transition-colors shrink-0"
            aria-label="Voltar"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
              {isExisting ? "Editar resumo" : "Novo resumo"}
            </div>
            <div className="font-bold text-sm sm:text-base truncate">{headerLabel}</div>
          </div>
          {isExisting && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              disabled={isDeleting}
              className="rounded-xl border-rose-300/60 text-rose-600 dark:text-rose-300 hover:bg-rose-500/10"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 sm:mr-1.5 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 sm:mr-1.5" />
              )}
              <span className="hidden sm:inline">Excluir</span>
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={isSaving}
            size="sm"
            className="rounded-xl gradient-primary text-white border-0 glow-primary"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 sm:mr-1.5 animate-spin" />
            ) : (
              <Save className="w-4 h-4 sm:mr-1.5" />
            )}
            <span className="hidden sm:inline">Salvar</span>
          </Button>
        </div>
      </div>

      {/* META */}
      <Card className="rounded-2xl p-5 border-border/60 backdrop-blur-md bg-card/80 flex flex-col gap-4">
        <div>
          <Label
            htmlFor="titulo"
            className="text-xs uppercase tracking-wider font-bold text-muted-foreground"
          >
            Título
          </Label>
          <Input
            id="titulo"
            value={resumo.titulo}
            onChange={(e) => setResumo({ ...resumo, titulo: e.target.value })}
            placeholder="Ex.: Hipertensão arterial sistêmica"
            className="mt-1.5 h-11 rounded-xl text-base font-semibold"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
              Área
            </Label>
            <Select
              value={resumo.area}
              onValueChange={(v) => setResumo({ ...resumo, area: v })}
            >
              <SelectTrigger className="mt-1.5 h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESUMO_AREAS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label
              htmlFor="subarea"
              className="text-xs uppercase tracking-wider font-bold text-muted-foreground"
            >
              Subárea
            </Label>
            <Input
              id="subarea"
              value={resumo.subarea}
              onChange={(e) => setResumo({ ...resumo, subarea: e.target.value })}
              placeholder="Ex.: Cardiologia"
              className="mt-1.5 h-11 rounded-xl"
            />
          </div>
        </div>

        {/* CAMPO DE VÍDEO */}
        <div>
          <Label
            htmlFor="video_url"
            className="text-xs uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-1.5"
          >
            <VideoIcon className="w-3.5 h-3.5" />
            Vídeo (YouTube ou Vimeo — opcional)
          </Label>
          <Input
            id="video_url"
            value={resumo.video_url ?? ""}
            onChange={(e) => setResumo({ ...resumo, video_url: e.target.value })}
            placeholder="Cole o link do YouTube ou Vimeo"
            className="mt-1.5 h-11 rounded-xl"
          />
          {embedUrl && (
            <div className="mt-3 rounded-xl overflow-hidden border border-border/60 bg-muted/30 aspect-video">
              <iframe
                src={embedUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="Preview do vídeo"
              />
            </div>
          )}
          {resumo.video_url && !embedUrl && (
            <p className="mt-1.5 text-xs text-rose-500">
              Link não reconhecido. Use um link do YouTube ou Vimeo.
            </p>
          )}
        </div>
      </Card>

      {/* BLOCKS */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">Conteúdo</h3>
          <span className="text-xs text-muted-foreground">
            {resumo.blocks.length} bloco{resumo.blocks.length === 1 ? "" : "s"}
          </span>
        </div>

        <AnimatePresence initial={false}>
          {resumo.blocks.map((block, idx) => (
            <motion.div
              key={block.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
            >
              <BlockEditor
                block={block}
                index={idx}
                total={resumo.blocks.length}
                onChange={(c, a) => handleUpdateBlock(block.id, c, a)}
                onRemove={() => handleRemoveBlock(block.id)}
                onMove={(d) => handleMove(block.id, d)}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {resumo.blocks.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
            Nenhum bloco adicionado ainda. Use os botões abaixo para começar.
          </div>
        )}

        {/* ADD BLOCK BAR */}
        <Card className="rounded-2xl p-3 border-border/60 backdrop-blur-md bg-card/70 flex flex-wrap gap-2 justify-center sm:justify-start">
          <AddBlockButton
            icon={<Heading2 className="w-4 h-4" />}
            label="Título"
            onClick={() => handleAddBlock("titulo")}
          />
          <AddBlockButton
            icon={<AlignLeft className="w-4 h-4" />}
            label="Texto"
            onClick={() => handleAddBlock("texto")}
          />
          <AddBlockButton
            icon={<ImageIcon className="w-4 h-4" />}
            label="Imagem"
            onClick={() => handleAddBlock("imagem")}
          />
        </Card>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este resumo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os blocos serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isDeleting && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AddBlockButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold border border-border/60 bg-card/60 hover:bg-muted/60 transition-colors"
    >
      <Plus className="w-3.5 h-3.5" />
      {icon}
      {label}
    </button>
  );
}

function BlockEditor({
  block,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  block: ResumoBlock;
  index: number;
  total: number;
  onChange: (content: string, alt?: string) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();

  const TYPE_META: Record<
    ResumoBlockType,
    { icon: React.ReactNode; label: string; tone: string }
  > = {
    titulo: {
      icon: <Heading2 className="w-3.5 h-3.5" />,
      label: "Título",
      tone: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
    },
    texto: {
      icon: <AlignLeft className="w-3.5 h-3.5" />,
      label: "Texto",
      tone: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    },
    imagem: {
      icon: <ImageIcon className="w-3.5 h-3.5" />,
      label: "Imagem",
      tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    },
  };
  const meta = TYPE_META[block.type];

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const result = await uploadFile({ file, bucket: "resumos-media", userId: user.id });
    setUploading(false);
    if (result.error) {
      toast.error(`Upload falhou: ${result.error}`);
    } else {
      onChange(result.storagePath!, block.alt);
      toast.success("Imagem carregada com sucesso");
    }
    e.target.value = "";
  };

  return (
    <Card className="rounded-2xl p-4 sm:p-5 border-border/60 bg-card/70 backdrop-blur-md flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-muted text-muted-foreground flex items-center justify-center text-xs font-bold tabular-nums">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${meta.tone}`}
          >
            {meta.icon} {meta.label}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Mover para cima"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <button
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Mover para baixo"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
          <button
            onClick={onRemove}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 transition-colors"
            aria-label="Remover bloco"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {block.type === "titulo" && (
        <Input
          value={block.content}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Título da seção (ex.: Definição)"
          className="h-11 rounded-xl text-lg font-bold"
        />
      )}

      {block.type === "texto" && (
        <Textarea
          value={block.content}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Escreva o conteúdo deste bloco. Use parágrafos com quebras de linha."
          className="min-h-[160px] text-sm leading-relaxed rounded-xl resize-y"
        />
      )}

      {block.type === "imagem" && (
        <div className="flex flex-col gap-3">
          {/* URL + botão de upload */}
          <div className="flex gap-2">
            <Input
              value={block.content}
              onChange={(e) => onChange(e.target.value, block.alt)}
              placeholder="Cole a URL da imagem"
              className="h-11 rounded-xl flex-1"
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
              className="h-11 px-3 rounded-xl shrink-0 gap-1.5"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              <span className="hidden sm:inline text-xs font-semibold">
                {uploading ? "Enviando…" : "Enviar imagem"}
              </span>
            </Button>
          </div>

          <Input
            value={block.alt ?? ""}
            onChange={(e) => onChange(block.content, e.target.value)}
            placeholder="Texto alternativo (descrição da imagem)"
            className="h-10 rounded-xl text-sm"
          />

          {block.content ? (
            <div className="rounded-xl overflow-hidden border border-border/60 bg-muted/40 max-h-72 flex items-center justify-center">
              <img
                src={resolveImage(block.content, "resumos-media")}
                alt={block.alt ?? ""}
                className="max-h-72 w-auto object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 p-6 text-center text-xs text-muted-foreground">
              <ImageIcon className="w-6 h-6 mx-auto mb-2 opacity-60" />
              Cole uma URL acima ou clique em &quot;Enviar imagem&quot; para fazer upload
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
