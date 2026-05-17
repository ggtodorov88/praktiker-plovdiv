import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { Camera, X } from "lucide-react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  disabled?: boolean;
};

export function CodeInput({ value, onChange, onComplete, disabled }: Props) {
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);

  const stopScan = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
  };

  useEffect(() => {
    if (!scanning) return;
    let cancelled = false;
    setScanError(null);
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    (async () => {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        const back = devices.find((d) => /back|rear|environment/i.test(d.label)) ?? devices[0];
        if (!back) throw new Error("Не е намерена камера.");
        if (cancelled || !videoRef.current) return;
        const controls = await reader.decodeFromVideoDevice(
          back.deviceId,
          videoRef.current,
          (result) => {
            if (result) {
              const text = result.getText().replace(/\D/g, "");
              if (text) {
                onChange(text);
                stopScan();
                onComplete?.(text);
              }
            }
          }
        );
        controlsRef.current = controls;
      } catch (e) {
        setScanError(e instanceof Error ? e.message : "Неуспешен достъп до камерата.");
        setScanning(false);
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.length >= 6) onComplete?.(value);
          }}
          placeholder="напр. 123456"
          className="flex-1 h-14 rounded-xl border-2 border-input bg-card px-4 text-center text-xl font-semibold tracking-wider text-foreground shadow-[var(--shadow-card)] focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 transition-all disabled:opacity-50"
          aria-label="Код на продукта"
        />
        <button
          type="button"
          onClick={() => setScanning(true)}
          disabled={disabled}
          className="px-4 h-14 rounded-xl border-2 border-input bg-card text-foreground font-semibold inline-flex items-center gap-2 hover:bg-muted active:scale-[0.99] disabled:opacity-50"
          aria-label="Сканирай баркод"
        >
          <Camera className="size-5" />
          <span className="hidden sm:inline">Сканирай</span>
        </button>
      </div>

      {scanError && (
        <p className="text-xs text-destructive">{scanError}</p>
      )}

      {scanning && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
          <div className="relative w-full max-w-md aspect-square rounded-2xl overflow-hidden bg-black">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            <div className="absolute inset-8 border-2 border-white/80 rounded-xl pointer-events-none" />
          </div>
          <p className="text-white mt-4 text-sm">Насочи камерата към баркода</p>
          <button
            type="button"
            onClick={stopScan}
            className="mt-4 px-6 py-3 rounded-xl bg-white text-black font-semibold inline-flex items-center gap-2"
          >
            <X className="size-5" /> Затвори
          </button>
        </div>
      )}
    </div>
  );
}
