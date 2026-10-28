export const JOB_STATUSES = [
  { value: "quoted", label: "Quoted" },
  { value: "booked", label: "Booked" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number]["value"];

// full class names written out so Tailwind can see them
export const STATUS_TEXT_CLASS: Record<string, string> = {
  quoted: "text-quote",
  booked: "text-cal",
  in_progress: "text-todo",
  done: "text-invoice",
};

export function statusLabel(status: string) {
  return JOB_STATUSES.find((s) => s.value === status)?.label ?? status;
}
