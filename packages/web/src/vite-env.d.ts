/// <reference types="vite/client" />

/**
 * Tipagem das variáveis de ambiente expostas pelo Vite.
 * Apenas variáveis com prefixo `VITE_` chegam ao cliente.
 */
interface ImportMetaEnv {
  /** URL base da API. Vazio usa o proxy do Vite (mesmo origin). */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
