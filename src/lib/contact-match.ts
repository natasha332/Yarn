// A safety net for the sorter: if a to-do, follow-up, booking or note names exactly one business contact
// ("Email the accountant about the BAS", "Meeting with Kim"), link it to them even when the AI forgot to.
// It looks for the contact's name, first name, a nickname or their role as whole words.

export type ContactLite = {
  id: string;
  name: string;
  aliases: string[] | null;
  role: string | null;
};

const clean = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const has = (text: string, phrase: string) =>
  phrase.length >= 3 && ` ${text} `.includes(` ${phrase} `);

export function matchContact(
  text: string,
  contacts: ContactLite[],
): string | null {
  const t = clean(text);
  if (!t) return null;
  const hits = contacts.filter((c) => {
    const names = [
      c.name,
      c.name.split(/\s+/)[0],
      ...(c.aliases ?? []),
      c.role ?? "",
    ];
    return names.map(clean).some((n) => has(t, n));
  });
  return hits.length === 1 ? hits[0].id : null;
}
