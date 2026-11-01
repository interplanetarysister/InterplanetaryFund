export default function TrustBadge({ donorCount = 0 }) {
  if (donorCount < 10) return null;

  const label = donorCount >= 100
    ? "100+ supporters"
    : donorCount >= 50
      ? "50+ supporters"
      : "10+ supporters";

  return (
    <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border font-semibold bg-stone-50 text-stone-700 border-stone-200">
      {label}
    </span>
  );
}
