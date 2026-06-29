import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { submitFeedback, trackEvent } from "@/lib/analyticsService";
import {
  fetchAppSettings,
  DEFAULT_SETTINGS,
  type AppSettings,
} from "@/lib/appSettingsService";
import {
  ArrowLeft,
  LifeBuoy,
  MessageSquare,
  Phone,
  Mail,
  ChevronDown,
  ChevronUp,
  Loader2,
  Send,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const FAQ_ITEMS = [
  {
    question: "Como redefinir minha senha?",
    answer:
      'Na tela de login, clique em "Esqueci minha senha" e informe seu e-mail. Você receberá um link de redefinição em instantes.',
  },
  {
    question: "Como iniciar um treino com outro usuário?",
    answer:
      'Vá em "Iniciar treino" na tela inicial, selecione um colega na lista de usuários online, escolha o papel (médico ou paciente) e aguarde a confirmação do outro usuário.',
  },
  {
    question: "Como funciona o InstaCheck?",
    answer:
      "O InstaCheck permite que o examinador (paciente) avalie cada item do checklist em tempo real durante a estação, tornando a correção mais ágil e objetiva.",
  },
  {
    question: "Como salvar uma estação concluída?",
    answer:
      'Ao finalizar uma estação, clique no botão "Salvar estação" na tela de resultados. As estações salvas ficam visíveis na aba Progresso.',
  },
  {
    question: "Meu progresso some ao trocar de dispositivo?",
    answer:
      "Seu histórico de sessões e streak ficam salvos no servidor. O XP de missões é sincronizado automaticamente ao resgatar a missão. Certifique-se de estar logado com a mesma conta.",
  },
  {
    question: "Como funciona o sistema de XP e níveis?",
    answer:
      "Você ganha XP ao completar missões e conquistas na aba Conquistas. O seu nível e barra de progresso refletem o XP acumulado — o mesmo valor aparece na Home e na aba Conquistas.",
  },
];

export default function Ajuda() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [settings, setSettings] = useState<AppSettings>({ ...DEFAULT_SETTINGS });

  useEffect(() => {
    fetchAppSettings().then(setSettings);
  }, []);

  const handleSubmit = async () => {
    if (!feedbackMsg.trim()) return;
    setFeedbackLoading(true);
    const ok = await submitFeedback(user?.id ?? null, feedbackMsg, "/ajuda");
    setFeedbackLoading(false);
    if (ok) {
      trackEvent(user?.id ?? null, "feedback_submitted", "ajuda");
      setFeedbackSent(true);
      setFeedbackMsg("");
      toast.success("Mensagem enviada! Nossa equipe vai analisar em breve.");
    } else {
      toast.error("Não foi possível enviar agora. Tente novamente.");
    }
  };

  return (
    <div className="flex flex-col gap-5 pb-8">
      {/* HEADER */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-1 pt-2"
      >
        <button
          onClick={() => setLocation("/inicio")}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar ao início
        </button>
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-muted-foreground">
          <LifeBuoy className="w-3.5 h-3.5" /> Suporte
        </div>
        <h1 className="text-3xl font-bold tracking-tight mt-1">Central de Ajuda</h1>
        <p className="text-muted-foreground mt-1 font-medium">
          Tire suas dúvidas ou entre em contato com a equipe
        </p>
      </motion.div>

      {/* CONTACT BLOCK */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <Card className="rounded-2xl p-5 border-border/60 bg-card/80 backdrop-blur-md">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Phone className="w-4 h-4" />
            </div>
            <h2 className="font-bold text-base">Fale conosco</h2>
          </div>
          <div className="flex flex-col gap-3">
            <a
              href={`https://wa.me/${settings.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/20 transition-colors group"
            >
              <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
                <Phone className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-700 dark:text-emerald-300">
                  WhatsApp
                </div>
                <div className="font-bold text-sm text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-300 transition-colors">
                  {settings.whatsapp}
                </div>
              </div>
              <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180 shrink-0 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </a>

            <a
              href={`mailto:${settings.email_suporte}`}
              className="flex items-center gap-3 p-3 rounded-xl bg-blue-500/10 border border-blue-400/30 hover:bg-blue-500/20 transition-colors group"
            >
              <div className="w-9 h-9 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-wider font-bold text-blue-700 dark:text-blue-300">
                  E-mail
                </div>
                <div className="font-bold text-sm text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors truncate">
                  {settings.email_suporte}
                </div>
              </div>
              <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180 shrink-0 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </a>
          </div>
          <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
            Atendemos de segunda a sexta, das 9h às 18h. Resposta em até 24 horas úteis.
          </p>
        </Card>
      </motion.div>

      {/* FEEDBACK FORM */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="rounded-2xl p-5 border-border/60 bg-card/80 backdrop-blur-md">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
            <h2 className="font-bold text-base">Enviar feedback ou dúvida</h2>
          </div>

          <AnimatePresence mode="wait">
            {feedbackSent ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center gap-3 py-6 text-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-emerald-500 flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="font-bold text-base">Mensagem enviada!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Nossa equipe vai analisar em breve.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl mt-1"
                  onClick={() => setFeedbackSent(false)}
                >
                  Enviar outra mensagem
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-3"
              >
                <Textarea
                  value={feedbackMsg}
                  onChange={(e) => setFeedbackMsg(e.target.value)}
                  placeholder="Descreva o problema, dúvida ou sugestão. Nossa equipe vai analisar em breve.&#10;&#10;Ex: tive um erro ao iniciar um treino com um colega..."
                  rows={5}
                  className="resize-none rounded-xl text-sm"
                  disabled={feedbackLoading}
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setFeedbackMsg("")}
                    disabled={feedbackLoading || !feedbackMsg.trim()}
                    className="rounded-xl"
                  >
                    Limpar
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={feedbackLoading || !feedbackMsg.trim()}
                    className="gradient-primary text-white border-0 rounded-xl"
                  >
                    {feedbackLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Enviando…
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Enviar
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>

      {/* FAQ */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <Card className="rounded-2xl border-border/60 bg-card/80 backdrop-blur-md overflow-hidden">
          <div className="p-5 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <LifeBuoy className="w-4 h-4" />
              </div>
              <h2 className="font-bold text-base">Dúvidas frequentes</h2>
            </div>
          </div>
          <div className="divide-y divide-border/60">
            {FAQ_ITEMS.map((item, i) => {
              const isOpen = openFaq === i;
              return (
                <div key={i} className="overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    className={cn(
                      "w-full flex items-center justify-between gap-3 p-4 text-left transition-colors",
                      isOpen ? "bg-primary/5" : "hover:bg-muted/40",
                    )}
                  >
                    <span className="font-semibold text-sm leading-tight">{item.question}</span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-primary shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                  </button>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <p className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">
                          {item.answer}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
