import type { ReactNode } from 'react';

/** Junta classes condicionais sem dependência externa. */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

/** Aplica foco inicial e mantém o foco no modal (acessibilidade básica). */
export function focusFirst(container: HTMLElement | null): void {
  if (!container) return;
  const target = container.querySelector<HTMLElement>(
    'input:not([type="hidden"]), textarea, select, button, [tabindex]:not([tabindex="-1"])',
  );
  target?.focus();
}

/** Junta um rótulo com seus filhos de forma semântica quando necessário. */
export type WithChildren = { children: ReactNode };
