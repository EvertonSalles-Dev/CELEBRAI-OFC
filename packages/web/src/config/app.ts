/**
 * Configuração central da aplicação (frontend).
 * Um único lugar para URL da API, nomes e chaves de storage.
 */

/** URL base da API. Vazio = usar o proxy do Vite (mesmo origin). */
export const API_URL = import.meta.env.VITE_API_URL ?? '';

/** Prefixo das rotas da API. */
export const API_PREFIX = '/api';

/** Chave do access token no sessionStorage (não persiste entre abas). */
export const ACCESS_TOKEN_KEY = 'celebrai.accessToken';

/** Nome da aplicação. */
export const APP_NAME = 'Celebrai';

/** Tagline oficial. */
export const APP_TAGLINE = 'Convites inteligentes. Eventos mais organizados.';

/** Tempo (ms) que a tela de resultado do check-in permanece antes de resetar. */
export const CHECKIN_RESULT_TIMEOUT = 5000;

/** Intervalo (ms) do polling de status na tela do convite. */
export const INVITATION_POLL_INTERVAL = 30000;

/** Reemissão automática do access token antes de expirar (ms). */
export const TOKEN_REFRESH_SKEW = 60_000;
