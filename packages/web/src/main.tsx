import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { App } from '@/App';
import { ToastProvider } from '@/components/ui/Toast';
import '@/styles/globals.css';

/**
 * Ponto de entrada do frontend.
 *
 * Providers em ordem:
 *  1. React Query  — cache de dados do servidor
 *  2. BrowserRouter — rotas
 *  3. ToastProvider — notificações globais
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Evita refetch agressivo em telas que já têm polling (dashboard/check-in).
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Não insiste em erros de autenticação/permissão.
        const status = (error as { status?: number } | null)?.status;
        if (status === 401 || status === 403 || status === 404) return false;
        return failureCount < 2;
      },
      staleTime: 15_000,
    },
    mutations: {
      retry: 0,
    },
  },
});

const container = document.getElementById('root');

if (!container) {
  throw new Error('Elemento #root não encontrado no index.html');
}

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <App />
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
