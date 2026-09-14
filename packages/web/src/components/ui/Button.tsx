import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from './utils';

/**
 * Botão do Design System.
 *
 * Variantes:
 *  - primary    → ação principal do painel
 *  - secondary  → ação secundária
 *  - ghost      → ação discreta
 *  - danger     → ação destrutiva
 *  - success    → confirmação positiva (check-in autorizado)
 *  - invite     → botão dourado do convite
 *
 * `size="touch"` gera um botão grande, obrigatório para uso no celular na
 * portaria (§26 do escopo).
 */
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'success'
  | 'invite'
  | 'invite-outline';

export type ButtonSize = 'sm' | 'md' | 'lg' | 'touch';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  success: 'btn-success',
  invite: 'btn-invite',
  'invite-outline': 'btn-invite-outline',
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'px-3 py-2 text-xs',
  md: '',
  lg: 'px-6 py-3 text-base',
  touch: 'w-full min-h-[56px] rounded-2xl px-6 text-base font-semibold',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconRight,
  fullWidth = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
      {!loading && iconRight}
    </button>
  );
}
