// Kitchen layout engine. All measurements are in millimetres.
// The AI step (later) will only ever suggest a Request; this file does the
// maths, so the design always fits the room exactly.

export type CabinetType =
  | "base"
  | "sink"
  | "cooktop"
  | "dishwasher"
  | "fridge"
  | "tall"
  | "oven"
  | "wall"
  | "rangehood";

export type LayoutShape = "straight" | "l-shape" | "u-shape";

export interface Room {
  width: number; // back wall, left to right
  depth: number; // side walls, back to front
  height: number; // floor to ceiling
}

export interface CabinetInput {
  id: string;
  label: string;
  type: CabinetType;
  width: number;
  height: number;
  depth: number;
}

export interface Request {
  room: Room;
  shape: LayoutShape;
  cabinets: CabinetInput[];
  cornerSize?: number; // 0 / undefined = no corner cupboards
}

export interface Corner {
  x: number; // plan-view square, room origin = back-left corner
  y: number;
  size: number;
}

export type RunName = "Back wall" | "Right wall" | "Left wall";

export interface Placed {
  cabinet: CabinetInput;
  run: RunName;
  offset: number; // mm along the run from the run's start
  // plan-view rectangle (mm, room origin = back-left corner)
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Filler {
  run: RunName;
  offset: number;
  width: number;
}

export interface Run {
  name: RunName;
  start: number; // mm from the room corner where usable length begins
  length: number; // usable length
  cornerBefore: number; // size of a corner cupboard just before the run (0 if none)
  cornerAfter: number; // ...and just after it
  base: Placed[];
  wall: Placed[];
  fillers: Filler[];
}

export interface Design {
  runs: Run[];
  corners: Corner[];
  warnings: string[];
}

// Standard heights (mm) used by Australian cabinet makers
export const KICK = 150;
export const BENCHTOP = 40;
export const WALL_CAB_BOTTOM = 1450;
export const HOOD_BOTTOM = 1560; // ~650mm above a 910mm bench

export const DEFAULTS: Record<
  CabinetType,
  { label: string; height: number; depth: number; width: number }
> = {
  base: { label: "Base cupboard", height: 720, depth: 575, width: 600 },
  sink: { label: "Sink base", height: 720, depth: 575, width: 900 },
  cooktop: { label: "Cooktop base", height: 720, depth: 575, width: 900 },
  dishwasher: { label: "Dishwasher", height: 720, depth: 575, width: 600 },
  fridge: { label: "Fridge space", height: 1800, depth: 650, width: 900 },
  tall: { label: "Pantry / oven tower", height: 2100, depth: 575, width: 600 },
  oven: { label: "Under-bench oven", height: 720, depth: 575, width: 600 },
  wall: { label: "Wall cupboard", height: 720, depth: 320, width: 600 },
  rangehood: { label: "Rangehood", height: 500, depth: 500, width: 900 },
};

export const isWallUnit = (t: CabinetType) => t === "wall" || t === "rangehood";
export const isFloorUnit = (t: CabinetType) => !isWallUnit(t);
export const bottomOf = (t: CabinetType) => (t === "rangehood" ? HOOD_BOTTOM : WALL_CAB_BOTTOM);
export const isTall = (t: CabinetType) => t === "fridge" || t === "tall";

export function runDefs(
  shape: LayoutShape,
  room: Room,
  cornerDepth: number,
  cornerSize = 0,
) {
  type Def = { name: RunName; start: number; length: number; cornerBefore: number; cornerAfter: number };
  const defs: Def[] = [];
  const C = cornerSize;
  if (shape === "straight") {
    defs.push({ name: "Back wall", start: 0, length: room.width, cornerBefore: 0, cornerAfter: 0 });
  } else if (shape === "l-shape") {
    if (C > 0) {
      defs.push({ name: "Back wall", start: 0, length: room.width - C, cornerBefore: 0, cornerAfter: C });
      defs.push({ name: "Right wall", start: C, length: room.depth - C, cornerBefore: C, cornerAfter: 0 });
    } else {
      defs.push({ name: "Back wall", start: 0, length: room.width, cornerBefore: 0, cornerAfter: 0 });
      defs.push({ name: "Right wall", start: cornerDepth, length: room.depth - cornerDepth, cornerBefore: 0, cornerAfter: 0 });
    }
  } else {
    const c = C > 0 ? C : cornerDepth;
    defs.push({ name: "Back wall", start: c, length: room.width - c * 2, cornerBefore: C, cornerAfter: C });
    defs.push({ name: "Right wall", start: c, length: room.depth - c, cornerBefore: C, cornerAfter: 0 });
    defs.push({ name: "Left wall", start: c, length: room.depth - c, cornerBefore: C, cornerAfter: 0 });
  }
  return defs;
}

export function cornerDepthFor(cabs: CabinetInput[]) {
  return Math.max(
    575,
    ...cabs.filter((c) => isFloorUnit(c.type) && !isTall(c.type)).map((c) => c.depth),
  );
}

function toPlan(
  run: RunName,
  offset: number,
  start: number,
  c: CabinetInput,
  room: Room,
) {
  const along = start + offset;
  if (run === "Back wall") return { x: along, y: 0, w: c.width, h: c.depth };
  if (run === "Right wall")
    return { x: room.width - c.depth, y: along, w: c.depth, h: c.width };
  return { x: 0, y: along, w: c.depth, h: c.width };
}

export function buildDesign(req: Request): Design {
  const { room, shape } = req;
  const warnings: string[] = [];

  if (room.width < 1000 || room.depth < 1000) {
    warnings.push("Room dimensions look too small — check they are in mm.");
  }

  // Cupboards are placed in the order given (the auto-planner decides the order)
  const floor = req.cabinets.filter((c) => isFloorUnit(c.type));
  const wall = req.cabinets.filter((c) => isWallUnit(c.type));

  const cornerDepth = cornerDepthFor(req.cabinets);
  const defs = runDefs(shape, room, cornerDepth, req.cornerSize ?? 0);

  const runs: Run[] = defs.map((d) => ({
    ...d,
    base: [],
    wall: [],
    fillers: [],
  }));

  // --- Floor units: fill each run in turn
  let ri = 0;
  const used = runs.map(() => 0);
  for (const c of floor) {
    while (ri < runs.length && used[ri] + c.width > runs[ri].length) ri++;
    if (ri >= runs.length) {
      warnings.push(
        `"${c.label}" (${c.width}mm) does not fit — the room has no more wall space.`,
      );
      continue;
    }
    const run = runs[ri];
    run.base.push({
      cabinet: c,
      run: run.name,
      offset: used[ri],
      ...toPlan(run.name, used[ri], run.start, c, room),
    });
    used[ri] += c.width;
  }

  // Fillers for leftover gaps
  runs.forEach((run, i) => {
    const gap = run.length - used[i];
    if (gap > 0 && run.base.length > 0) {
      run.fillers.push({ run: run.name, offset: used[i], width: gap });
      if (gap > 150) {
        warnings.push(
          `${run.name}: ${gap}mm gap at the end. Consider a wider cupboard, or add a ${gap}mm one.`,
        );
      }
    }
  });

  // --- Rangehoods: centred over the cooktop in the same run
  const taken: [number, number][][] = runs.map((r) =>
    r.base.filter((p) => isTall(p.cabinet.type)).map((p) => [p.offset, p.offset + p.cabinet.width]),
  );
  for (const c of wall.filter((c) => c.type === "rangehood")) {
    const ri2 = runs.findIndex((r) => r.base.some((p) => p.cabinet.type === "cooktop"));
    if (ri2 < 0) {
      warnings.push("Rangehood has no cooktop to sit above.");
      continue;
    }
    const run = runs[ri2];
    const ct = run.base.find((p) => p.cabinet.type === "cooktop")!;
    const off = Math.round(ct.offset + (ct.cabinet.width - c.width) / 2);
    run.wall.push({ cabinet: c, run: run.name, offset: off, ...toPlan(run.name, off, run.start, c, room) });
    taken[ri2].push([off, off + c.width]);
  }

  // --- Wall cupboards: first free spot along the run, never above tall units or the hood
  let wi = 0;
  const wPos = runs.map(() => 0);
  for (const c of wall.filter((c) => c.type === "wall")) {
    let placed = false;
    while (wi < runs.length && !placed) {
      const run = runs[wi];
      let pos = wPos[wi];
      let moved = true;
      while (moved) {
        moved = false;
        for (const [from, to] of taken[wi]) {
          if (pos < to && pos + c.width > from) {
            pos = to;
            moved = true;
          }
        }
      }
      if (pos + c.width <= run.length) {
        run.wall.push({ cabinet: c, run: run.name, offset: pos, ...toPlan(run.name, pos, run.start, c, room) });
        wPos[wi] = pos + c.width;
        placed = true;
      } else {
        wi++;
      }
    }
    if (!placed) {
      warnings.push(`Wall cupboard "${c.label}" (${c.width}mm) has no room left.`);
    }
  }

  // --- Height checks
  for (const c of req.cabinets) {
    const top = isFloorUnit(c.type)
      ? isTall(c.type)
        ? c.height
        : KICK + c.height + BENCHTOP
      : bottomOf(c.type) + c.height;
    if (top > room.height) {
      warnings.push(
        `"${c.label}" reaches ${top}mm but the ceiling is ${room.height}mm.`,
      );
    }
  }

  // Walkway between runs on a U-shape
  if (shape === "u-shape") {
    const gap = room.width - cornerDepth * 2;
    if (gap < 1200) {
      warnings.push(`Only ${gap}mm between the side runs — aim for 1200mm+ to work in.`);
    }
  }

  const C = req.cornerSize ?? 0;
  const corners: Corner[] = [];
  if (C > 0 && shape !== "straight") {
    corners.push({ x: room.width - C, y: 0, size: C });
    if (shape === "u-shape") corners.push({ x: 0, y: 0, size: C });
    if (C * 2 > room.width) warnings.push("Corner cupboards are too big for this room.");
  }

  return { runs, corners, warnings };
}

export function cutListSummary(design: Design) {
  const lines: { id: string; run: string; label: string; type: CabinetType; w: number; h: number; d: number }[] = [];
  for (const r of design.runs)
    for (const p of [...r.base, ...r.wall])
      lines.push({
        id: p.cabinet.id,
        run: r.name,
        label: p.cabinet.label,
        type: p.cabinet.type,
        w: p.cabinet.width,
        h: p.cabinet.height,
        d: p.cabinet.depth,
      });
  return lines;
}
