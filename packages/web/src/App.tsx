import { Navigate, Route, Routes } from 'react-router-dom';
import { useSession } from '@/hooks/useSession';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { LoadingState } from '@/components/ui/States';

// Público
import { InvitationPage } from '@/pages/public/InvitationPage';
import { RsvpPage } from '@/pages/public/RsvpPage';
import { QrCodePage } from '@/pages/public/QrCodePage';
import { NotFoundPage } from '@/pages/public/NotFoundPage';
import { PrivacyPage } from '@/pages/public/PrivacyPage';

// Autenticação
import { LoginPage } from '@/pages/admin/LoginPage';

// Painel
import { DashboardPage } from '@/pages/admin/DashboardPage';
import { EventsPage } from '@/pages/admin/EventsPage';
import { EventOverviewPage } from '@/pages/admin/EventOverviewPage';
import { GuestsPage } from '@/pages/admin/GuestsPage';
import { InvitationsPage } from '@/pages/admin/InvitationsPage';
import { VenuePage } from '@/pages/admin/VenuePage';
import { SettingsPage } from '@/pages/admin/SettingsPage';
import { AuditPage } from '@/pages/admin/AuditPage';
import { UsersPage } from '@/pages/admin/UsersPage';

// Portaria
import { CheckInHomePage } from '@/pages/checkin/CheckInHomePage';
import { CheckInScannerPage } from '@/pages/checkin/CheckInScannerPage';

/**
 * Mapa de rotas do Celebrai.
 *
 * Estrutura (ver escopo §29):
 *   Públicas  → /convite/:token, /convite/:token/confirmacao, /convite/:token/qrcode
 *   Login     → /login
 *   Painel    → /dashboard, /eventos, /eventos/:id/*
 *   Portaria  → /check-in, /check-in/scanner
 *
 * O acesso é decidido pelo papel: a RECEPÇÃO só chega ao check-in.
 */
export function App() {
  const { isLoading } = useSession();

  // Enquanto validamos o token salvo, evitamos redirecionamentos falsos.
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState label="Carregando sessão..." />
      </div>
    );
  }

  return (
    <Routes>
      {/* ------------------------- Área do convidado ------------------------- */}
      <Route path="/convite/:token" element={<InvitationPage />} />
      <Route path="/convite/:token/confirmacao" element={<RsvpPage />} />
      <Route path="/convite/:token/qrcode" element={<QrCodePage />} />

      {/* ----------------------------- Políticas ----------------------------- */}
      <Route path="/privacidade" element={<PrivacyPage />} />

      {/* ------------------------------- Login ------------------------------- */}
      <Route path="/login" element={<LoginPage />} />

      {/* ------------------------- Painel administrativo --------------------- */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="eventos" element={<EventsPage />} />

        <Route path="eventos/:id" element={<EventOverviewPage />} />
        <Route path="eventos/:id/convidados" element={<GuestsPage />} />
        <Route path="eventos/:id/convites" element={<InvitationsPage />} />
        <Route path="eventos/:id/local" element={<VenuePage />} />
        <Route path="eventos/:id/configuracoes" element={<SettingsPage />} />
        <Route path="eventos/:id/auditoria" element={<AuditPage />} />

        {/* Somente SUPER_ADMIN */}
        <Route
          path="usuarios"
          element={
            <ProtectedRoute requireSuperAdmin>
              <UsersPage />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* ------------------------------- Portaria ---------------------------- */}
      <Route
        path="/check-in"
        element={
          <ProtectedRoute requireCheckIn>
            <CheckInHomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/check-in/scanner"
        element={
          <ProtectedRoute requireCheckIn>
            <CheckInScannerPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/check-in/scanner/:eventId"
        element={
          <ProtectedRoute requireCheckIn>
            <CheckInScannerPage />
          </ProtectedRoute>
        }
      />

      {/* ------------------------------- 404 -------------------------------- */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
