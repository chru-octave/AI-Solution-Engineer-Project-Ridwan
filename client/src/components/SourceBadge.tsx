interface SourceBadgeProps {
  sourceFile: string;
}

export default function SourceBadge({ sourceFile }: SourceBadgeProps) {
  const isEmail = sourceFile.toLowerCase().endsWith(".eml");
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${
        isEmail
          ? "bg-sky/10 text-sky border border-sky/30"
          : "bg-violet/10 text-violet border border-violet/30"
      }`}
    >
      {isEmail ? "EML" : "PDF"}
    </span>
  );
}
