import { Design, Room } from "@/lib/kitchen";

const COLOURS: Record<string, string> = {
  base: "#e7d3b0",
  sink: "#b9d8e8",
  cooktop: "#f0b8a8",
  dishwasher: "#cfd8dc",
  fridge: "#c5cae9",
  tall: "#d7c0a0",
  oven: "#e0e0e0",
  rangehood: "none",
  wall: "none",
};

export default function PlanView({ room, design, selectedId, onSelect }: { room: Room; design: Design; selectedId: string | null; onSelect: (id: string) => void }) {
  const pad = 140;
  return (
    <svg
      viewBox={`${-pad} ${-pad} ${room.width + pad * 2} ${room.depth + pad * 2}`}
      className="w-full rounded-lg border bg-white"
      role="img"
      aria-label="Floor plan"
    >
      <rect x={0} y={0} width={room.width} height={room.depth} fill="#fafafa" stroke="#333" strokeWidth={30} />
      {design.corners.map((c, i) => (
        <g key={`corner${i}`}>
          <rect x={c.x} y={c.y} width={c.size} height={c.size} fill="#e3cfa6" stroke="#555" strokeWidth={8} />
          <line x1={c.x} y1={c.y} x2={c.x + c.size} y2={c.y + c.size} stroke="#999" strokeWidth={5} />
          <text x={c.x + c.size / 2} y={c.y + c.size / 2} fontSize={60} textAnchor="middle" dominantBaseline="middle">Corner</text>
        </g>
      ))}
      {design.runs.flatMap((r) => [
        ...r.base.map((p, i) => (
          <g key={`${r.name}-b${i}`} onClick={() => onSelect(p.cabinet.id)} style={{ cursor: "pointer" }}>
            <rect x={p.x} y={p.y} width={p.w} height={p.h} fill={COLOURS[p.cabinet.type]} stroke={selectedId === p.cabinet.id ? "#e11d48" : "#555"} strokeWidth={selectedId === p.cabinet.id ? 24 : 8} />
            <text
              x={p.x + p.w / 2}
              y={p.y + p.h / 2}
              fontSize={Math.min(90, Math.min(p.w, p.h) / 3.5)}
              textAnchor="middle"
              dominantBaseline="middle"
              transform={p.w < p.h ? `rotate(-90 ${p.x + p.w / 2} ${p.y + p.h / 2})` : undefined}
            >
              {p.cabinet.width}
            </text>
          </g>
        )),
        // wall cupboards drawn dashed (they are above)
        ...r.wall.map((p, i) => (
          <rect key={`${r.name}-w${i}`} pointerEvents="none" x={p.x} y={p.y} width={p.w} height={p.h} fill="none" stroke={selectedId === p.cabinet.id ? "#e11d48" : "#777"} strokeWidth={selectedId === p.cabinet.id ? 20 : 6} strokeDasharray="30 20" />
        )),
      ])}
      <text x={room.width / 2} y={-50} fontSize={80} textAnchor="middle">{room.width}</text>
      <text x={room.width + 60} y={room.depth / 2} fontSize={80} textAnchor="middle" transform={`rotate(90 ${room.width + 60} ${room.depth / 2})`}>{room.depth}</text>
    </svg>
  );
}
