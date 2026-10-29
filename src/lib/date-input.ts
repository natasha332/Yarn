// Typing a date the Australian way: day, month, year ("05/11/2026").
// The phone's own date box follows the phone's region, so Yarn has its own.

// Whatever was typed or pasted -> neat "DD/MM/YYYY" as far as it goes. Slashes are added for you,
// which matters because a phone's number pad has no slash key.
export function formatTyping(raw: string): string {
  const pasted = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (pasted)
    return `${pasted[1].padStart(2, "0")}/${pasted[2].padStart(2, "0")}/${pasted[3]}`;

  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

// "05/11/2026" -> "2026-11-05", or null if it isn't a real date.
export function parseDate(text: string): string | null {
  const m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (year < 2000 || year > 2099 || month < 1 || month > 12 || day < 1)
    return null;
  const check = new Date(Date.UTC(year, month - 1, day));
  // 31/02 rolls over into March: not a real date
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  )
    return null;
  return check.toISOString().slice(0, 10);
}

// "2026-11-05" -> "05/11/2026"
export function toDisplay(iso: string): string {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : "";
}
