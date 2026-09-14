import { createHash } from 'node:crypto';

/**
 * Validação e mascaramento de dados pessoais brasileiros.
 * O CPF é dado sensível (LGPD): só persistimos hash + versão mascarada.
 */

/** Remove qualquer caractere não numérico. */
export function onlyDigits(value: string): string {
  return (value || '').replace(/\D+/g, '');
}

/**
 * Valida CPF conferindo os dois dígitos verificadores.
 * Rejeita sequências repetidas (000.000.000-00 etc.).
 */
export function isValidCpf(input: string): boolean {
  const cpf = onlyDigits(input);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digits = cpf.split('').map(Number);

  const calcCheck = (slice: number[]): number => {
    const weightStart = slice.length + 1;
    const sum = slice.reduce((acc, digit, idx) => acc + digit * (weightStart - idx), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  const first = calcCheck(digits.slice(0, 9));
  if (first !== digits[9]) return false;

  const second = calcCheck(digits.slice(0, 10));
  return second === digits[10];
}

/** Formata CPF como 000.000.000-00. */
export function formatCpf(input: string): string {
  const cpf = onlyDigits(input).padStart(11, '0').slice(0, 11);
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
}

/**
 * Mascaramento seguro para exibição: `***.***.***-42`.
 * Apenas os dois últimos dígitos são revelados.
 */
export function maskCpf(input: string): string {
  const cpf = onlyDigits(input);
  if (cpf.length !== 11) return '***.***.***-**';
  return `***.***.***-${cpf.slice(-2)}`;
}

/** Hash irreversível do CPF (para deduplicação sem armazenar o dado). */
export function hashCpf(input: string, secret: string): string {
  return createHash('sha256').update(`${secret}:${onlyDigits(input)}`).digest('hex');
}

/**
 * Normaliza telefone brasileiro para o formato E.164 (+55DDNNN).
 * Retorna `null` quando inválido.
 */
export function normalizeBrazilianPhone(input: string): string | null {
  let digits = onlyDigits(input);
  if (!digits) return null;

  // Remove o código do país se já vier com ele.
  if (digits.startsWith('55') && digits.length > 11) {
    digits = digits.slice(2);
  }

  // Aceita fixo (10) e celular (11) com DDD.
  if (digits.length !== 10 && digits.length !== 11) return null;

  const ddd = Number(digits.slice(0, 2));
  if (ddd < 11 || ddd > 99) return null;

  if (digits.length === 11 && digits[2] !== '9') return null;

  return `+55${digits}`;
}

/** Formata telefone brasileiro: (21) 99999-9999. */
export function formatBrazilianPhone(input: string): string {
  const normalized = normalizeBrazilianPhone(input);
  if (!normalized) return input;
  const digits = normalized.slice(3);
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
}

/** Valida e normaliza CEP (8 dígitos). */
export function normalizeZipCode(input: string): string | null {
  const digits = onlyDigits(input);
  return digits.length === 8 ? digits : null;
}

/** Formata CEP: 00000-000. */
export function formatZipCode(input: string): string {
  const digits = onlyDigits(input).padStart(8, '0').slice(0, 8);
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

/** Normaliza e-mail (trim + lowercase). */
export function normalizeEmail(input: string): string {
  return (input || '').trim().toLowerCase();
}

/** Máscara de e-mail para exibição: `jo***@email.com`. */
export function maskEmail(input: string): string {
  const email = normalizeEmail(input);
  const [user, domain] = email.split('@');
  if (!user || !domain) return '***';
  const visible = user.slice(0, Math.min(2, user.length));
  return `${visible}***@${domain}`;
}
