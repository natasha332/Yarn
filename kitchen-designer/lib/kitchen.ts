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
  | "wall";

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
  base: Placed[];
  wall: Placed[];
  fillers: Filler[];
}

export interface Design {
  runs: Run[];
  warnings: string[];
}

// Standard heights (mm) used by Australian cabinet makers
export const KICK = 150;
export const BENCHTOP = 40;
export const WALL_CAB_BOTTOM = 1450;

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
  wall: { label: "Wall cupboard", height: 720, depth: 320, width: 600 },
};

export const isFloorUnit = (t: CabinetType) => t !== "wall";
export const isTall = (t: CabinetType) => t === "fridge" || t === "tall";

const ORDER: Record<CabinetType, number> = {
  fridge: 0,
  tall: 1,
  base: 2,
  dishwasher: 3,
  sink: 4,
  cooktop: 5,
  wall: 9,
};

function runDefs(shape: LayoutShape, room: Room, cornerDepth: number) {
  const defs: { name: RunName; start: number; length: number }[] = [];
  if (shape === "straight") {
    defs.push({ name: "Back wall", start: 0, length: room.width });
  } else if (shape === "l-shape") {
    defs.push({ name: "Back wall", start: 0, length: room.width });
    defs.push({
      name: "Right wall",
      start: cornerDepth,
      length: room.depth - cornerDepth,
    });
  } else {
    defs.push({
      name: "Back wall",
      start: cornerDepth,
      length: room.width - cornerDepth * 2,
    });
    defs.push({
      name: "Right wall",
      start: cornerDepth,
      length: room.depth - cornerDepth,
    });
    defs.push({
      name: "Left wall",
      start: cornerDepth,
      length: room.depth - cornerDepth,
    });
  }
  return defs;
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

  const floor = req.cabinets
    .filter((c) => isFloorUnit(c.type))
    .sort((a, b) => ORDER[a.type] - ORDER[b.type]);
  const wall = req.cabinets.filter((c) => c.type === "wall");

  const cornerDepth = Math.max(
    575,
    ...floor.filter((c) => !isTall(c.type)).map((c) => c.depth),
  );
  const defs = runDefs(shape, room, cornerDepth);

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

  // --- Wall cupboards: sit above the base run, never above tall units
  let wi = 0;
  const wUsed = runs.map(() => 0);
  const blocked = (run: Run, from: number, to: number) =>
    run.base.some(
      (p) => isTall(p.cabinet.type) && from < p.offset + p.cabinet.width && to > p.offset,
    );

  for (const c of wall) {
    let placed = false;
    while (wi < runs.length && !placed) {
      const run = runs[wi];
      // jump past tall units
      let pos = wUsed[wi];
      let moved = true;
      while (moved) {
        moved = false;
        for (const p of run.base) {
          if (
            isTall(p.cabinet.type) &&
            pos < p.offset + p.cabinet.width &&
            pos + c.width > p.offset
          ) {
            pos = p.offset + p.cabinet.width;
            moved = true;
          }
        }
      }
      if (pos + c.width <= run.length && !blocked(run, pos, pos + c.width)) {
        run.wall.push({
          cabinet: c,
          run: run.name,
          offset: pos,
          ...toPlan(run.name, pos, run.start, c, room),
        });
        wUsed[wi] = pos + c.width;
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
      : WALL_CAB_BOTTOM + c.height;
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

  return { runs, warnings };
}

export function cutListSummary(design: Design) {
  const lines: { run: string; label: string; type: CabinetType; w: number; h: number; d: number }[] = [];
  for (const r of design.runs)
    for (const p of [...r.base, ...r.wall])
      lines.push({
        run: r.name,
        label: p.cabinet.label,
        type: p.cabinet.type,
        w: p.cabinet.width,
        h: p.cabinet.height,
        d: p.cabinet.depth,
      });
  return lines;
}
