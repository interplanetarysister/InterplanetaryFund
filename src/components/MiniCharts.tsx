/*
 * Interplanetary Fund — Mini Bar Chart Component (no dependencies)
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * Lightweight SVG bar chart for analytics — replaces recharts.
 */

export function MiniBarChart({ data, height = 120 }: { data: { label: string; value: number }[]; height?: number }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const barWidth = data.length > 0 ? 100 / data.length : 0;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
        {data.map((d, i) => {
          const h = (d.value / max) * (height - 20);
          const x = i * barWidth + 1;
          const y = height - 10 - h;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barWidth - 2}
                height={h}
                fill="url(#barGradient)"
                rx="1"
              />
            </g>
          );
        })}
        <defs>
          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
      </svg>
      <div className="flex justify-between mt-1">
        {data.slice(0, Math.min(data.length, 7)).map((d, i) => (
          <span key={i} className="text-[8px] text-ifmuted">{d.label}</span>
        ))}
      </div>
    </div>
  );
}

export function MiniPieChart({ data, size = 120 }: { data: { name: string; value: number; color?: string }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <div className="text-center text-ifmuted text-sm py-8">No data</div>;

  const colors = ["#22d3ee", "#8b5cf6", "#f472b6", "#fbbf24", "#34d399", "#60a5fa", "#fb7185", "#2dd4bf"];
  let cumulative = 0;
  const radius = size / 2 - 10;

  const slices = data.map((d, i) => {
    const pct = d.value / total;
    const startAngle = cumulative * 2 * Math.PI - Math.PI / 2;
    cumulative += pct;
    const endAngle = cumulative * 2 * Math.PI - Math.PI / 2;
    const x1 = radius + radius * Math.cos(startAngle);
    const y1 = radius + radius * Math.sin(startAngle);
    const x2 = radius + radius * Math.cos(endAngle);
    const y2 = radius + radius * Math.sin(endAngle);
    const largeArc = pct > 0.5 ? 1 : 0;
    const color = d.color || colors[i % colors.length];
    return { path: `M${radius},${radius} L${x1},${y1} A${radius},${radius} 0 ${largeArc},1 ${x2},${y2} Z`, color, name: d.name, pct };
  });

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} stroke="#05060f" strokeWidth="1" />
        ))}
        <circle cx={radius} cy={radius} r={radius * 0.4} fill="#05060f" />
        <text x={radius} y={radius - 2} textAnchor="middle" fill="#f8fafc" fontSize="10" fontWeight="bold">
          {total}
        </text>
        <text x={radius} y={radius + 10} textAnchor="middle" fill="#71717a" fontSize="7">
          total
        </text>
      </svg>
      <div className="flex flex-col gap-1">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
            <span className="text-ifmuted capitalize">{s.name}</span>
            <span className="text-iftext font-medium">{(s.pct * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MiniLineChart({ data, height = 120 }: { data: { label: string; value: number }[]; height?: number }) {
  if (data.length === 0) return <div className="text-center text-ifmuted text-sm py-8">No data</div>;

  const max = Math.max(...data.map((d) => d.value), 1);
  const width = 100;
  const step = data.length > 1 ? width / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = i * step;
    const y = height - 10 - (d.value / max) * (height - 20);
    return `${x},${y}`;
  }).join(" ");

  const areaPoints = `0,${height - 10} ${points} ${width},${height - 10}`;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={areaPoints} fill="url(#areaGradient)" />
        <polyline points={points} fill="none" stroke="#22d3ee" strokeWidth="1.5" />
        {data.map((d, i) => {
          const x = i * step;
          const y = height - 10 - (d.value / max) * (height - 20);
          return <circle key={i} cx={x} cy={y} r="1" fill="#22d3ee" />;
        })}
      </svg>
      <div className="flex justify-between mt-1">
        {data.slice(0, Math.min(data.length, 7)).map((d, i) => (
          <span key={i} className="text-[8px] text-ifmuted">{d.label}</span>
        ))}
      </div>
    </div>
  );
}
