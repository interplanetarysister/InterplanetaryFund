export default function EmptyState({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 p-12 md:p-16 text-center">
      {Icon && (
        <div className="w-14 h-14 mx-auto rounded-2xl bg-white/[0.04] flex items-center justify-center mb-5">
          <Icon className="w-6 h-6 text-stone-500" />
        </div>
      )}
      <p className="font-medium text-lg mb-1.5">{title}</p>
      {subtitle && <p className="text-sm text-stone-500 mb-6 max-w-sm mx-auto">{subtitle}</p>}
      {action}
    </div>
  );
}