import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

/**
 * Provedor de WhatsApp — WhatsApp Business Cloud API (API oficial da Meta).
 *
 * IMPORTANTE: este projeto NÃO usa bibliotecas não oficiais nem automações
 * que burlem as limitações do WhatsApp. A integração é feita exclusivamente
 * pelo endpoint oficial `/{phone-number-id}/messages` do Graph API.
 *
 * Driver `cloud_api`: envio real (requer WHATSAPP_PHONE_NUMBER_ID e
 * WHATSAPP_ACCESS_TOKEN).
 * Driver `disabled`: não envia. O link do convite continua disponível para
 * cópia/compartilhamento manual e fica registrado em `notifications`.
 */
export interface SendWhatsAppInput {
  /** Telefone em E.164: +5521999999 */
  to: string;
  /** Texto livre (só permitido dentro da janela de 24h). */
  body?: string;
  /** Template aprovado pela Meta (obrigatório fora da janela de 24h). */
  template?: {
    name: string;
    language: string;
    variables?: string[];
  };
}

export interface SendWhatsAppResult {
  status: 'SENT' | 'FAILED' | 'SKIPPED';
  provider: string;
  messageId?: string;
  error?: string;
}

export const whatsappProvider = {
  isEnabled(): boolean {
    return (
      env.WHATSAPP_DRIVER === 'cloud_api' &&
      Boolean(env.WHATSAPP_PHONE_NUMBER_ID) &&
      Boolean(env.WHATSAPP_ACCESS_TOKEN)
    );
  },

  async send(input: SendWhatsAppInput): Promise<SendWhatsAppResult> {
    if (!this.isEnabled()) {
      logger.info(`[whatsapp:disabled] Simulando envio para ${input.to}`);
      return { status: 'SKIPPED', provider: 'disabled' };
    }

    const url = `${env.WHATSAPP_API_URL}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

    const payload = input.template
      ? {
        messaging_product: 'whatsapp',
        to: input.to.replace('+', ''),
        type: 'template',
        template: {
          name: input.template.name,
          language: { code: input.template.language },
          components: input.template.variables?.length
            ? [
              {
                type: 'body',
                parameters: input.template.variables.map((text) => ({
                  type: 'text',
                  text,
                })),
              },
            ]
            : undefined,
        },
      }
      : {
        messaging_product: 'whatsapp',
        to: input.to.replace('+', ''),
        type: 'text',
        text: { preview_url: true, body: input.body ?? '' },
      };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const json = (await response.json().catch(() => null)) as
        | { messages?: Array<{ id: string }>; error?: { message: string } }
        | null;

      if (!response.ok) {
        const message = json?.error?.message ?? `HTTP ${response.status}`;
        logger.error('Falha ao enviar WhatsApp', { to: input.to, error: message });
        return { status: 'FAILED', provider: 'cloud_api', error: message };
      }

      return {
        status: 'SENT',
        provider: 'cloud_api',
        messageId: json?.messages?.[0]?.id,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido no envio';
      logger.error('Falha ao enviar WhatsApp', { to: input.to, error: message });
      return { status: 'FAILED', provider: 'cloud_api', error: message };
    }
  },
};
