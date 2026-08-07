/*
 * Interplanetary Fund — Empty State Component
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 */

export default function EmptyState({
  icon = "🪐",
  title,
  subtitle,
  action,
}: {
  icon?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="text-center py-16 border border-ifborder rounded-2xl bg-ifcard">
      <div className="text-5xl mb-4">{icon}</div>
      <p className="text-sm font-semibold text-iftext mb-1">{title}</p>
      {subtitle && <p className="text-xs text-ifmuted max-w-xs mx-auto">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
