import { Checklist } from "@/lib/checklistStorage";
import { Card } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ImageIcon } from "lucide-react";
import { resolveImage } from "@/lib/storageService";

export function PreviewMedico({ checklist }: { checklist: Checklist }) {
  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-8">
      <div className="px-1">
        <h1 className="text-2xl font-bold tracking-tight mb-2">Visão do Médico</h1>
        <p className="text-muted-foreground text-sm">Assim que o candidato verá a estação antes de iniciá-la.</p>
      </div>

      <Card className="p-6 rounded-2xl shadow-sm border-border/50">
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">Cenário de atuação</h3>
            <p className="whitespace-pre-wrap leading-relaxed">{checklist.cenarioAtuacao || "Não preenchido."}</p>
          </div>
          
          <div className="w-full h-px bg-border" />
          
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">Descrição do caso</h3>
            <p className="whitespace-pre-wrap leading-relaxed">{checklist.descricaoCaso || "Não preenchido."}</p>
          </div>

          <div className="w-full h-px bg-border" />
          
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">Tarefas</h3>
            <p className="whitespace-pre-wrap leading-relaxed">{checklist.tarefas || "Não preenchido."}</p>
          </div>
        </div>
      </Card>

      {checklist.impressos.length > 0 && (
        <Card className="p-6 rounded-2xl shadow-sm border-border/50">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Impressos disponíveis</h3>
          
          <Accordion type="single" collapsible className="w-full">
            {checklist.impressos.map((item, i) => (
              <AccordionItem key={item.id} value={item.id}>
                <AccordionTrigger className="text-base font-semibold hover:no-underline hover:text-primary">
                  {item.titulo || `Impresso ${i + 1}`}
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-4">
                  {item.tipo === "texto" ? (
                    <div className="p-4 bg-muted/30 rounded-xl whitespace-pre-wrap border">
                      {item.conteudo || "Impresso vazio."}
                    </div>
                  ) : item.conteudo ? (
                    <div className="rounded-xl overflow-hidden border border-border/60 bg-muted/30 flex items-center justify-center">
                      <img
                        src={resolveImage(item.conteudo, "resumos-media")}
                        alt={item.titulo || "Impresso"}
                        className="max-h-80 w-auto object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-8 bg-muted/30 rounded-xl border border-dashed">
                      <ImageIcon className="w-8 h-8 text-muted-foreground/50 mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhuma imagem carregada.</p>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Card>
      )}
    </div>
  );
}
