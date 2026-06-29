import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { useRoute, useLocation } from "wouter";
import {
  ChevronLeft,
  Plus,
  Trash2,
  GripVertical,
  Type,
  Image as ImageIcon,
  Video as VideoIcon,
  Link as LinkIcon,
  Eye,
  Upload,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  getNoticia,
  saveNoticia,
  deleteNoticia,
  newNoticia,
  newNoticiaBlock,
  type Noticia,
  type NoticiaBlock,
  type NoticiaBlockType,
} from "@/lib/noticiasStorage";
import { uploadFile, resolveImage } from "@/lib/storageService";
import { useAuth } from "@/contexts/AuthContext";
import { NoticiaBlockView } from "@/pages/Noticias";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const BLOCK_META: Record<NoticiaBlockType, { label: string; Icon: typeof Type; tone: string }> = {
  texto: { label: "Texto", Icon: Type, tone: "bg-blue-500/15 text-blue-600 dark:text-blue-300" },
  imagem: { label: "Imagem", Icon: ImageIcon, tone: "bg-amber-500/15 text-amber-600 dark:text-amber-300" },
  video: { label: "Vídeo", Icon: VideoIcon, tone: "bg-rose-500/15 text-rose-600 dark:text-rose-300" },
  link: { label: "Link", Icon: LinkIcon, tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" },
};

export default function NoticiaEditor() {
  const [, params] = useRoute("/admin/noticias/editar/:id");
  const [, setLocation] = useLocation();
  const isEditing = !!params?.id;

  const [noticia, setNoticia] = useState<Noticia>(() => newNoticia());
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (isEditing && params?.id) {
      getNoticia(params.id).then((found) => {
        if (found) {
          setNoticia(found);
        } else {
          toast.error("Notícia não encontrada");
          setLocation("/admin/noticias");
        }
      });
    } else {
      setNoticia(newNoticia());
    }
  }, [isEditing, params?.id, setLocation]);

  const update = (data: Partial<Noticia>) => setNoticia((n) => ({ ...n, ...data }));

  const addBlock = (type: NoticiaBlockType) =>
    update({ blocks: [...noticia.blocks, newNoticiaBlock(type)] });

  const updateBlock = (id: string, data: Partial<NoticiaBlock>) =>
    update({
      blocks: noticia.blocks.map((b) => (b.id === id ? { ...b, ...data } : b)),
    });

  const removeBlock = (id: string) =>
    update({ blocks: noticia.blocks.filter((b) => b.id !== id) });

  const handleSave = async () => {
    if (!noticia.titulo.trim()) {
      toast.error("Informe o título da notícia");
      return;
    }
    if (noticia.blocks.length === 0) {
      toast.error("Adicione pelo menos um bloco de conteúdo");
      return;
    }
    try {
      await saveNoticia(noticia);
      toast.success(isEditing ? "Notícia atualizada" : "Notícia publicada");
      setLocation("/admin/noticias");
    } catch {
      toast.error("Erro ao salvar notícia. Tente novamente.");
    }
  };

  const handleDelete = async () => {
    if (noticia.id) {
      try {
        await deleteNoticia(noticia.id);
        toast.success("Notícia excluída");
        setLocation("/admin/noticias");
      } catch {
        toast.error("Erro ao excluir notícia. Tente novamente.");
      }
    }
  };

  const titleDisplay = noticia.titulo.trim() || "Nova notícia";

  return (
    <div className="flex flex-col gap-6 md:max-w-6xl md:mx-auto">
      {/* Sticky Toolbar */}
      <div className="sticky top-16 z-30 -mx-4 px-4 py-3 backdrop-blur-md bg-background/80 border-b border-border shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/admin/noticias")}
            className="shrink-0 -ml-2"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold text-lg truncate">{titleDisplay}</h1>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <Button
            variant="ghost"
            onClick={() => setShowPreview((v) => !v)}
            className="lg:hidden"
          >
            <Eye className="w-4 h-4 mr-1.5" />
            {showPreview ? "Editar" : "Visualizar"}
          </Button>
          {isEditing && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                  Excluir
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir notícia?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. A notícia sairá do feed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-rose-600 hover:bg-rose-700 text-white"
                  >
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button onClick={handleSave} className="gradient-primary text-white border-0 shadow-sm">
            Salvar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">
        {/* EDITOR */}
        <div className={cn("flex flex-col gap-5", showPreview && "hidden lg:flex")}>
          {/* Cabeçalho */}
          <Card className="p-6 rounded-2xl border-border/60 bg-card/80 backdrop-blur-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] gradient-primary" />
            <h2 className="text-lg font-bold mb-4">Cabeçalho</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input
                  value={noticia.titulo}
                  onChange={(e) => update({ titulo: e.target.value })}
                  placeholder="Ex: Edital do Revalida 2026.1 publicado"
                  className="text-base font-semibold"
                />
              </div>
              <div className="space-y-2">
                <Label>Resumo (opcional)</Label>
                <Textarea
                  value={noticia.resumo}
                  onChange={(e) => update({ resumo: e.target.value })}
                  placeholder="Uma breve chamada que aparece no feed"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Data de publicação</Label>
                <Input
                  type="date"
                  value={noticia.publishedAt ? noticia.publishedAt.slice(0, 10) : ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    update({
                      publishedAt: v ? new Date(v + "T12:00:00").toISOString() : new Date().toISOString(),
                    });
                  }}
                />
              </div>
            </div>
          </Card>

          {/* Blocos */}
          <Card className="p-6 rounded-2xl border-border/60 bg-card/80 backdrop-blur-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] gradient-primary" />
            <div className="flex items-center justify-between gap-2 mb-4">
              <h2 className="text-lg font-bold">Blocos de conteúdo</h2>
              <span className="text-xs text-muted-foreground font-bold">
                {noticia.blocks.length} bloco{noticia.blocks.length === 1 ? "" : "s"}
              </span>
            </div>

            {noticia.blocks.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
                Sem blocos. Adicione o primeiro abaixo.
              </div>
            ) : (
              <Reorder.Group
                axis="y"
                values={noticia.blocks}
                onReorder={(blocks) => update({ blocks })}
                className="flex flex-col gap-3"
              >
                {noticia.blocks.map((block) => (
                  <BlockCard
                    key={block.id}
                    block={block}
                    onChange={(data) => updateBlock(block.id, data)}
                    onRemove={() => removeBlock(block.id)}
                  />
                ))}
              </Reorder.Group>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5">
              {(Object.keys(BLOCK_META) as NoticiaBlockType[]).map((t) => {
                const meta = BLOCK_META[t];
                const Icon = meta.Icon;
                return (
                  <button
                    key={t}
                    onClick={() => addBlock(t)}
                    className="group flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border/60 bg-background/50 hover:border-primary/40 hover:shadow-md transition-all"
                  >
                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", meta.tone)}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold">{meta.label}</span>
                    <span className="text-[10px] text-muted-foreground inline-flex items-center gap-0.5">
                      <Plus className="w-2.5 h-2.5" /> adicionar
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        {/* PREVIEW */}
        <div className={cn("lg:sticky lg:top-32 lg:self-start", !showPreview && "hidden lg:block")}>
          <Card className="rounded-2xl border-border/60 bg-card/80 backdrop-blur-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-border/60 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Eye className="w-3.5 h-3.5" /> Pré-visualização
            </div>
            <div className="p-5 max-h-[70vh] overflow-y-auto flex flex-col gap-5">
              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                  Notícia
                </div>
                <h2 className="text-2xl font-extrabold leading-tight mt-1">
                  {noticia.titulo || "Título da notícia"}
                </h2>
                {noticia.resumo && (
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed border-l-4 border-primary/40 pl-3 italic">
                    {noticia.resumo}
                  </p>
                )}
              </div>
              {noticia.blocks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Os blocos aparecem aqui conforme você adiciona conteúdo.
                </p>
              ) : (
                noticia.blocks.map((b) => <NoticiaBlockView key={b.id} block={b} />)
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function BlockCard({
  block,
  onChange,
  onRemove,
}: {
  block: NoticiaBlock;
  onChange: (data: Partial<NoticiaBlock>) => void;
  onRemove: () => void;
}) {
  const meta = BLOCK_META[block.type];
  const Icon = meta.Icon;
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const result = await uploadFile({ file, bucket: "news-media", userId: user.id });
    setUploading(false);
    if (result.error) {
      toast.error(`Upload falhou: ${result.error}`);
    } else {
      onChange({ content: result.storagePath! });
      toast.success("Imagem carregada com sucesso");
    }
    e.target.value = "";
  };

  return (
    <Reorder.Item
      value={block}
      className="rounded-xl border border-border/60 bg-background/60 backdrop-blur-sm overflow-hidden"
      whileDrag={{ scale: 1.02, boxShadow: "0 12px 30px rgba(0,0,0,0.18)" }}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60 bg-muted/30">
        <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none">
          <GripVertical className="w-4 h-4" />
        </div>
        <div className={cn("w-7 h-7 rounded-md flex items-center justify-center", meta.tone)}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <span className="text-xs font-bold uppercase tracking-wider">{meta.label}</span>
        <button
          onClick={onRemove}
          className="ml-auto p-1.5 rounded-md text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 transition-colors"
          aria-label="Remover bloco"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="p-4 space-y-3">
        {block.type === "texto" && (
          <>
            <Input
              value={block.titulo ?? ""}
              onChange={(e) => onChange({ titulo: e.target.value })}
              placeholder="Subtítulo (opcional)"
            />
            <Textarea
              value={block.content}
              onChange={(e) => onChange({ content: e.target.value })}
              placeholder="Escreva o conteúdo do bloco..."
              rows={5}
            />
          </>
        )}
        {block.type === "imagem" && (
          <>
            <div className="flex gap-2">
              <Input
                value={block.content}
                onChange={(e) => onChange({ content: e.target.value })}
                placeholder="URL da imagem (https://...)"
                className="flex-1"
              />
              <label className="shrink-0">
                <input
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
                  className="h-10 px-3 cursor-pointer"
                  disabled={uploading}
                  asChild
                >
                  <span>
                    {uploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <><Upload className="w-4 h-4 mr-1.5" /> Upload</>
                    )}
                  </span>
                </Button>
              </label>
            </div>
            <Input
              value={block.legenda ?? ""}
              onChange={(e) => onChange({ legenda: e.target.value })}
              placeholder="Legenda (opcional)"
            />
            {block.content ? (
              <div className="rounded-lg overflow-hidden border border-border/60 bg-muted/30 max-h-48">
                <img
                  src={resolveImage(block.content, "news-media")}
                  alt={block.legenda ?? ""}
                  className="w-full max-h-48 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.opacity = "0.2";
                  }}
                />
              </div>
            ) : (
              <div className="rounded-lg border-2 border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
                <ImageIcon className="w-5 h-5 mx-auto mb-1 opacity-60" />
                Cole uma URL ou faça upload de uma imagem
              </div>
            )}
          </>
        )}
        {block.type === "video" && (
          <>
            <Input
              value={block.content}
              onChange={(e) => onChange({ content: e.target.value })}
              placeholder="URL do YouTube ou Vimeo (ex: https://youtu.be/abc123)"
            />
            <p className="text-[11px] text-muted-foreground">
              Aceita links youtube.com/watch?v=..., youtu.be/... e vimeo.com/...
            </p>
          </>
        )}
        {block.type === "link" && (
          <>
            <Input
              value={block.titulo ?? ""}
              onChange={(e) => onChange({ titulo: e.target.value })}
              placeholder="Título do link"
            />
            <Textarea
              value={block.descricao ?? ""}
              onChange={(e) => onChange({ descricao: e.target.value })}
              placeholder="Descrição (opcional)"
              rows={2}
            />
            <Input
              value={block.content}
              onChange={(e) => onChange({ content: e.target.value })}
              placeholder="URL (https://...)"
            />
          </>
        )}
      </div>
    </Reorder.Item>
  );
}

// Suppress unused import warning for AnimatePresence/motion in some bundlers
void AnimatePresence;
void motion;
