"use client";

import { useMemo, useState } from "react";
import {
  CabinetInput, CabinetType, DEFAULTS, LayoutShape, Room,
  buildDesign, cutListSummary,
} from "@/lib/kitchen";
import { Appliances, DEFAULT_APPLIANCES, autoPlan } from "@/lib/autoplan";
import PlanView from "@/components/PlanView";
import ElevationView from "@/components/ElevationView";

const TYPES = Object.keys(DEFAULTS) as CabinetType[];
let n = 0;
const mk = (type: CabinetType): CabinetInput => {
  const d = DEFAULTS[type];
  return { id: `m${++n}`, label: d.label, type, width: d.width, height: d.height, depth: d.depth };
};

const input = "w-full rounded-lg border border-neutral-300 bg-white px-3 py-3 text-lg";
const num = (v: string) => Math.max(0, Number(v) || 0);

export default function Home() {
  const [room, setRoom] = useState<Room>({ width: 4200, depth: 3200, height: 2400 });
  const [shape, setShape] = useState<LayoutShape>("l-shape");
  const [corners, setCorners] = useState(true);
  const [cornerSize, setCornerSize] = useState(900);
  const [app, setApp] = useState<Appliances>(DEFAULT_APPLIANCES);
  const cs = corners && shape !== "straight" ? cornerSize : 0;

  const [cabs, setCabs] = useState<CabinetInput[]>(() =>
    autoPlan({ width: 4200, depth: 3200, height: 2400 }, "l-shape", DEFAULT_APPLIANCES, 900),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = cabs.find((c) => c.id === selectedId) ?? null;

  const design = useMemo(
    () => buildDesign({ room, shape, cabinets: cabs, cornerSize: cs }),
    [room, shape, cabs, cs],
  );
  const redesign = () => { setCabs(autoPlan(room, shape, app, cs)); setSelectedId(null); };
  const update = (id: string, patch: Partial<CabinetInput>) =>
    setCabs((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const changeType = (id: string, t: CabinetType) => {
    const d = DEFAULTS[t];
    update(id, { type: t, label: d.label, height: d.height, depth: d.depth });
  };

  return (
    <div className="min-h-screen bg-neutral-50 lg:grid lg:grid-cols-[440px_1fr]">
      {/* LEFT: details */}
      <aside className="space-y-6 border-r bg-white p-4 pb-16 lg:h-screen lg:overflow-y-auto">
        <h1 className="text-2xl font-bold">Kitchen Designer</h1>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">1. Room (mm)</h2>
          <div className="grid grid-cols-3 gap-2">
            {(["width", "depth", "height"] as const).map((k) => (
              <label key={k} className="text-sm">
                {k === "width" ? "Back wall" : k === "depth" ? "Side wall" : "Ceiling"}
                <input className={input} inputMode="numeric" value={room[k]} onChange={(e) => setRoom({ ...room, [k]: num(e.target.value) })} />
              </label>
            ))}
          </div>
          <label className="block text-sm">Layout
            <select className={input} value={shape} onChange={(e) => setShape(e.target.value as LayoutShape)}>
              <option value="straight">Straight (back wall only)</option>
              <option value="l-shape">L-shape (back + right wall)</option>
              <option value="u-shape">U-shape (back + both sides)</option>
            </select>
          </label>
          {shape !== "straight" && (
            <div className="grid grid-cols-2 items-end gap-2">
              <label className="flex items-center gap-2 pb-3 text-sm">
                <input type="checkbox" className="h-6 w-6" checked={corners} onChange={(e) => setCorners(e.target.checked)} /> Corner cupboards
              </label>
              {corners && (
                <label className="text-sm">Corner size
                  <input className={input} inputMode="numeric" value={cornerSize} onChange={(e) => setCornerSize(num(e.target.value))} />
                </label>
              )}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">2. Appliances (mm)</h2>
          <p className="text-sm text-neutral-500">Enter the opening size each appliance needs. The program chooses the other cupboards.</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm">Fridge width
              <input className={input} inputMode="numeric" value={app.fridge.width} onChange={(e) => setApp({ ...app, fridge: { ...app.fridge, width: num(e.target.value) } })} /></label>
            <label className="text-sm">Fridge height
              <input className={input} inputMode="numeric" value={app.fridge.height} onChange={(e) => setApp({ ...app, fridge: { ...app.fridge, height: num(e.target.value) } })} /></label>
            <label className="text-sm">Oven width
              <input className={input} inputMode="numeric" value={app.oven.width} onChange={(e) => setApp({ ...app, oven: { ...app.oven, width: num(e.target.value) } })} /></label>
            <label className="text-sm">Oven position
              <select className={input} value={app.oven.style} onChange={(e) => setApp({ ...app, oven: { ...app.oven, style: e.target.value as "tower" | "under-bench" } })}>
                <option value="tower">In a tall tower</option>
                <option value="under-bench">Under the bench</option>
              </select></label>
            <label className="text-sm">Cooktop width
              <input className={input} inputMode="numeric" value={app.cooktop.width} onChange={(e) => setApp({ ...app, cooktop: { width: num(e.target.value) } })} /></label>
            <label className="text-sm">Rangehood width
              <input className={input} inputMode="numeric" value={app.rangehood.width} onChange={(e) => setApp({ ...app, rangehood: { width: num(e.target.value) } })} /></label>
            <label className="text-sm">Dishwasher width
              <input className={input} inputMode="numeric" value={app.dishwasher.width} onChange={(e) => setApp({ ...app, dishwasher: { width: num(e.target.value) } })} /></label>
            <label className="flex items-center gap-2 pt-6 text-sm">
              <input type="checkbox" className="h-6 w-6" checked={app.pantryTower} onChange={(e) => setApp({ ...app, pantryTower: e.target.checked })} /> Add a pantry tower
            </label>
          </div>
          <button className="h-14 w-full rounded-lg bg-rose-600 text-lg font-semibold text-white" onClick={redesign}>Design my kitchen</button>
        </section>

        {selected && (
          <section className="space-y-2 rounded-lg border-2 border-rose-600 p-3">
            <h2 className="font-semibold">Editing: {selected.label}</h2>
            <input className={input} value={selected.label} onChange={(e) => update(selected.id, { label: e.target.value })} aria-label="Name" />
            <select className={input} value={selected.type} onChange={(e) => changeType(selected.id, e.target.value as CabinetType)}>
              {TYPES.map((t) => <option key={t} value={t}>{DEFAULTS[t].label}</option>)}
            </select>
            <div className="grid grid-cols-3 gap-2">
              {(["width", "height", "depth"] as const).map((k) => (
                <label key={k} className="text-xs capitalize">{k}
                  <input className={input} inputMode="numeric" value={selected[k]} onChange={(e) => update(selected.id, { [k]: num(e.target.value) })} />
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button className="h-12 flex-1 rounded-lg bg-neutral-900 text-white" onClick={() => setSelectedId(null)}>Done</button>
              <button className="h-12 rounded-lg bg-red-100 px-4" onClick={() => { setCabs((l) => l.filter((x) => x.id !== selected.id)); setSelectedId(null); }}>Delete</button>
            </div>
          </section>
        )}

        {design.warnings.length > 0 && (
          <section className="rounded-lg border border-amber-400 bg-amber-50 p-3">
            <h2 className="font-semibold">Check these</h2>
            <ul className="list-disc pl-5 text-sm">{design.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
          </section>
        )}

        <section>
          <h2 className="mb-1 text-lg font-semibold">3. Cupboard schedule <span className="text-sm font-normal text-neutral-500">(tap a row to edit)</span></h2>
          <table className="w-full text-sm">
            <thead><tr className="text-left"><th>Wall</th><th>Item</th><th>W×H×D</th></tr></thead>
            <tbody>
              {design.corners.map((c, i) => (
                <tr key={`c${i}`} className="border-t"><td>Corner</td><td>Corner cupboard</td><td>{c.size}×720×{c.size}</td></tr>
              ))}
              {cutListSummary(design).map((l) => (
                <tr key={l.id} className={"cursor-pointer border-t " + (l.id === selectedId ? "bg-rose-50" : "")} onClick={() => setSelectedId(l.id)}>
                  <td className="py-1">{l.run}</td><td>{l.label}</td><td>{l.w}×{l.h}×{l.d}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap gap-2 pt-3">
            {TYPES.map((t) => (
              <button key={t} className="rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white" onClick={() => { const c = mk(t); setCabs((l) => [...l, c]); setSelectedId(c.id); }}>+ {DEFAULTS[t].label}</button>
            ))}
          </div>
        </section>
      </aside>

      {/* RIGHT: drawing */}
      <main className="space-y-6 p-4 pb-16 lg:h-screen lg:overflow-y-auto">
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Plan <span className="text-sm font-normal text-neutral-500">(tap a cupboard to edit it)</span></h2>
          <PlanView room={room} design={design} selectedId={selectedId} onSelect={setSelectedId} />
          <p className="text-sm text-neutral-500">Dashed outlines are wall cupboards above.</p>
        </section>
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Elevations</h2>
          <div className="grid gap-4 xl:grid-cols-2">
            {design.runs.map((r) => <ElevationView key={r.name} run={r} room={room} selectedId={selectedId} onSelect={setSelectedId} />)}
          </div>
        </section>
      </main>
    </div>
  );
}
