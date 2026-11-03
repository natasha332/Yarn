"use client";

import { useMemo, useState } from "react";
import {
  CabinetInput, CabinetType, DEFAULTS, LayoutShape, Room,
  buildDesign, cutListSummary,
} from "@/lib/kitchen";
import PlanView from "@/components/PlanView";
import ElevationView from "@/components/ElevationView";

const TYPES = Object.keys(DEFAULTS) as CabinetType[];
let n = 0;
const mk = (type: CabinetType, width?: number): CabinetInput => {
  const d = DEFAULTS[type];
  return { id: `c${++n}`, label: d.label, type, width: width ?? d.width, height: d.height, depth: d.depth };
};

const input = "w-full rounded-lg border border-neutral-300 px-3 py-3 text-lg";

export default function Home() {
  const [room, setRoom] = useState<Room>({ width: 3600, depth: 3000, height: 2400 });
  const [shape, setShape] = useState<LayoutShape>("l-shape");
  const [cabs, setCabs] = useState<CabinetInput[]>(() => [
    mk("fridge"), mk("tall"), mk("base", 600), mk("base", 800), mk("cooktop"),
    mk("sink"), mk("dishwasher"), mk("base", 450),
    mk("wall", 600), mk("wall", 600), mk("wall", 900), mk("wall", 800),
  ]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = cabs.find((c) => c.id === selectedId) ?? null;
  const design = useMemo(() => buildDesign({ room, shape, cabinets: cabs }), [room, shape, cabs]);
  const update = (id: string, patch: Partial<CabinetInput>) =>
    setCabs((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const num = (v: string) => Math.max(0, Number(v) || 0);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 pb-64">
      <h1 className="text-2xl font-bold">Kitchen Designer</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">1. Room (mm)</h2>
        <div className="grid grid-cols-3 gap-2">
          {(["width", "depth", "height"] as const).map((k) => (
            <label key={k} className="text-sm capitalize">
              {k === "width" ? "Back wall" : k === "depth" ? "Side wall" : "Ceiling"}
              <input className={input} inputMode="numeric" value={room[k]} onChange={(e) => setRoom({ ...room, [k]: num(e.target.value) })} />
            </label>
          ))}
        </div>
        <label className="block text-sm">
          Layout
          <select className={input} value={shape} onChange={(e) => setShape(e.target.value as LayoutShape)}>
            <option value="straight">Straight (back wall only)</option>
            <option value="l-shape">L-shape (back + right wall)</option>
            <option value="u-shape">U-shape (back + both sides)</option>
          </select>
        </label>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">2. Cupboards (mm)</h2>
        {cabs.map((c) => (
          <div key={c.id} onClick={() => setSelectedId(c.id)} className="grid grid-cols-[1fr_1fr_1fr_3rem] items-end gap-2 rounded-lg border p-2">
            <label className="col-span-4 text-xs">
              <select className={input} value={c.type} onChange={(e) => { const t = e.target.value as CabinetType; const d = DEFAULTS[t]; update(c.id, { type: t, label: d.label, height: d.height, depth: d.depth }); }}>
                {TYPES.map((t) => <option key={t} value={t}>{DEFAULTS[t].label}</option>)}
              </select>
            </label>
            {(["width", "height", "depth"] as const).map((k) => (
              <label key={k} className="text-xs capitalize">{k[0].toUpperCase()}
                <input className={input} inputMode="numeric" value={c[k]} onChange={(e) => update(c.id, { [k]: num(e.target.value) })} />
              </label>
            ))}
            <button className="h-12 rounded-lg bg-red-100 text-xl" aria-label="Remove" onClick={() => setCabs((cs) => cs.filter((x) => x.id !== c.id))}>×</button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <button key={t} className="rounded-lg bg-neutral-900 px-3 py-3 text-white" onClick={() => setCabs((cs) => [...cs, mk(t)])}>+ {DEFAULTS[t].label}</button>
          ))}
        </div>
      </section>

      {design.warnings.length > 0 && (
        <section className="rounded-lg border border-amber-400 bg-amber-50 p-3">
          <h2 className="font-semibold">Check these</h2>
          <ul className="list-disc pl-5">{design.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">3. Plan <span className="text-sm font-normal text-neutral-500">(tap a cupboard to edit it)</span></h2>
        <PlanView room={room} design={design} selectedId={selectedId} onSelect={setSelectedId} />
        <p className="text-sm text-neutral-500">Dashed outlines are wall cupboards above.</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">4. Elevations</h2>
        {design.runs.map((r) => <ElevationView key={r.name} run={r} room={room} selectedId={selectedId} onSelect={setSelectedId} />)}
      </section>

      <section>
        <h2 className="text-lg font-semibold">5. Schedule</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-left"><th>Wall</th><th>Item</th><th>W×H×D</th></tr></thead>
          <tbody>
            {cutListSummary(design).map((l, i) => (
              <tr key={i} className="border-t"><td>{l.run}</td><td>{l.label}</td><td>{l.w}×{l.h}×{l.d}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
      {selected && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t-2 border-rose-600 bg-white p-3 shadow-2xl">
          <div className="mx-auto max-w-3xl space-y-2">
            <div className="flex items-center gap-2">
              <input className={input} value={selected.label} onChange={(e) => update(selected.id, { label: e.target.value })} aria-label="Name" />
              <select className={input + " w-auto"} value={selected.type} onChange={(e) => { const t = e.target.value as CabinetType; const d = DEFAULTS[t]; update(selected.id, { type: t, label: d.label, height: d.height, depth: d.depth }); }}>
                {TYPES.map((t) => <option key={t} value={t}>{DEFAULTS[t].label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(["width", "height", "depth"] as const).map((k) => (
                <label key={k} className="text-xs capitalize">{k}
                  <input className={input} inputMode="numeric" value={selected[k]} onChange={(e) => update(selected.id, { [k]: num(e.target.value) })} />
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button className="h-12 flex-1 rounded-lg bg-neutral-900 text-white" onClick={() => setSelectedId(null)}>Done</button>
              <button className="h-12 rounded-lg bg-red-100 px-4" onClick={() => { setCabs((cs) => cs.filter((x) => x.id !== selected.id)); setSelectedId(null); }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
