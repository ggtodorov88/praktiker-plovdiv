export type CheckRecord = {
  id?: string;
  code: string;
  name: string;
  imageUrl?: string;
  url?: string;
  inStock: boolean;
  storeNames: string[];
  plovdivStock?: number;
  checkedAt: number;
  note?: string;
  ean?: string;
  brand?: string;
};

const KEY = "praktiker.history.v1";
const MAX = 100;

export function updateNote(idOrCode: string, note: string) {
  if (typeof window === "undefined") return;
  const list = loadHistory().map((r) =>
    r.id === idOrCode || r.code === idOrCode ? { ...r, note } : r,
  );
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function loadHistory(): CheckRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as CheckRecord[];
    return list
      .map((r) => ({ ...r, id: r.id ?? `${r.code}-${r.checkedAt}` }))
      .slice(0, MAX);
  } catch {
    return [];
  }
}

export function saveCheck(rec: CheckRecord) {
  if (typeof window === "undefined") return;
  const list = loadHistory();
  const withId: CheckRecord = {
    ...rec,
    id: rec.id ?? `${rec.code}-${rec.checkedAt}-${Math.random().toString(36).slice(2, 8)}`,
  };
  list.unshift(withId);
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
}

export function clearHistory() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}

export function removeFromHistory(id: string) {
  if (typeof window === "undefined") return;
  const list = loadHistory().filter((r) => r.id !== id);
  localStorage.setItem(KEY, JSON.stringify(list));
}
