/**
 * Harmonic-wave artwork for the approved author hero.
 *
 * A static, decorative drawing: fifteen layered sine paths that read as a
 * single sound. It carries no motion, audio, or interaction, and is hidden from
 * assistive technology. Two drawings ship in one wrapper and swap at the `md`
 * breakpoint: a wide 1200-unit viewBox and a simpler 360-unit one for narrow
 * screens, both stretched with `preserveAspectRatio="none"`.
 *
 * The geometry and opacities are ported from the approved author study as
 * literal values rather than new global tokens (the same approach as
 * `WelcomeDialog`). `currentColor` carries the accent, so the caller controls
 * the hue through the wrapper's text color.
 */

import { cn } from "@/lib/utils";

const WIDE_WIDTH = 1200;
const WIDE_CYCLES = 2.5;
const WIDE_STROKE = 0.85;
const NARROW_WIDTH = 360;
const NARROW_CYCLES = 1.25;
const NARROW_STROKE = 0.65;

/** Samples one sine path across `width` at a 4-unit step. */
function wavePath(width: number, cycles: number, index: number): string {
  let d = "";
  for (let x = 0; x <= width; x += 4) {
    const t = x / width;
    const y =
      143 +
      (index - 7) * 3 +
      Math.sin(t * Math.PI * 2 * cycles + index * 0.07) * (24 + index * 2) +
      Math.sin(t * Math.PI * 2 * (cycles + 0.75)) * 9;
    d += `${x === 0 ? "M" : "L"}${x} ${y.toFixed(2)} `;
  }
  return d;
}

/** Builds all fifteen layered paths for one drawing. */
function harmonicPaths(width: number, cycles: number): string[] {
  return Array.from({ length: 15 }, (_, index) =>
    wavePath(width, cycles, index),
  );
}

const WIDE_PATHS = harmonicPaths(WIDE_WIDTH, WIDE_CYCLES);
const NARROW_PATHS = harmonicPaths(NARROW_WIDTH, NARROW_CYCLES);

function WaveDrawing({
  width,
  paths,
  strokeWidth,
  className,
}: {
  width: number;
  paths: string[];
  strokeWidth: number;
  className?: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${width} 240`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {paths.map((d, index) => (
        <path
          key={index}
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          opacity={index === 7 ? 0.25 : 0.14}
        />
      ))}
    </svg>
  );
}

export function HarmonicWaves({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 text-[#ab4a22] dark:text-[#efa471]",
        className,
      )}
    >
      <WaveDrawing
        width={WIDE_WIDTH}
        paths={WIDE_PATHS}
        strokeWidth={WIDE_STROKE}
        className="absolute inset-0 hidden h-full w-full md:block"
      />
      <WaveDrawing
        width={NARROW_WIDTH}
        paths={NARROW_PATHS}
        strokeWidth={NARROW_STROKE}
        className="absolute inset-0 h-full w-full md:hidden"
      />
    </div>
  );
}
