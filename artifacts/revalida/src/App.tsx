import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { RealtimeProvider } from "@/contexts/RealtimeContext";
import { TrainingProvider, useTraining } from "@/contexts/TrainingContext";
import { LiveKitAudioProvider } from "@/contexts/LiveKitAudioContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SubscribedRoute } from "@/components/SubscribedRoute";
import { AppShell } from "@/components/AppShell";
import { InviteModal } from "@/components/training/InviteModal";
import { PasswordRecoveryModal } from "@/components/PasswordRecoveryModal";
import { MatchmakingOverlay } from "@/components/training/MatchmakingOverlay";
import { Loader2 } from "lucide-react";

import Login from "@/pages/Login";
import Cadastro from "@/pages/Cadastro";
import Inicio from "@/pages/Inicio";
import Progresso from "@/pages/Progresso";
import Noticias from "@/pages/Noticias";
import Perfil from "@/pages/Perfil";
import NotFound from "@/pages/not-found";
import { AdminRoute } from "@/components/AdminRoute";
import { ColaboradorRoute } from "@/components/ColaboradorRoute";
import { MentorRoute } from "@/components/MentorRoute";
import MentorDashboard from "@/pages/mentor/MentorDashboard";
import AdminHome from "@/pages/admin/AdminHome";
import ColaboradorHome from "@/pages/colaborador/ColaboradorHome";
import ColaboradorChecklistsList from "@/pages/colaborador/ColaboradorChecklistsList";
import ColaboradorChecklistBuilder from "@/pages/colaborador/ColaboradorChecklistBuilder";
import ChecklistsList from "@/pages/admin/ChecklistsList";
import ChecklistBuilder from "@/pages/admin/ChecklistBuilder";
import ResumosList from "@/pages/admin/ResumosList";
import ResumoEditor from "@/pages/admin/ResumoEditor";
import NoticiasList from "@/pages/admin/NoticiasList";
import NoticiaEditor from "@/pages/admin/NoticiaEditor";
import EsqueciSenha from "@/pages/EsqueciSenha";
import RedefinirSenha from "@/pages/RedefinirSenha";
import Observabilidade from "@/pages/admin/Observabilidade";
import UsuariosAdmin from "@/pages/admin/UsuariosAdmin";
import AdminSettings from "@/pages/admin/AdminSettings";
import AdminPersonalizacao from "@/pages/admin/AdminPersonalizacao";
import AdminAssinaturas from "@/pages/admin/AdminAssinaturas";
import AdminGamificacao from "@/pages/admin/AdminGamificacao";
import AdminMentorias from "@/pages/admin/AdminMentorias";
import Mentorias from "@/pages/Mentorias";
import Resumos from "@/pages/Resumos";
import Notas from "@/pages/Notas";
import Plano from "@/pages/Plano";
import VitrinePlanos from "@/pages/VitrinePlanos";
import AssinaturaConfirmada from "@/pages/AssinaturaConfirmada";
import Rankings from "@/pages/Rankings";
import Conquistas from "@/pages/Conquistas";
import EventoDetalhes from "@/pages/EventoDetalhes";
import Ajuda from "@/pages/Ajuda";
import UsuariosLista from "@/pages/training/UsuariosLista";
import PerfilPublico from "@/pages/PerfilPublico";
import { AbaChatContainer } from "@/components/chat/AbaChatContainer";
import { ChatUnreadProvider } from "@/contexts/ChatUnreadContext";
import SelecaoPapel from "@/pages/training/SelecaoPapel";
import PacienteConfig from "@/pages/training/PacienteConfig";
import MedicoEspera from "@/pages/training/MedicoEspera";
import SoloConfig from "@/pages/training/SoloConfig";
import Estacao from "@/pages/training/Estacao";

const queryClient = new QueryClient();

function SessionRecoveryHandler() {
  const { recoveryRoute, clearRecoveryRoute } = useTraining();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (recoveryRoute) {
      setLocation(recoveryRoute);
      clearRecoveryRoute();
    }
  }, [recoveryRoute, clearRecoveryRoute, setLocation]);

  return null;
}

function SplashLoader() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );
}

