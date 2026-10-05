/* What the site keeps in this browser. Every key carries a version, so a
   change to what's stored under it gets a new key instead of misreading old
   data. Reads and writes never throw: private windows and blocked storage
   just mean nothing is remembered. Client components only. */

const PREFIX = "retcalc.";

export function readStored<T>(key: string, version: number): T | null {
  try {
    const raw = localStorage.getItem(`${PREFIX}${key}.v${version}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeStored(key: string, version: number, value: unknown): void {
  try {
    const k = `${PREFIX}${key}.v${version}`;
    if (value == null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(value));
  } catch {
    /* not remembered; the page still works */
  }
}
