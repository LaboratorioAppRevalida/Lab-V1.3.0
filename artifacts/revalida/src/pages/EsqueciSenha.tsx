import { useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase";
import { BrandMark } from "@/components/BrandMark";
import { CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { CheckCircle2, ArrowLeft, Mail, ShieldAlert } from "lucide-react";

const schema = z.object({
  email: z.string().email("E-mail inválido"),
});

export default function EsqueciSenha() {
  const [enviado, setEnviado] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: z.infer<typeof schema>) => {
    setIsLoading(true);
    setErro(null);

    const redirectTo = "https://www.elitemedrevalida.com.br/";

    const { error } = await supabase.auth.resetPasswordForEmail(values.email.trim(), { redirectTo });
    setIsLoading(false);

    if (error) {
      setErro("Não foi possível enviar o e-mail. Verifique o endereço e tente novamente.");
      return;
    }

    setEnviado(true);
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
            <h1 className="text-2xl font-bold text-foreground">Recuperar senha</h1>
            <p className="text-sm text-muted-foreground">
              {enviado
                ? "Verifique sua caixa de entrada e clique no link."
                : "Informe seu e-mail para receber o link de redefinição"}
            </p>
          </div>
        </CardHeader>

        <CardContent>
          {enviado ? (
            /* ── E-mail enviado ─────────────────────────────────────────── */
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center bg-primary/20 border border-primary/40">
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="font-bold text-base text-foreground">E-mail enviado!</p>
                <p className="text-sm mt-1 text-muted-foreground">
                  Clique no link recebido para criar uma nova senha. Verifique também a caixa de spam.
                </p>
              </div>
              <Link href="/login">
                <button className="mt-2 text-sm font-medium text-primary transition-opacity hover:opacity-80 flex items-center gap-1.5">
                  <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao login
                </button>
              </Link>
            </div>

          ) : (
            /* ── Formulário ─────────────────────────────────────────────── */
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-muted-foreground" />
                          <Input
                            placeholder="seu@email.com"
                            {...field}
                            className="h-11 pl-9"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                  {isLoading ? "Enviando…" : "Enviar link de redefinição"}
                </Button>
              </form>
            </Form>
          )}

          {!enviado && (
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