function RootRedirect() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <SplashLoader />;
  return <Redirect to={isAuthenticated ? "/inicio" : "/login"} replace />;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <SplashLoader />;
  if (isAuthenticated) return <Redirect to="/inicio" replace />;
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={RootRedirect} />

      <Route path="/login">
        <PublicOnly>
          <Login />
        </PublicOnly>
      </Route>

      <Route path="/cadastro">
        <PublicOnly>
          <Cadastro />
        </PublicOnly>
      </Route>

      <Route path="/esqueci-senha">
        <PublicOnly>
          <EsqueciSenha />
        </PublicOnly>
      </Route>

      <Route path="/redefinir-senha">
        <RedefinirSenha />
      </Route>

      <Route path="/inicio">
        <ProtectedRoute>
          <AppShell>
            <Inicio />
          </AppShell>
        </ProtectedRoute>
      </Route>

      <Route path="/progresso">
        <ProtectedRoute>
          <AppShell>
            <Progresso />
          </AppShell>
        </ProtectedRoute>
      </Route>

      <Route path="/noticias">
        <ProtectedRoute>
          <AppShell>
            <Noticias />
          </AppShell>
        </ProtectedRoute>
      </Route>

      <Route path="/chat">
        <ProtectedRoute>
          <AppShell>
            <AbaChatContainer />
          </AppShell>
        </ProtectedRoute>
      </Route>

      <Route path="/perfil">
        <ProtectedRoute>
          <AppShell>
            <Perfil />
          </AppShell>
        </ProtectedRoute>
      </Route>

      <Route path="/notas">
        <ProtectedRoute>
          <AppShell>
            <Notas />
          </AppShell>
        </ProtectedRoute>
      </Route>

      <Route path="/plano">
        <ProtectedRoute>
          <AppShell>
            <Plano />
          </AppShell>
        </ProtectedRoute>
      </Route>

      <Route path="/assinatura/confirmada">
        <ProtectedRoute>
          <AppShell>
            <AssinaturaConfirmada />
          </AppShell>
        </ProtectedRoute>
      </Route>

      <Route path="/assinatura">
        <ProtectedRoute>
          <AppShell>
            <VitrinePlanos />
          </AppShell>
        </ProtectedRoute>
      </Route>

      <Route path="/rankings">
        <ProtectedRoute>
          <AppShell>
            <Rankings />
          </AppShell>
        </ProtectedRoute>
      </Route>

      <Route path="/conquistas/evento/:id">
        <ProtectedRoute>
          <AppShell>
            <EventoDetalhes />
          </AppShell>
        </ProtectedRoute>
      </Route>

      <Route path="/conquistas">
        <ProtectedRoute>
          <AppShell>
            <Conquistas />
          </AppShell>
        </ProtectedRoute>
      </Route>

      <Route path="/ajuda">
        <ProtectedRoute>
          <AppShell>
            <Ajuda />
          </AppShell>
        </ProtectedRoute>
      </Route>

      <Route path="/treino">
        <SubscribedRoute>
          <AppShell>
            <UsuariosLista />
          </AppShell>
        </SubscribedRoute>
      </Route>

      <Route path="/perfil/:userId">
        <ProtectedRoute>
          <PerfilPublico />
        </ProtectedRoute>
      </Route>

      <Route path="/treino/roles">
        <SubscribedRoute>
          <SelecaoPapel />
        </SubscribedRoute>
      </Route>

      <Route path="/treino/config">
        <SubscribedRoute>
          <PacienteConfig />
        </SubscribedRoute>
      </Route>

      <Route path="/treino/solo">
        <SubscribedRoute>
          <SoloConfig />
        </SubscribedRoute>
      </Route>

      <Route path="/treino/espera">
        <SubscribedRoute>
          <MedicoEspera />
        </SubscribedRoute>
      </Route>

      <Route path="/treino/estacao">
        <SubscribedRoute>
          <Estacao />
        </SubscribedRoute>
      </Route>

      {/* ── Mentor portal ────────────────────────────────────────────────── */}
      <Route path="/mentor/painel">
        <MentorRoute>
          <AppShell>
            <MentorDashboard />
          </AppShell>
        </MentorRoute>
      </Route>

      {/* ── Colaborador portal ───────────────────────────────────────────── */}
      <Route path="/colaborador">
        <ColaboradorRoute>
          <AppShell>
            <ColaboradorHome />
          </AppShell>
        </ColaboradorRoute>
      </Route>

      <Route path="/colaborador/checklists">
        <ColaboradorRoute>
          <AppShell>
            <ColaboradorChecklistsList />
          </AppShell>
        </ColaboradorRoute>
      </Route>

      <Route path="/colaborador/checklists/nova">
        <ColaboradorRoute>
          <AppShell>
            <ColaboradorChecklistBuilder />
          </AppShell>
        </ColaboradorRoute>
      </Route>

      <Route path="/colaborador/checklists/editar/:id">
        <ColaboradorRoute>
          <AppShell>
            <ColaboradorChecklistBuilder />
          </AppShell>
        </ColaboradorRoute>
      </Route>

      {/* ── Admin panel ──────────────────────────────────────────────────── */}
      <Route path="/admin">
        <AdminRoute>
          <AppShell>
            <AdminHome />
          </AppShell>
        </AdminRoute>
      </Route>

      <Route path="/admin/checklists">
        <AdminRoute>
          <AppShell>
            <ChecklistsList />
          </AppShell>
        </AdminRoute>
      </Route>

      <Route path="/admin/checklists/novo">
        <AdminRoute>
          <AppShell>
            <ChecklistBuilder />
          </AppShell>
        </AdminRoute>
      </Route>

      <Route path="/admin/checklists/editar/:id">
        <AdminRoute>
          <AppShell>
            <ChecklistBuilder />
          </AppShell>
        </AdminRoute>
      </Route>

      <Route path="/admin/resumos">
        <AdminRoute>
          <AppShell>
            <ResumosList />
          </AppShell>
        </AdminRoute>
      </Route>

      <Route path="/admin/resumos/novo">
        <AdminRoute>
          <AppShell>
            <ResumoEditor />
          </AppShell>
        </AdminRoute>
      </Route>

      <Route path="/admin/resumos/editar/:id">
        <AdminRoute>
          <AppShell>
            <ResumoEditor />
          </AppShell>
        </AdminRoute>
      </Route>

      <Route path="/admin/noticias">
        <AdminRoute>
          <AppShell>
            <NoticiasList />
          </AppShell>
        </AdminRoute>
      </Route>

      <Route path="/admin/noticias/novo">
        <AdminRoute>
          <AppShell>
            <NoticiaEditor />
          </AppShell>
        </AdminRoute>
      </Route>

      <Route path="/admin/noticias/editar/:id">
        <AdminRoute>
          <AppShell>
            <NoticiaEditor />
          </AppShell>
        </AdminRoute>
      </Route>

      <Route path="/admin/observabilidade">
        <AdminRoute>
          <AppShell>
            <Observabilidade />
          </AppShell>
        </AdminRoute>
      </Route>

      <Route path="/admin/usuarios">
        <AdminRoute>
          <AppShell>
            <UsuariosAdmin />
          </AppShell>
        </AdminRoute>
      </Route>

      <Route path="/admin/gamificacao">
        <AdminRoute>
          <AppShell>
            <AdminGamificacao />
          </AppShell>
        </AdminRoute>
      </Route>

      <Route path="/admin/configuracoes">
        <AdminRoute>
          <AppShell>
            <AdminSettings />
          </AppShell>
        </AdminRoute>
      </Route>

      <Route path="/admin/personalizacao">
        <AdminRoute>
          <AppShell>
            <AdminPersonalizacao />
          </AppShell>
        </AdminRoute>
      </Route>

      <Route path="/admin/assinaturas">
        <AdminRoute>
          <AppShell>
            <AdminAssinaturas />
          </AppShell>
        </AdminRoute>
      </Route>

      <Route path="/admin/mentorias">
        <AdminRoute>
          <AppShell>
            <AdminMentorias />
          </AppShell>
        </AdminRoute>
      </Route>

      <Route path="/mentorias">
        <ProtectedRoute>
          <AppShell>
            <Mentorias />
          </AppShell>
        </ProtectedRoute>
      </Route>

      <Route path="/resumos">
        <SubscribedRoute>
          <AppShell>
            <Resumos />
          </AppShell>
        </SubscribedRoute>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="revalida.theme">
        <AuthProvider>
          <RealtimeProvider>
          <TrainingProvider>
            <LiveKitAudioProvider>
            <ChatUnreadProvider>
            <TooltipProvider>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <Router />
                <InviteModal />
                <MatchmakingOverlay />
                <SessionRecoveryHandler />
                <PasswordRecoveryModal />
              </WouterRouter>
              <Toaster position="top-center" richColors />
            </TooltipProvider>
            </ChatUnreadProvider>
            </LiveKitAudioProvider>
          </TrainingProvider>
          </RealtimeProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
