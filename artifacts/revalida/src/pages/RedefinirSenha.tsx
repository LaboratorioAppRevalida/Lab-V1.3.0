import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase";
import { BrandMark } from "@/components/BrandMark";
import { CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { CheckCircle2, Eye, EyeOff, Loader2, ArrowLeft, ShieldAlert } from "lucide-react";

const schema = z
  .object({
    senha: z.string().min(6, "A senha deve ter ao menos 6 caracteres"),
    confirmacao: z.string().min(1, "Confirme a nova senha"),
  })
  .refine((d) => d.senha === d.confirmacao, {
    message: "As senhas não coincidem",
    path: ["confirmacao"],
  });

type FormValues = z.infer<typeof schema>;

export default function RedefinirSenha() {
  const [, setLocation] = useLocation();

  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [showSenha, setShowSenha] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { senha: "", confirmacao: "" },
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setIsReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setIsReady(true);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const onSubmit = async (values: FormValues) => {
    setErro(null);
    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password: values.senha });
    setIsLoading(false);

    if (error) {
      setErro(
        error.message.toLowerCase().includes("expired") || error.message.toLowerCase().includes("invalid")
          ? "O link de redefinição expirou ou já foi usado. Solicite um novo."
          : "Não foi possível redefinir a senha. Tente novamente."
      );
      return;
    }

    setConcluido(true);
    setTimeout(() => {
      supabase.auth.signOut().then(() => setLocation("/login"));
    }, 3000);
  };

  return (
    <div className="relative min-h-[100dvh] flex items-center justify-center p-4 overflow-hidden bg-background">
      {/* Ambient orbs */}
      <div aria-hidden="true" className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full blur-[100px] pointer-events-none bg-primary/8" />
      <div aria-hidden="true" className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full blur-[100px] pointer-events-none bg-primary/8" />

      {/* Card */}
      <div className="relative w-full max-w-md z-10 rounded-2xl shadow-2xl bg-card/80 backdrop-blur-2xl border border-border">
        <CardHeader className="space-y-6 pb-4">
          <BrandMark />
          <div className="text-center space-y-1.5">
            <h1 className="text-2xl font-bold text-foreground">Redefinir sua senha</h1>
            <p className="text-sm text-muted-foreground">
              {concluido
                ? "Tudo certo! Você será redirecionado em instantes."
                : !isReady
                ? "Verificando o link de redefinição…"
                : "Crie uma nova senha segura para sua conta"}
            </p>
          </div>
        </CardHeader>

        <CardContent>
          {/* ── Sucesso ─────────────────────────────────────────────────── */}
          {concluido ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center bg-primary/20 border border-primary/40">
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="font-bold text-base text-foreground">Senha redefinida com sucesso!</p>
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

          ) : !isReady ? (
            /* ── Verificando token ────────────────────────────────────── */
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Verificando link de redefinição…
              </p>
              <p className="text-xs text-muted-foreground/60 max-w-xs">
                Se esta tela não avançar, o link pode ter expirado ou já foi usado.
              </p>
              <Link href="/esqueci-senha">
                <button className="mt-1 text-sm font-medium text-primary transition-opacity hover:opacity-80 flex items-center gap-1.5">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Solicitar novo link
                </button>
              </Link>
            </div>

          ) : (
            /* ── Formulário ───────────────────────────────────────────── */
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
                            {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                            {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Erro inline */}
                {erro && (
                  <div className="flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm bg-destructive/12 border border-destructive/30">
                    <ShieldAlert className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    <span className="text-destructive">{erro}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-11 text-base font-semibold gradient-primary text-white border-0 mt-2 glow-primary"
                  disabled={isLoading}
                >
                  {isLoading
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando…</>
                    : "Salvar nova senha"
                  }
                </Button>
              </form>
            </Form>
          )}

          {/* Voltar */}
          {!concluido && (
            <div className="mt-5 text-center">
              <Link href="/login">
                <span className="text-sm inline-flex items-center gap-1.5 text-muted-foreground transition-opacity hover:opacity-80 cursor-pointer">
                  <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao login
                </span>
              </Link>
            </div>
          )}
        </CardContent>
      </div>
    </div>
  );
}
