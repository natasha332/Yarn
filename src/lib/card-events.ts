// Tells the rest of the screen when cards have been dealt with (confirmed, discarded),
// so the Talk screen can stop saying "check them below" about cards that are gone.
export const CARDS_HANDLED = "yarn-cards-handled";

export function announceCardsHandled(ids: string[]) {
  window.dispatchEvent(new CustomEvent(CARDS_HANDLED, { detail: { ids } }));
}
