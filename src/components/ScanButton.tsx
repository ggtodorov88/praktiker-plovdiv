import { useCallback, useEffect, useRef, useState } from "react";
import { ScanLine, X, Zap, ZapOff, ZoomIn, ZoomOut, Loader2 } from "lucide-react";
import * as ZXingNs from "@zxing/library";
const ZXingPkg = ((ZXingNs as unknown as { default?: typeof ZXingNs }).default ??
  ZXingNs) as typeof import("@zxing/library");
const {
  BarcodeFormat,
  DecodeHintType,
  MultiFormatReader,
  RGBLuminanceSource,
  HybridBinarizer,
  BinaryBitmap,
} = ZXingPkg;

type Props = {
  onResult: (code: string) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
};

const TARGET_FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "qr_code",
];

const ZXING_FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.QR_CODE,
];

const SCAN_INTERVAL_MS = 150;

function normalize(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 6 ? digits : raw.trim();
}

export function ScanButton({ onResult, disabled, className, label = "Сканирай баркод" }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string>("Насочи камерата към баркода");
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [zoomSupported, setZoomSupported] = useState(false);
  const [zoomedIn, setZoomedIn] = useState(false);
  const [starting, setStarting] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastScanRef = useRef(0);
  const detectorRef = useRef<any>(null);
  const zxingRef = useRef<InstanceType<typeof MultiFormatReader> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stoppedRef = useRef(false);
  const zoomRangeRef = useRef<{ min: number; max: number; base: number } | null>(null);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    trackRef.current = null;
    zoomRangeRef.current = null;
    setTorchOn(false);
    setZoomedIn(false);
    setTorchSupported(false);
    setZoomSupported(false);
  }, []);

  const close = useCallback(() => {
    stop();
    setOpen(false);
    setError(null);
  }, [stop]);

  const handleHit = useCallback(
    (raw: string) => {
      const code = normalize(raw);
      if (!code) return;
      try {
        if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(60);
      } catch {}
      stop();
      setOpen(false);
      onResult(code);
    },
    [onResult, stop],
  );

  const toggleTorch = useCallback(async () => {
    const track = trackRef.current;
    if (!track) return;
    try {
      const next = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: next } as any] });
      setTorchOn(next);
    } catch {
      setTorchSupported(false);
    }
  }, [torchOn]);

  const toggleZoom = useCallback(async () => {
    const track = trackRef.current;
    const range = zoomRangeRef.current;
    if (!track || !range) return;
    try {
      const next = !zoomedIn;
      const target = next ? Math.min(range.base * 2, range.max) : range.base;
      await track.applyConstraints({ advanced: [{ zoom: target } as any] });
      setZoomedIn(next);
    } catch {
      setZoomSupported(false);
    }
  }, [zoomedIn]);

  // start camera & decode loop
  useEffect(() => {
    if (!open) return;
    stoppedRef.current = false;
    setError(null);
    setStarting(true);

    let cancelled = false;

    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Камерата не се поддържа от този браузър.");
        }

        // iOS Safari often returns the front camera with facingMode: "ideal".
        // Use exact first; if it fails, enumerate devices and pick a back camera explicitly.
        let stream: MediaStream | null = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { exact: "environment" },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            audio: false,
          });
        } catch {
          // Prime permissions so device labels become available
          try {
            const tmp = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            tmp.getTracks().forEach((t) => t.stop());
          } catch {}
          let deviceId: string | undefined;
          try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const cams = devices.filter((d) => d.kind === "videoinput");
            const back = cams.find((d) => /back|rear|environment|задн/i.test(d.label));
            // On iOS the last camera is usually the back one when labels are missing
            deviceId = (back ?? cams[cams.length - 1])?.deviceId;
          } catch {}
          stream = await navigator.mediaDevices.getUserMedia({
            video: deviceId
              ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
              : { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
            audio: false,
          });
        }
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        trackRef.current = track;

        // Try continuous focus
        try {
          await track.applyConstraints({
            advanced: [{ focusMode: "continuous" } as any],
          });
        } catch {}

        // Capabilities for torch / zoom
        try {
          const caps: any =
            typeof track.getCapabilities === "function" ? track.getCapabilities() : {};
          if (caps?.torch) setTorchSupported(true);
          if (caps?.zoom && typeof caps.zoom.max === "number") {
            const settings: any =
              typeof track.getSettings === "function" ? track.getSettings() : {};
            const base = typeof settings.zoom === "number" ? settings.zoom : caps.zoom.min ?? 1;
            zoomRangeRef.current = { min: caps.zoom.min ?? 1, max: caps.zoom.max, base };
            setZoomSupported(true);
          }
        } catch {}

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        video.muted = true;
        await video.play().catch(() => {});

        // Init decoders
        const W: any = window as any;
        if (W.BarcodeDetector) {
          try {
            const supported: string[] = (await W.BarcodeDetector.getSupportedFormats?.()) ?? [];
            const formats = TARGET_FORMATS.filter((f) =>
              supported.length ? supported.includes(f) : true,
            );
            detectorRef.current = new W.BarcodeDetector({
              formats: formats.length ? formats : TARGET_FORMATS,
            });
          } catch {
            detectorRef.current = null;
          }
        }

        if (!detectorRef.current) {
          const reader = new MultiFormatReader();
          const hints = new Map();
          hints.set(DecodeHintType.POSSIBLE_FORMATS, ZXING_FORMATS);
          hints.set(DecodeHintType.TRY_HARDER, true);
          reader.setHints(hints);
          zxingRef.current = reader;
        }

        canvasRef.current = document.createElement("canvas");
        setStarting(false);
        loop();
      } catch (e: any) {
        if (cancelled) return;
        setStarting(false);
        const msg =
          e?.name === "NotAllowedError"
            ? "Достъпът до камерата е отказан."
            : e?.message || "Неуспешно стартиране на камерата.";
        setError(msg);
      }
    };

    const loop = () => {
      if (stoppedRef.current) return;
      rafRef.current = requestAnimationFrame(async () => {
        const now = performance.now();
        if (now - lastScanRef.current < SCAN_INTERVAL_MS) {
          loop();
          return;
        }
        lastScanRef.current = now;

        const video = videoRef.current;
        if (!video || video.readyState < 2 || video.videoWidth === 0) {
          loop();
          return;
        }

        try {
          // Native BarcodeDetector — pass the video directly (no cropping)
          if (detectorRef.current) {
            const results = await detectorRef.current.detect(video);
            if (results && results.length > 0) {
              const val = results[0].rawValue || results[0].rawValue?.toString();
              if (val) {
                handleHit(val);
                return;
              }
            }
          } else if (zxingRef.current) {
            const canvas = canvasRef.current!;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const luminances = new Uint8ClampedArray(canvas.width * canvas.height);
            const data = img.data;
            for (let i = 0, j = 0; i < data.length; i += 4, j++) {
              luminances[j] = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
            }
            const source = new RGBLuminanceSource(
              luminances as unknown as Uint8ClampedArray,
              canvas.width,
              canvas.height,
            );
            const bitmap = new BinaryBitmap(new HybridBinarizer(source));
            try {
              const result = zxingRef.current.decode(bitmap);
              const txt = result?.getText?.();
              if (txt) {
                handleHit(txt);
                return;
              }
            } catch {
              // not found this frame
            } finally {
              try {
                zxingRef.current.reset();
              } catch {}
            }
          }
        } catch {
          // ignore frame errors
        }

        setHint("Дръж устройството стабилно близо до баркода");
        loop();
      });
    };

    start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [open, handleHit, stop]);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={
          "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-50 " +
          (className ?? "")
        }
        style={{ background: "var(--gradient-brand)" }}
      >
        <ScanLine className="size-5" />
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black">
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            playsInline
            muted
          />

          {/* Targeting overlay (visual only) */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-[36%] w-[82%] max-w-md rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
              <span className="absolute -left-0.5 -top-0.5 size-6 rounded-tl-2xl border-l-4 border-t-4 border-white" />
              <span className="absolute -right-0.5 -top-0.5 size-6 rounded-tr-2xl border-r-4 border-t-4 border-white" />
              <span className="absolute -bottom-0.5 -left-0.5 size-6 rounded-bl-2xl border-b-4 border-l-4 border-white" />
              <span className="absolute -bottom-0.5 -right-0.5 size-6 rounded-br-2xl border-b-4 border-r-4 border-white" />
            </div>
          </div>

          {/* Top bar */}
          <div className="absolute left-0 right-0 top-0 flex items-center justify-between p-3">
            <button
              type="button"
              onClick={close}
              aria-label="Затвори"
              className="inline-flex size-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm"
            >
              <X className="size-5" />
            </button>
            <div className="flex gap-2">
              {zoomSupported && (
                <button
                  type="button"
                  onClick={toggleZoom}
                  aria-label="Zoom"
                  className="inline-flex size-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm"
                >
                  {zoomedIn ? <ZoomOut className="size-5" /> : <ZoomIn className="size-5" />}
                </button>
              )}
              {torchSupported && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  aria-label="Фенерче"
                  className="inline-flex size-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm"
                >
                  {torchOn ? <ZapOff className="size-5" /> : <Zap className="size-5" />}
                </button>
              )}
            </div>
          </div>

          {/* Bottom hint / status */}
          <div className="absolute bottom-6 left-0 right-0 flex justify-center px-4">
            <div className="rounded-full bg-black/60 px-4 py-2 text-sm text-white backdrop-blur-sm">
              {error ? error : starting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" /> Стартиране на камерата…
                </span>
              ) : (
                hint
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ScanButton;
