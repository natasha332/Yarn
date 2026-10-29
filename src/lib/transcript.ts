// The hint we give the transcriber (see api/transcribe). On a silent recording it sometimes
// reads the hint back instead of hearing nothing, so we spot that and cut it out.
export const PROMPT_INTRO =
  "An Australian tradie talking about jobs, clients, bookings, quotes and invoices.";

const ECHO = /tradie talking about|names that may come up/i;

export function removePromptEcho(text: string) {
  if (!ECHO.test(text)) return text;

  const cleaned = text
    .replace(/context:/gi, " ")
    .replace(/#+/g, " ")
    .replace(
      /An Australian tradie talking about jobs, clients, bookings, quotes and invoices\.?/gi,
      " ",
    )
    .replace(/Names that may come up:[^.]*\.?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Nothing real left once the hint is gone: it was silence.
  return cleaned.split(" ").filter(Boolean).length < 3 ? "" : cleaned;
}
