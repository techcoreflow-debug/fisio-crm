import { cn } from "@/lib/utils";

/**
 * Arco de Amplitude — componente-assinatura do Fisio.
 *
 * Referencia diretamente o goniômetro, o instrumento usado por
 * fisioterapeutas para medir a amplitude de movimento articular (0°–180°).
 * Em vez de um anel de progresso genérico, todo KPI do produto é lido
 * como uma "leitura de amplitude": quanto mais próximo de 180°, mais perto
 * do resultado pleno.
 */

interface GoniometerGaugeProps {
  /** 0 a 100 — percentual que será mapeado para 0°–180° */
  value: number;
  label: string;
  sublabel?: string;
  displayValue?: string;
  tone?: "clinical" | "recovery" | "attention" | "critical";
  size?: number;
  className?: string;
}

const toneColor: Record<NonNullable<GoniometerGaugeProps["tone"]>, string> = {
  clinical: "var(--color-clinical-500)",
  recovery: "var(--color-recovery-500)",
  attention: "var(--color-attention-400)",
  critical: "var(--color-critical-400)",
};

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 180) * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polarToCartesian(cx, cy, r, startDeg);
  const end = polarToCartesian(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

export function GoniometerGauge({
  value,
  label,
  sublabel,
  displayValue,
  tone = "clinical",
  size = 148,
  className,
}: GoniometerGaugeProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const angle = (clamped / 100) * 180;
  const r = size / 2 - 14;
  const cx = size / 2;
  const cy = size / 2 + 6;
  const color = toneColor[tone];

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <svg width={size} height={size / 2 + 26} viewBox={`0 0 ${size} ${size / 2 + 26}`}>
        {/* trilha 0°–180° com marcações a cada 45°, como um goniômetro real */}
        <path
          d={describeArc(cx, cy, r, 0, 180)}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth={10}
          strokeLinecap="round"
        />
        {[0, 45, 90, 135, 180].map((tick) => {
          const inner = polarToCartesian(cx, cy, r - 9, tick);
          const outer = polarToCartesian(cx, cy, r + 9, tick);
          return (
            <line
              key={tick}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke="var(--color-line-strong)"
              strokeWidth={1.5}
            />
          );
        })}
        <path
          d={describeArc(cx, cy, r, 0, Math.max(angle, 0.001))}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
        />
        <text
          x={cx}
          y={cy - r / 2.6}
          textAnchor="middle"
          className="font-display font-semibold"
          style={{ fill: "var(--color-ink)", fontSize: size * 0.16 }}
        >
          {displayValue ?? `${Math.round(angle)}°`}
        </text>
      </svg>
      <p className="font-display text-sm font-semibold text-ink text-center">{label}</p>
      {sublabel && <p className="text-xs text-ink-soft text-center">{sublabel}</p>}
    </div>
  );
}
