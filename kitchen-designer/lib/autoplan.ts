// Auto-planner: you give it the room and the appliance sizes, it works out
// which cupboards go where, using the same rules a joiner would.
import {
  CabinetInput, CabinetType, DEFAULTS, LayoutShape, Room,
  buildDesign, cornerDepthFor, runDefs, isTall,
} from "./kitchen";

export interface Appliances {
  fridge: { width: number; height: number };
  oven: { width: number; style: "tower" | "under-bench" };
  cooktop: { width: number };
  rangehood: { width: number };
  dishwasher: { width: number };
  pantryTower: boolean;
}

export const DEFAULT_APPLIANCES: Appliances = {
  fridge: { width: 900, height: 1800 },
  oven: { width: 600, style: "tower" },
  cooktop: { width: 900 },
  rangehood: { width: 900 },
  dishwasher: { width: 600 },
  pantryTower: true,
};

let seq = 0;
const make = (type: CabinetType, width: number, label?: string, height?: number): CabinetInput => {
  const d = DEFAULTS[type];
  return { id: `a${++seq}`, label: label ?? d.label, type, width, height: height ?? d.height, depth: d.depth };
};

// Split a gap into equal cupboards between 300 and 900mm wide
function fillCabs(gap: number): CabinetInput[] {
  if (gap < 300) return [];
  const n = Math.ceil(gap / 900);
  const w = Math.floor(gap / n / 5) * 5;
  return Array.from({ length: n }, (_, i) =>
    make("base", i === n - 1 ? gap - w * (n - 1) : w, n === 1 && w <= 600 ? "Base cupboard" : "Drawer base"),
  );
}

export function autoPlan(room: Room, shape: LayoutShape, a: Appliances, cornerSize = 0): CabinetInput[] {
  seq = 0;
  const fridge = make("fridge", a.fridge.width, "Fridge space", a.fridge.height);

  const pantry = a.pantryTower ? make("tall", 600, "Pantry tower") : null;
  const tower = a.oven.style === "tower" ? make("tall", Math.max(600, a.oven.width), "Oven tower") : null;
  const underOven = a.oven.style === "under-bench" ? make("oven", Math.max(600, a.oven.width)) : null;
  const cooktop = make("cooktop", Math.max(600, a.cooktop.width));
  const sink = make("sink", 900);
  const dw = make("dishwasher", a.dishwasher.width);

  // Work out total wall length, using the same runs the layout will use
  const runs = runDefs(shape, room, cornerDepthFor([cooktop, sink, dw]), cornerSize);

  const items = [fridge, pantry, tower, cooktop, underOven, sink, dw].filter(Boolean) as CabinetInput[];

  // 1. Share the appliances out along the runs (nothing straddles a corner)
  const perRun: CabinetInput[][] = runs.map(() => []);
  let ri = 0;
  let used = 0;
  for (const it of items) {
    while (ri < runs.length - 1 && used + it.width > runs[ri].length) { ri++; used = 0; }
    perRun[ri].push(it);
    used += it.width;
  }

  // 2. Spread each run's spare space into 1-3 proper cupboards, never tiny ones.
  //    Preferred spots: between cooktop and sink, beside the cooktop, end of the run.
  const out: CabinetInput[] = [];
  runs.forEach((run, r) => {
    const list = perRun[r];
    const free = run.length - list.reduce((n, c) => n + c.width, 0);
    const k = list.length;
    const ci = list.indexOf(cooktop);
    const si = list.indexOf(sink);
    const prefs: number[] = [];
    if (ci >= 0 && si >= 0) prefs.push(si > ci ? si : ci);
    if (ci >= 0) prefs.push(si > ci || si < 0 ? ci : ci + 1);
    prefs.push(k, 0);
    const slots = prefs.filter((v, i) => prefs.indexOf(v) === i);
    const m = free < 300 ? 0 : Math.max(1, Math.min(slots.length, Math.floor(free / 450), 3));
    const size = new Map<number, number>();
    if (m > 0) {
      const share = Math.floor(free / m / 5) * 5;
      slots.slice(0, m).forEach((slot, i) => size.set(slot, i === m - 1 ? free - share * (m - 1) : share));
    }
    for (let j = 0; j <= k; j++) {
      const w = size.get(j) ?? 0;
      if (w > 0) out.push(...fillCabs(w));
      if (j < k) out.push(list[j]);
    }
  });

  // Wall cupboards: build design to see where everything landed, then fill the free spans
  const hood = make("rangehood", a.rangehood.width);
  const floorOnly = [...out, hood];
  const d = buildDesign({ room, shape, cabinets: floorOnly, cornerSize });
  const wallCabs: CabinetInput[] = [hood];
  for (const run of d.runs) {
    const blocked: [number, number][] = [
      ...run.base.filter((p) => isTall(p.cabinet.type)).map((p) => [p.offset, p.offset + p.cabinet.width] as [number, number]),
      ...run.wall.filter((p) => p.cabinet.type === "rangehood").map((p) => [p.offset, p.offset + p.cabinet.width] as [number, number]),
    ].sort((x, y) => x[0] - y[0]);
    let pos = 0;
    const spans: number[] = [];
    for (const [from, to] of blocked) { if (from > pos) spans.push(from - pos); pos = Math.max(pos, to); }
    if (pos < run.length) spans.push(run.length - pos);
    // only above runs that actually have base cupboards
    if (run.base.length === 0) continue;
    for (const sp of spans) {
      const n = Math.ceil(sp / 900);
      if (sp < 300) continue;
      const w = Math.floor(sp / n / 5) * 5;
      for (let i = 0; i < n; i++) wallCabs.push(make("wall", i === n - 1 ? sp - w * (n - 1) : w));
    }
  }
  return [...out, ...wallCabs];
}
