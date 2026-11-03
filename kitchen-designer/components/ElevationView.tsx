import { Run, Room, BENCHTOP, KICK, WALL_CAB_BOTTOM, isTall } from "@/lib/kitchen";

const FILL: Record<string, string> = {
  base: "#e7d3b0",
  sink: "#b9d8e8",
  cooktop: "#f0b8a8",
  dishwasher: "#cfd8dc",
  fridge: "#c5cae9",
  tall: "#d7c0a0",
  wall: "#efe3cc",
};

export default function ElevationView({ run, room }: { run: Run; room: Room }) {
  const H = room.height;
  const floorY = (z: number) => H - z; // z = height above floor
  const pad = 120;
  return (
    <figure>
      <figcaption className="mb-1 font-semibold">
        {run.name} <span className="font-normal text-neutral-500">({run.length}mm usable)</span>
      </figcaption>
      <svg viewBox={`${-pad} ${-pad} ${run.length + pad * 2} ${H + pad * 2}`} className="w-full rounded-lg border bg-white" role="img" aria-label={`${run.name} elevation`}>
        <rect x={0} y={0} width={run.length} height={H} fill="#fafafa" stroke="#333" strokeWidth={14} />
        {run.base.map((p, i) => {
          const c = p.cabinet;
          const tall = isTall(c.type);
          const bodyBottom = tall ? 0 : KICK;
          return (
            <g key={`b${i}`}>
              <rect x={p.offset} y={floorY(bodyBottom + c.height)} width={c.width} height={c.height} fill={FILL[c.type]} stroke="#555" strokeWidth={6} />
              {!tall && <rect x={p.offset} y={floorY(KICK)} width={c.width} height={KICK} fill="#444" />}
              {!tall && <rect x={p.offset} y={floorY(KICK + c.height + BENCHTOP)} width={c.width} height={BENCHTOP} fill="#8d6e63" />}
              <text x={p.offset + c.width / 2} y={floorY(bodyBottom + c.height / 2)} fontSize={Math.min(70, c.width / 5)} textAnchor="middle">{c.width}</text>
            </g>
          );
        })}
        {run.fillers.map((f, i) => (
          <rect key={`f${i}`} x={f.offset} y={floorY(KICK + 720 + BENCHTOP)} width={f.width} height={KICK + 720 + BENCHTOP} fill="#ddd" stroke="#999" strokeDasharray="20 12" strokeWidth={5} />
        ))}
        {run.wall.map((p, i) => (
          <g key={`w${i}`}>
            <rect x={p.offset} y={floorY(WALL_CAB_BOTTOM + p.cabinet.height)} width={p.cabinet.width} height={p.cabinet.height} fill={FILL.wall} stroke="#555" strokeWidth={6} />
            <text x={p.offset + p.cabinet.width / 2} y={floorY(WALL_CAB_BOTTOM + p.cabinet.height / 2)} fontSize={Math.min(70, p.cabinet.width / 5)} textAnchor="middle">{p.cabinet.width}</text>
          </g>
        ))}
      </svg>
    </figure>
  );
}
