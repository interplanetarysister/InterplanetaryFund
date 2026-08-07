/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * Verified Badge — shows campaign owner verification status
 */
export default function VerifiedBadge({ size = 14 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-ifcyan/20 text-ifcyan"
      style={{ width: size + 4, height: size + 4 }}
      title="Verified Campaign"
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
