// How a person from the Contacts list is written next to a booking or to-do.
// A client is just their name. A business contact also says what they are: "Sam Lee · Accountant".
export type Person = {
  name: string;
  kind?: string | null;
  role?: string | null;
} | null;

export function personLabel(person: Person | undefined): string | null {
  if (!person?.name) return null;
  if (person.kind !== "contact") return person.name;
  return `${person.name} · ${person.role?.trim() || "Business contact"}`;
}
