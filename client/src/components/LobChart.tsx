import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface LobChartProps {
  linesOfBusiness: { type: string; count: number }[];
}

const COLORS = [
  "#e8a838", "#38b2e8", "#4ae88a", "#e84a5f", "#a87ee8",
  "#e8d838", "#38e8c8", "#e87838", "#8838e8", "#38e868",
];

export default function LobChart({ linesOfBusiness }: LobChartProps) {
  if (!linesOfBusiness.length) {
    return <p className="text-muted text-sm text-center py-10">No data</p>;
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={linesOfBusiness}
            dataKey="count"
            nameKey="type"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={100}
            paddingAngle={2}
            stroke="#161b24"
            strokeWidth={2}
          >
            {linesOfBusiness.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "#1c2230",
              border: "1px solid #2a3142",
              borderRadius: 6,
              color: "#e4e8ef",
              fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 max-h-40 overflow-y-auto">
        {linesOfBusiness.map((item, i) => (
          <div key={item.type} className="flex items-center gap-2 min-w-0">
            <span
              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ background: COLORS[i % COLORS.length] }}
            />
            <span className="text-[0.7rem] text-muted truncate">
              {item.type}
            </span>
            <span className="text-[0.65rem] text-light ml-auto flex-shrink-0">
              {item.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
