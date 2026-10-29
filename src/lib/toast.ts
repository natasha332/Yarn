// A short message that pops up at the bottom of the screen ("✓ Cancelled ...").
export const TOAST = "yarn-toast";

export function showToast(message: string) {
  window.dispatchEvent(new CustomEvent(TOAST, { detail: { message } }));
}
