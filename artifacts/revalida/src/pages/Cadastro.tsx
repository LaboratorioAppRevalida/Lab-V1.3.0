import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Siglas (UFs) dos 26 Estados + Distrito Federal
const ESTADOS_BR = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT",
  "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"
];

// Lista de países
const PAISES = [
  "Afeganistão", "África do Sul", "Albânia", "Alemanha", "Andorra", "Angola", "Antígua e Barbuda",
  "Arábia Saudita", "Argélia", "Argentina", "Armênia", "Austrália", "Áustria", "Azerbaijão",
  "Bahamas", "Bangladesh", "Barbados", "Barrein", "Bélgica", "Belize", "Benin", "Bielorrússia",
  "Bolívia", "Bósnia e Herzegovina", "Botsuana", "Brasil", "Brunei", "Bulgária", "Burkina Faso",
  "Burundi", "Butão", "Cabo Verde", "Camarões", "Camboja", "Canadá", "Catar", "Cazaquistão",
  "Chade", "Chile", "China", "Chipre", "Colômbia", "Comores", "Congo", "Coreia do Norte",
  "Coreia do Sul", "Costa do Marfim", "Costa Rica", "Croácia", "Cuba", "Dinamarca", "Djibuti",
  "Dominica", "Egito", "El Salvador", "Emirados Árabes Unidos", "Equador", "Eritreia", "Eslováquia",
  "Eslovênia", "Espanha", "Estados Unidos", "Estônia", "Eswatini", "Etiópia", "Fiji", "Filipinas",
  "Finlândia", "França", "Gabão", "Gâmbia", "Gana", "Geórgia", "Granada", "Grécia", "Guatemala",
  "Guiana", "Guiné", "Guiné Equatorial", "Guiné-Bissau", "Haiti", "Holanda", "Honduras",
  "Hungria", "Iêmen", "Ilhas Marshall", "Ilhas Salomão", "Índia", "Indonésia", "Irã", "Iraque",
  "Irlanda", "Islândia", "Israel", "Itália", "Jamaica", "Japão", "Jordânia", "Kiribati", "Kuwait",
  "Laos", "Lesoto", "Letônia", "Líbano", "Libéria", "Líbia", "Liechtenstein", "Lituânia",
  "Luxemburgo", "Macedônia do Norte", "Madagascar", "Malásia", "Malaui", "Maldivas", "Mali",
  "Malta", "Marrocos", "Maurício", "Mauritânia", "México", "Mianmar", "Micronésia", "Moçambique",
  "Moldávia", "Mônaco", "Mongólia", "Montenegro", "Namíbia", "Nauru", "Nepal", "Nicarágua",
  "Níger", "Nigéria", "Noruega", "Nova Zelândia", "Omã", "Palau", "Panamá", "Papua-Nova Guiné",
  "Paquistão", "Paraguai", "Peru", "Polônia", "Portugal", "Quênia", "Quirguistão", "Reino Unido",
  "República Centro-Africana", "República Checa", "República Dominicana", "Romênia", "Ruanda",
  "Rússia", "Samoa", "San Marino", "Santa Lúcia", "São Cristóvão e Neves", "São Tomé e Príncipe",
  "São Vicente e Granadinas", "Seicheles", "Senegal", "Serra Leoa", "Sérvia", "Singapura",
  "Síria", "Somália", "Sri Lanka", "Sudão", "Sudão do Sul", "Suécia", "Suíça", "Suriname",
  "Tailândia", "Tajiquistão", "Tanzânia", "Timor-Leste", "Togo", "Tonga", "Trinidad e Tobago",
  "Tunísia", "Turcomenistão", "Turquia", "Tuvalu", "Ucrânia", "Uganda", "Uruguai", "Uzbequistão",
  "Vanuatu", "Vaticano", "Venezuela", "Vietnã", "Zâmbia", "Zimbábue", "Outro"
].sort((a, b) => a.localeCompare(a, "pt-BR"));

