export type Paint = {
  code: string;
  name: string;
  description: string;
};

export type PaintsData = {
  updatedAt: string;
  source: string;
  paints: Paint[];
};

export const PAINTS_SOURCE_URL = "https://ad.praktiker.bg/broshuraPraktiker/#page-1";

export const DEFAULT_PAINTS: Paint[] = [
  {
    code: "131460",
    name: "EASYCLEAN MUR MAT 1 L ЛАТЕКСОВА БОЯ ЗА ТОНИРАНЕ LEVIS",
    description: "Безплатно тониране във всички цветове по каталози по RAL, NCS и LEVIS.",
  },
  {
    code: "241071",
    name: "KLARA АКРИЛНА БОЯ БАЗА W ЗА СТЕНИ И ТАВАНИ KLARA",
    description: "Безплатно тониране в 1700 цвята от общо 4206 по каталози RAL, NCS и Levis.",
  },
  {
    code: "129619",
    name: "VITEX VITO Акрилна фасадна боя",
    description:
      "Безплатно тониране в 3540 цвята от общо 4158 по каталози RAL, NCS, VITEX COLORFULL COLLECTION и VITEX GLOBAL COLLECTION.",
  },
  {
    code: "121381",
    name: "VITEX Classic Интериорна боя",
    description:
      "Безплатно тониране в 2069 цвята от общо 2175 по каталози VITEX COLORFULL COLLECTION и VITEX GLOBAL COLLECTION.",
  },
  {
    code: "236069",
    name: "NERRO EXTRA MATT",
    description: "Безплатно тониране в 280 цвята по каталог NERRO COLOR STUDIO 280.",
  },
  {
    code: "239471",
    name: "SPIRIT TRAVERTINO CREATIVE EFFECT",
    description: "Безплатно тониране в 9 цвята по каталог SPIRIT TRAVERTINO EFFECT.",
  },
];

const STORAGE_KEY = "praktiker.paints.v1";
const META_KEY = "praktiker.paints.meta.v1";

export const DEFAULT_UPDATED_AT = "2026-05-10";

export function loadPaints(): Paint[] {
  if (typeof window === "undefined") return DEFAULT_PAINTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PAINTS;
    const parsed = JSON.parse(raw) as Paint[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      const merged = [...parsed];
      for (const paint of DEFAULT_PAINTS) {
        if (!merged.some((p) => p.code === paint.code)) merged.push(paint);
      }
      return merged;
    }
  } catch {}
  return DEFAULT_PAINTS;
}

export function loadUpdatedAt(): string {
  if (typeof window === "undefined") return DEFAULT_UPDATED_AT;
  try {
    return window.localStorage.getItem(META_KEY) || DEFAULT_UPDATED_AT;
  } catch {
    return DEFAULT_UPDATED_AT;
  }
}

export function savePaints(paints: Paint[], updatedAt?: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(paints));
    if (updatedAt) window.localStorage.setItem(META_KEY, updatedAt);
  } catch {}
}

export async function refreshPaints(): Promise<{ paints: Paint[]; updatedAt: string }> {
  const res = await fetch(`/paints.json?ts=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Грешка ${res.status} при опресняване.`);
  const data = (await res.json()) as PaintsData;
  if (!Array.isArray(data.paints)) throw new Error("Невалидни данни.");
  savePaints(data.paints, data.updatedAt);
  return { paints: data.paints, updatedAt: data.updatedAt };
}

export function findTintingInfo(code: string, paints: Paint[] = DEFAULT_PAINTS): string | undefined {
  const m = paints.find((p) => p.code === code);
  return m?.description;
}
