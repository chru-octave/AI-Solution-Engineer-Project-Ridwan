import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { ExposureWithSubmission } from "../api/types";

interface FleetChartProps {
  exposures: ExposureWithSubmission[];
}

export default function FleetChart({ exposures }: FleetChartProps) {
  const data = exposures
    .filter((e) => (e.numberOfTrucks || 0) > 0 || (e.numberOfDrivers || 0) > 0)
    .map((e) => {
      const name =
        e.submission?.insured?.companyName ||
        e.submission?.emailSubject ||
        "Unknown";
      return {
        name: name.length > 20 ? name.slice(0, 20) + "\u2026" : name,
        Trucks: e.numberOfTrucks || 0,
        Drivers: e.numberOfDrivers || 0,
      };
    });

  if (!data.length) {
    return <p className="text-muted text-sm text-center py-10">No fleet data</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a3142" />
        <XAxis
          dataKey="name"
          tick={{ fill: "#8893a7", fontSize: 11 }}
          axisLine={{ stroke: "#2a3142" }}
          tickLine={false}
          angle={-20}
          textAnchor="end"
          height={60}
        />
        <YAxis
          tick={{ fill: "#8893a7", fontSize: 11 }}
          axisLine={{ stroke: "#2a3142" }}
          tickLine={false}
        />
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
          wrapperStyle={{ fontSize: 11, color: "#8893a7" }}
        />
        <Bar dataKey="Trucks" fill="#e8a838" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Drivers" fill="#38b2e8" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
