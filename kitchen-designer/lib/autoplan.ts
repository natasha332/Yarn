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

export function autoPlan(room: Room, shape: LayoutShape, a: Appliances): CabinetInput[] {
  seq = 0;
  const fridge = make("fridge", a.fridge.width, "Fridge space", a.fridge.height);

  const pantry = a.pantryTower ? make("tall", 600, "Pantry tower") : null;
  const tower = a.oven.style === "tower" ? make("tall", Math.max(600, a.oven.width), "Oven tower") : null;
  const underOven = a.oven.style === "under-bench" ? make("oven", Math.max(600, a.oven.width)) : null;
  const cooktop = make("cooktop", Math.max(600, a.cooktop.width));
  const sink = make("sink", 900);
  const dw = make("dishwasher", a.dishwasher.width);

  // Work out total wall length, using the same runs the layout will use
  const cabsForDepth = [cooktop, sink, dw];
  const runs = runDefs(shape, room, cornerDepthFor(cabsForDepth));
  const total = runs.reduce((n, r) => n + r.length, 0);

  const tallStart = [fridge, pantry, tower].filter(Boolean) as CabinetInput[];
  const mid = [cooktop, underOven].filter(Boolean) as CabinetInput[];
  const end = [sink, dw];
  const fixed = [...tallStart, ...mid, ...end].reduce((n, c) => n + c.width, 0);
  const free = Math.max(0, total - fixed);

  // Share spare space: a landing beside the cooktop, a gap between cooktop and sink, then the rest
  const gapA = free >= 1200 ? 300 : 0; // landing beside the tall units
  const gapB = Math.round((free - gapA) * 0.5 / 5) * 5; // between cooktop and sink
  const gapC = free - gapA - gapB;

  const seqList: (CabinetInput | { fill: number })[] = [
    ...tallStart,
    { fill: gapA },
    ...mid,
    { fill: gapB },
    ...end,
    { fill: gapC },
  ];

  // Walk along the runs so no cupboard straddles a corner
  const out: CabinetInput[] = [];
  let ri = 0;
  let used = 0;
  const space = () => (runs[ri] ? runs[ri].length - used : 0);
  for (const item of seqList) {
    if ("fill" in item) {
      let n = item.fill;
      while (n > 0 && ri < runs.length) {
        const take = Math.min(n, space());
        if (take >= 300) { out.push(...fillCabs(take)); used += take; n -= take; }
        if (n > 0) { ri++; used = 0; }
        else break;
      }
    } else {
      while (ri < runs.length && used + item.width > runs[ri].length) {
        // use up the rest of this run with ordinary cupboards, then move on
        const gap = space();
        if (gap >= 300) out.push(...fillCabs(gap));
        ri++; used = 0;
      }
      out.push(item);
      used += item.width;
    }
  }

  // Wall cupboards: build design to see where everything landed, then fill the free spans
  const hood = make("rangehood", a.rangehood.width);
  const floorOnly = [...out, hood];
  const d = buildDesign({ room, shape, cabinets: floorOnly });
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
