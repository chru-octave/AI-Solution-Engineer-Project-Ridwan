interface StatCardProps {
  label: string;
  value: string | number;
  detail?: string;
  accentColor?: string;
}

const ACCENT_MAP: Record<string, string> = {
  gold: "bg-gold",
  sky: "bg-sky",
  success: "bg-success",
  danger: "bg-danger",
  violet: "bg-violet",
};

export default function StatCard({ label, value, detail, accentColor = "gold" }: StatCardProps) {
  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-5 relative overflow-hidden">
      <div className={`absolute top-0 left-0 w-[3px] h-full ${ACCENT_MAP[accentColor] || "bg-gold"}`} />
      <p className="text-[0.7rem] uppercase tracking-widest text-muted mb-2">{label}</p>
      <p className="font-display text-3xl text-light leading-none">{value}</p>
      {detail && <p className="text-[0.7rem] text-muted mt-1.5">{detail}</p>}
    </div>
  );
}
