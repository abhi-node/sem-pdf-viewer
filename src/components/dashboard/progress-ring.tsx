const STATUS_MAP: Record<string, { progress: number; color: string }> = {
  pending: { progress: 5, color: "#9ca3af" },
  extracting: { progress: 40, color: "#3b82f6" },
  embedding: { progress: 80, color: "#3b82f6" },
  ready: { progress: 100, color: "#22c55e" },
  failed: { progress: 100, color: "#ef4444" },
};

interface ProgressRingProps {
  status: string;
  size?: number;
  strokeWidth?: number;
}

export function ProgressRing({
  status,
  size = 24,
  strokeWidth = 3,
}: ProgressRingProps) {
  const { progress, color } = STATUS_MAP[status] ?? STATUS_MAP.pending;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  if (status === "ready") {
    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="shrink-0"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#dcfce7"
          strokeWidth={strokeWidth}
        />
        <path
          d={`M${size * 0.3} ${size * 0.5} L${size * 0.45} ${size * 0.65} L${size * 0.7} ${size * 0.35}`}
          fill="none"
          stroke="#22c55e"
          strokeWidth={strokeWidth * 0.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (status === "failed") {
    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="shrink-0"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#fecaca"
          strokeWidth={strokeWidth}
        />
        <path
          d={`M${size * 0.35} ${size * 0.35} L${size * 0.65} ${size * 0.65} M${size * 0.65} ${size * 0.35} L${size * 0.35} ${size * 0.65}`}
          fill="none"
          stroke="#ef4444"
          strokeWidth={strokeWidth * 0.8}
          strokeLinecap="round"
        />
      </svg>
    );
  }

  const isAnimating = status === "extracting" || status === "embedding";

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`shrink-0 ${isAnimating ? "animate-spin-slow" : ""}`}
      style={{ transform: "rotate(-90deg)" }}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-500"
      />
    </svg>
  );
}
