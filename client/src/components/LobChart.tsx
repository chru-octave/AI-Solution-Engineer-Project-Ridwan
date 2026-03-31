import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
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
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={linesOfBusiness}
          dataKey="count"
          nameKey="type"
          cx="40%"
          cy="50%"
          innerRadius={55}
          outerRadius={110}
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
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          wrapperStyle={{ fontSize: 11, color: "#8893a7", paddingLeft: 10 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
