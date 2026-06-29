import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ChevronLeft, Loader2, Save, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  fetchAppSettings,
  upsertAppSetting,
  type AppSettings,
  DEFAULT_SETTINGS,
} from "@/lib/appSettingsService";

export default function AdminSettings() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AppSettings>({ ...DEFAULT_SETTINGS });

  useEffect(() => {
    fetchAppSettings().then((s) => {
      setForm(s);
      setLoading(false);
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    const results = await Promise.all([
      upsertAppSetting("whatsapp", form.whatsapp.trim()),
      upsertAppSetting("email_suporte", form.email_suporte.trim()),
    ]);
    setSaving(false);
    if (results.every(Boolean)) {
      toast.success("Configurações salvas com sucesso");
    } else {
      toast.error("Erro ao salvar. Verifique as permissões de admin.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="px-1 pt-2 pb-1"
      >
        <button
          onClick={() => setLocation("/admin")}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit mb-1"
        >
          <ChevronLeft className="w-4 h-4" />
          Painel admin
        </button>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Dados de contato exibidos na Central de Ajuda
        </p>
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
        >
          <Card className="p-5 flex flex-col gap-5 rounded-2xl border-border/60">
            <div className="flex items-center gap-2 border-b border-border/60 pb-4">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Phone className="w-4 h-4" />
              </div>
              <h2 className="font-bold text-base">Contato de suporte</h2>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="whatsapp" className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  WhatsApp
                </Label>
                <Input
                  id="whatsapp"
                  value={form.whatsapp}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, whatsapp: e.target.value }))
                  }
                  placeholder="5511999999999"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Número com código do país e DDD, sem espaços ou traços.
                  Ex: <span className="font-mono">5511999999999</span>
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="email_suporte"
                  className="flex items-center gap-1.5"
                >
                  <Mail className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  E-mail de suporte
                </Label>
                <Input
                  id="email_suporte"
                  type="email"
                  value={form.email_suporte}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email_suporte: e.target.value }))
                  }
                  placeholder="suporte@revalida.app"
                  className="font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button
                onClick={handleSave}
                disabled={
                  saving ||
                  !form.whatsapp.trim() ||
                  !form.email_suporte.trim()
                }
                className="gap-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Salvar configurações
              </Button>
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
