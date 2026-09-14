import { useEffect, useRef, useState } from 'react';
import QRCodeLib from 'qrcode';
import { Download, Printer, Share2 } from 'lucide-react';
import { Button } from './Button';
import { cn } from './utils';
import { useToast } from './Toast';

/**
 * Visualizador de QR Code.
 *
 * O valor codificado é o identificador opaco do convite (ex.: `EVENT-XXXX-XXXX`),
 * nunca dados pessoais. O QR é renderizado em um `<canvas>` e pode ser salvo
 * como PNG, impresso ou compartilhado via Web Share API — com fallback de
 * cópia do texto em navegadores sem suporte.
 */
export function QrCodeViewer({
  value,
  size = 240,
  guestName,
  fileName,
  className,
  showActions = true,
}: {
  value: string;
  size?: number;
  /** Nome usado no arquivo ao salvar (ex.: "joao-da-silva-qrcode.png"). */
  guestName?: string;
  fileName?: string;
  className?: string;
  showActions?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !value) return;

    QRCodeLib.toCanvas(
      canvas,
      value,
      {
        width: size,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: { dark: '#1e2532', light: '#ffffff' },
      },
      (err) => {
        if (err) {
          setError('Não foi possível gerar o QR Code.');
          return;
        }
        setError(null);
        setDataUrl(canvas.toDataURL('image/png'));
      },
    );
  }, [value, size]);

  const fileBase =
    fileName ??
    (guestName
      ? `${guestName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')}-qrcode`
      : 'convite-qrcode');

  const handleDownload = () => {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${fileBase}.png`;
    link.click();
    toast.success('QR Code salvo', 'O arquivo foi baixado para o seu dispositivo.');
  };

  const handleShare = async () => {
    const shareData = {
      title: 'Meu QR Code de entrada',
      text: `Apresente este código na entrada do evento. Código: ${value}`,
    };

    if (navigator.share && dataUrl) {
      try {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const file = new File([blob], `${fileBase}.png`, { type: 'image/png' });

        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ ...shareData, files: [file] });
          return;
        }
        await navigator.share(shareData);
        return;
      } catch {
        // Usuário cancelou ou o compartilhamento falhou — cai no fallback.
      }
    }

    try {
      await navigator.clipboard.writeText(value);
      toast.info('Código copiado', 'Cole em uma conversa para compartilhar seu acesso.');
    } catch {
      toast.warning('Não foi possível compartilhar', 'Salve o QR Code como imagem.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (error) {
    return (
      <div className="rounded-2xl border-danger-200 bg-danger-50 p-6 text-center text-sm text-danger-700">
        {error}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      <div className="rounded-3xl border-wedding-200 bg-white p-4 shadow-invite">
        <canvas ref={canvasRef} aria-label="QR Code de entrada" className="block max-w-full" />
      </div>

      <p className="font-mono text-sm tracking-wider text-wedding-700">{value}</p>

      {showActions && (
        <div className="no-print flex-wrap justify-center gap-2">
          <Button variant="secondary" size="sm" icon={<Download className="h-4 w-4" />} onClick={handleDownload}>
            Salvar QR Code
          </Button>
          <Button variant="secondary" size="sm" icon={<Share2 className="h-4 w-4" />} onClick={handleShare}>
            Compartilhar
          </Button>
          <Button variant="ghost" size="sm" icon={<Printer className="h-4 w-4" />} onClick={handlePrint}>
            Imprimir
          </Button>
        </div>
      )}
    </div>
  );
}
