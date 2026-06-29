import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(1, "A senha é obrigatória"),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", senha: "" },
  });

  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    setIsLoading(true);
    const success = await login(values.email, values.senha);
    setIsLoading(false);
    if (success) setLocation("/inicio");
  };

  return (
    <div className="relative min-h-[100dvh] flex items-center justify-center p-4 overflow-hidden bg-background">
      {/* Ambient orbs */}
      <div aria-hidden="true" className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full blur-[100px] pointer-events-none bg-primary/8" />
      <div aria-hidden="true" className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full blur-[100px] pointer-events-none bg-primary/8" />

        {/* Login card — Bloco Grosso de Vidro Premium Flutuante com Sombra Escura */}
        <div className="relative w-full max-w-md z-10 rounded-[32px] p-3 backdrop-blur-3xl bg-white/45 transition-all duration-300 border-[5px] border-white/80 dark:border-slate-200/50 shadow-[inset_0_4px_6px_rgba(255,255,255,0.6),0_40px_80px_-12px_rgba(15,23,42,0.25),0_0_2px_rgba(15,23,42,0.2)]">
        <CardHeader className="space-y-6 pb-4">
          {/* TOPO DO CARD — Logo EliteMed Centralizada */}
          <div className="flex flex-col items-center justify-center pt-2 w-full select-none">
            <img 
              src="/logo-elitemed.png" 
              alt="EliteMed Logo" 
              className="h-14 md:h-16 w-auto object-contain transition-all duration-300 drop-shadow-[0_4px_12px_rgba(6,182,212,0.1)]"
              draggable="false"
            />
          </div>

          <div className="text-center space-y-1.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Acesse sua conta</h1>
            <p className="text-sm text-slate-600 font-medium">Bem-vindo de volta à sua rotina de estudos</p>
          </div>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-700 font-bold text-xs uppercase tracking-wider">E-mail</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="seu@email.com"
                        {...field}
                        className="h-11 rounded-2xl border-slate-200 bg-white/50 focus-visible:ring-cyan-500 text-slate-900 font-medium placeholder:text-slate-400"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="senha"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-700 font-bold text-xs uppercase tracking-wider">Senha</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        {...field}
                        className="h-11 rounded-2xl border-slate-200 bg-white/50 focus-visible:ring-cyan-500 text-slate-900 font-medium placeholder:text-slate-400"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full h-11 text-base font-bold rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-600 hover:to-emerald-600 text-white border-0 mt-6 shadow-md shadow-cyan-500/20 transition-all active:scale-[0.98]"
                disabled={isLoading}
              >
                {isLoading ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          </Form>

          <div className="mt-5 text-center">
            <Link href="/esqueci-senha" className="text-sm font-semibold text-slate-500 hover:text-cyan-600 transition-colors">
              Esqueci minha senha
            </Link>
          </div>
          <div className="mt-3 text-center text-sm font-medium">
            <span className="text-slate-500">Não tem conta? </span>
            <Link href="/cadastro" className="font-bold text-cyan-600 hover:text-cyan-700 hover:underline">Criar conta</Link>
          </div>
        </CardContent>
      </div>
    </div>
  );
}