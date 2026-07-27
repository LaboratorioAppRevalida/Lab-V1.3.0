import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const schema = z
  .object({
    senha: z.string().min(6, "Mínimo 6 caracteres"),
    confirmacao: z.string().min(1, "Confirme a nova senha"),
  })
  .refine((d) => d.senha === d.confirmacao, {
    message: "As senhas não coincidem",
    path: ["confirmacao"],
  });

type FormValues = z.infer<typeof schema>;

export function PasswordRecoveryModal() {
  const { passwordRecoveryOpen, setPasswordRecoveryOpen } = useAuth();

  const [concluido, setConcluido] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSenha, setShowSenha] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { senha: "", confirmacao: "" },
  });

  const handleClose = () => {
    setPasswordRecoveryOpen(false);
    form.reset();
    setConcluido(false);
    setShowSenha(false);
    setShowConfirm(false);
  };

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password: values.senha });
    setIsLoading(false);

    if (error) {
      form.setError("senha", {
        message:
          error.message.toLowerCase().includes("expired") ||
          error.message.toLowerCase().includes("invalid")
            ? "Link expirado ou já utilizado. Solicite outro e-mail."
            : "Não foi possível redefinir. Tente novamente.",
      });
      return;
    }

    setConcluido(true);
    toast.success("Senha redefinida com sucesso!");
    setTimeout(() => {
      supabase.auth.signOut().catch(() => {});
      handleClose();
    }, 3000);
  };

  return (
    <Dialog open={passwordRecoveryOpen} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="border-0 p-0 max-w-md w-full gap-0 bg-card border border-border rounded-2xl shadow-2xl [&>button:last-child]:text-muted-foreground [&>button:last-child]:hover:text-foreground [&>button:last-child]:ring-offset-transparent">
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-px rounded-t-2xl pointer-events-none bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

        <div className="p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-primary/20 border border-primary/40">
              <KeyRound className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-foreground font-bold text-lg leading-tight">
                Redefinir sua senha
              </h2>
              <p className="text-sm text-muted-foreground leading-snug">
                {concluido
                  ? "Tudo certo! Saindo da conta em instantes."
                  : "Crie uma nova senha segura para sua conta"}
              </p>
            </div>
          </div>

          {/* ── Sucesso ─────────────────────────────────────────────── */}
          {concluido ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center bg-primary/20 border border-primary/40">
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="font-bold text-base text-foreground">Senha redefinida!</p>
                <p className="text-sm mt-1 text-muted-foreground">
                  Redirecionando para o login em 3 segundos…
                </p>
              </div>
              <div className="flex gap-1.5 mt-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"
                    style={{ animationDelay: `${i * 0.2}s` }}
                  />
                ))}
              </div>
            </div>
          ) : (
            /* ── Formulário ──────────────────────────────────────── */
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {/* Nova senha */}
                <FormField
                  control={form.control}
                  name="senha"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nova senha</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showSenha ? "text" : "password"}
                            placeholder="••••••••"
                            {...field}
                            className="h-11 pr-10"
                          />
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => setShowSenha((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-opacity hover:opacity-80"
                          >
                            {showSenha ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Confirmar senha */}
                <FormField
                  control={form.control}
                  name="confirmacao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmar nova senha</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showConfirm ? "text" : "password"}
                            placeholder="••••••••"
                            {...field}
                            className="h-11 pr-10"
                          />
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => setShowConfirm((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-opacity hover:opacity-80"
                          >
                            {showConfirm ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 text-base font-semibold text-white rounded-md mt-2 flex items-center justify-center gap-2 gradient-primary glow-primary transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Salvando…
                    </>
                  ) : (
                    "Salvar nova senha"
                  )}
                </button>
              </form>
            </Form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
