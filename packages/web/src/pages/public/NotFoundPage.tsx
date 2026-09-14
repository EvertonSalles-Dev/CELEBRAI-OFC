import { Link } from 'react-router-dom';
import { Heart, Home } from 'lucide-react';

/** Página 404 — elegante e com caminho de volta. */
export function NotFoundPage() {
  return (
    <div className="invite-theme flex min-h-screen items-center justify-center px-5">
      <div className="card-invite max-w-md px-8 py-10 text-center">
        <Heart className="mx-auto h-8 w-8 text-gold-400" fill="currentColor" />

        <p className="mt-5 font-display text-5xl font-light text-wedding-300">404</p>

        <h1 className="mt-3 font-display text-2xl text-wedding-900">Página não encontrada</h1>
        <p className="mt-3 text-sm leading-relaxed text-wedding-600">
          O endereço acessado não existe ou foi movido. Se você recebeu um link de convite, confira
          se ele foi copiado por completo.
        </p>

        <Link to="/login" className="btn-invite mt-6">
          <Home className="h-4 w-4" />
          Ir para o início
        </Link>
      </div>
    </div>
  );
}
