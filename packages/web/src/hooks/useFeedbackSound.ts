import { useCallback, useRef } from 'react';

/**
 * Feedback sonoro do check-in (§26 do escopo: "feed-back sonoro opcional").
 *
 * Usa a Web Audio API para gerar tons curtos sem baixar arquivos:
 *  - entrada autorizada → dois tons ascendentes (positivo)
 *  - negado             → um tom grave (negativo)
 *  - alerta             → tom médio (duplicidade)
 *
 * O áudio só é tocado após uma interação do usuário (regra dos navegadores);
 * como o operador clica em "Escanear", a permissão já está satisfeita.
 */
export function useFeedbackSound() {
  const contextRef = useRef<AudioContext | null>(null);

  const getContext = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;

    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;

    if (!contextRef.current) contextRef.current = new Ctor();
    if (contextRef.current.state === 'suspended') void contextRef.current.resume();
    return contextRef.current;
  }, []);

  const tone = useCallback(
    (frequency: number, durationMs: number, delayMs = 0, type: OscillatorType = 'sine') => {
      const context = getContext();
      if (!context) return;

      const start = context.currentTime + delayMs / 1000;
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);

      // Envelope suave para evitar estalos.
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + durationMs / 1000);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + durationMs / 1000 + 0.02);
    },
    [getContext],
  );

  return {
    /** Entrada autorizada: dois tons ascendentes. */
    playSuccess: useCallback(() => {
      tone(880, 130, 0);
      tone(1320, 180, 120);
    }, [tone]),

    /** Entrada negada: tom grave descendente. */
    playError: useCallback(() => {
      tone(320, 260, 0, 'square');
      tone(220, 320, 200, 'square');
    }, [tone]),

    /** Alerta (duplicidade): tom médio repetido. */
    playWarning: useCallback(() => {
      tone(660, 160, 0);
      tone(660, 160, 200);
    }, [tone]),
  };
}