const cadastroSchema = z.object({
  name: z.string().min(3, "Informe seu nome completo"),
  email: z.string().email("E-mail inválido"),
  birthDate: z.string().min(1, "Data de nascimento inválida"),
  displayName: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  uf: z.string().optional(),
  phone: z.string().min(10, "Telefone inválido (inclua DDI + DDD)"),
  senha: z.string().min(6, "A senha deve ter ao menos 6 caracteres"),
});

export default function Cadastro() {
  const [, setLocation] = useLocation();
  const { register } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // Estados locais para controlar as cidades carregadas via API do IBGE
  const [cidades, setCidades] = useState<string[]>([]);
  const [carregandoCidades, setCarregandoCidades] = useState(false);

  // Força a remoção da classe 'dark' mantendo o padrão visual da tela de Login
  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);

  const form = useForm<z.infer<typeof cadastroSchema>>({
    resolver: zodResolver(cadastroSchema),
    defaultValues: { 
      name: "",
      email: "",
      birthDate: "",
      displayName: "",
      country: "Brasil",
      city: "",
      uf: "",
      phone: "",
      senha: "",
    },
  });

  const selectedUf = form.watch("uf");
  const selectedCountry = form.watch("country");

  // Carrega as cidades via API do IBGE quando a UF for selecionada
  useEffect(() => {
    if (!selectedUf || selectedCountry !== "Brasil") {
      setCidades([]);
      return;
    }

    const fetchCidades = async () => {
      setCarregandoCidades(true);
      try {
        const response = await fetch(
          `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${selectedUf}/municipios`
        );
        const data = await response.json();
        const nomesCidades = data.map((item: { nome: string }) => item.nome).sort();
        setCidades(nomesCidades);
      } catch (error) {
        console.error("Erro ao carregar cidades do IBGE:", error);
      } finally {
        setCarregandoCidades(false);
      }
    };

    fetchCidades();
  }, [selectedUf, selectedCountry]);

  const onSubmit = async (values: z.infer<typeof cadastroSchema>) => {
    setIsLoading(true);
    const cityUfFormatted = values.city && values.uf ? `${values.city} - ${values.uf}` : values.city || values.uf || "";

    const payload = {
      ...values,
      cityUf: cityUfFormatted,
    };

    const success = await register(payload);
    setIsLoading(false);
    if (success) {
      setLocation("/inicio");
    }
  };

  return (
    <div className="[color-scheme:light] relative min-h-[100dvh] flex items-center justify-center p-4 bg-slate-100 overflow-hidden py-12">
      {/* Ambient orbs */}
      <div aria-hidden="true" className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full blur-[100px] pointer-events-none bg-cyan-400/10" />
      <div aria-hidden="true" className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full blur-[100px] pointer-events-none bg-emerald-400/10" />

      <Card className="w-full max-w-xl z-10 border-[5px] border-white/80 shadow-[inset_0_4px_6px_rgba(255,255,255,0.6),0_40px_80px_-12px_rgba(15,23,42,0.15),0_0_2px_rgba(15,23,42,0.1)] backdrop-blur-3xl bg-white/70 rounded-[32px] p-2">
        <CardHeader className="space-y-6 pb-4">

          {/* LOGO DA ELITEMED (IDÊNTICA À TELA DE LOGIN) */}
          <div className="flex flex-col items-center justify-center pt-2 w-full select-none">
            <img 
              src="/logo-elitemed.png" 
              alt="EliteMed Logo" 
              className="h-28 md:h-32 w-auto object-contain transition-all duration-300 drop-shadow-[0_4px_12px_rgba(6,182,212,0.1)]"
              draggable="false"
            />
          </div>

          <div className="text-center space-y-1.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Criar conta</h1>
            <p className="text-sm text-slate-600 font-medium">Comece sua preparação para a prova prática</p>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-700 font-bold text-xs uppercase tracking-wider">Nome completo *</FormLabel>
                      <FormControl>
                        <Input placeholder="Dra. Maria Silva" {...field} className="h-11 rounded-2xl border-slate-200 bg-white/80 focus-visible:ring-cyan-500 text-slate-900 font-medium placeholder:text-slate-400" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-700 font-bold text-xs uppercase tracking-wider">E-mail *</FormLabel>
                      <FormControl>
                        <Input placeholder="maria@email.com" {...field} className="h-11 rounded-2xl border-slate-200 bg-white/80 focus-visible:ring-cyan-500 text-slate-900 font-medium placeholder:text-slate-400" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-700 font-bold text-xs uppercase tracking-wider">Nome de exibição</FormLabel>
                      <FormControl>
                        <Input placeholder="Maria" {...field} className="h-11 rounded-2xl border-slate-200 bg-white/80 focus-visible:ring-cyan-500 text-slate-900 font-medium placeholder:text-slate-400" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="birthDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-700 font-bold text-xs uppercase tracking-wider">Data de nascimento *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="h-11 rounded-2xl border-slate-200 bg-white/80 focus-visible:ring-cyan-500 text-slate-900 font-medium text-slate-900" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Grid 3 colunas: País, UF e Cidade */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-700 font-bold text-xs uppercase tracking-wider">País</FormLabel>
                      <Select 
                        onValueChange={(val) => {
                          field.onChange(val);
                          form.setValue("uf", "");
                          form.setValue("city", "");
                        }} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-white/80 focus:ring-cyan-500 text-slate-900 font-medium">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-[300px]">
                          {PAISES.map((pais) => (
                            <SelectItem key={pais} value={pais}>
                              {pais}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="uf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-700 font-bold text-xs uppercase tracking-wider">UF</FormLabel>
                      <Select 
                        disabled={selectedCountry !== "Brasil"} 
                        onValueChange={(val) => {
                          field.onChange(val);
                          form.setValue("city", "");
                        }} 
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-white/80 focus:ring-cyan-500 text-slate-900 font-medium">
                            <SelectValue placeholder="UF" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-[300px]">
                          {ESTADOS_BR.map((uf) => (
                            <SelectItem key={uf} value={uf}>
                              {uf}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-700 font-bold text-xs uppercase tracking-wider">Cidade</FormLabel>
                      {selectedCountry === "Brasil" ? (
                        <Select 
                          disabled={!selectedUf || carregandoCidades} 
                          onValueChange={field.onChange} 
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-white/80 focus:ring-cyan-500 text-slate-900 font-medium">
                              <SelectValue 
                                placeholder={
                                  carregandoCidades 
                                    ? "Carregando..." 
                                    : !selectedUf 
                                    ? "Selecione UF" 
                                    : "Cidade"
                                } 
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-[300px]">
                            {cidades.map((city) => (
                              <SelectItem key={city} value={city}>
                                {city}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <FormControl>
                          <Input placeholder="Nome da cidade" {...field} className="h-11 rounded-2xl border-slate-200 bg-white/80 focus-visible:ring-cyan-500 text-slate-900 font-medium placeholder:text-slate-400" />
                        </FormControl>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-700 font-bold text-xs uppercase tracking-wider">Telefone (DDI+DDD) *</FormLabel>
                      <FormControl>
                        <Input placeholder="+55 11 99999-9999" {...field} className="h-11 rounded-2xl border-slate-200 bg-white/80 focus-visible:ring-cyan-500 text-slate-900 font-medium placeholder:text-slate-400" />
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
                      <FormLabel className="text-slate-700 font-bold text-xs uppercase tracking-wider">Senha *</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Mínimo 6 caracteres" {...field} className="h-11 rounded-2xl border-slate-200 bg-white/80 focus-visible:ring-cyan-500 text-slate-900 font-medium placeholder:text-slate-400" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button 
                type="submit" 
                className="w-full h-11 text-base font-bold rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-600 hover:to-emerald-600 text-white border-0 mt-6 shadow-md shadow-cyan-500/20 transition-all active:scale-[0.98]" 
                disabled={isLoading}
              >
                {isLoading ? "Criando conta..." : "Criar conta"}
              </Button>
            </form>
          </Form>

          <div className="mt-5 text-center text-sm font-medium">
            <span className="text-slate-500">Já tem conta? </span>
            <Link href="/login" className="font-bold text-cyan-600 hover:text-cyan-700 hover:underline">
              Entrar
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}