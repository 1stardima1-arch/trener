// The app's brand mark: a ring of small radial segments, like a progress
// dial frozen mid-spin — echoes the recovery/strain rings that are the
// whole point of the product, instead of an arbitrary pictogram (the old
// heartbeat-pulse glyph). Built as plain SVG math (not a raster image) so
// it stays crisp at favicon size and at full-bleed splash size alike.
const SEGMENT_COUNT = 36;
// Index 30-33 (of 36) sit at the top-right — desaturated gray fading into
// amber, breaking the otherwise-uniform ring the same way the WHOOP mark
// interrupts its green ring with a gray-to-orange arc.
const BREAK_START = 30;
const BREAK_END = 34;

function segmentColor(i: number): string {
  if (i >= BREAK_START && i < BREAK_END) {
    const t = (i - BREAK_START) / (BREAK_END - BREAK_START - 1);
    // gray -> amber
    const r = Math.round(120 + t * (245 - 120));
    const g = Math.round(120 + t * (158 - 120));
    const b = Math.round(120 + t * (11 - 120));
    return `rgb(${r},${g},${b})`;
  }
  // teal -> green sweep for the rest of the ring
  const t = i / SEGMENT_COUNT;
  const r = Math.round(20 + t * 10);
  const g = Math.round(200 - t * 30);
  const b = Math.round(150 - t * 60);
  return `rgb(${r},${g},${b})`;
}

export function BrandMark({ size = 32, className }: { size?: number; className?: string }) {
  const cx = 50;
  const cy = 50;
  const outerR = 46;
  const innerR = 34;
  const segAngle = 360 / SEGMENT_COUNT;
  const gapDeg = segAngle * 0.28;

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden>
      <circle cx={cx} cy={cy} r={49} fill="#050505" />
      {Array.from({ length: SEGMENT_COUNT }, (_, i) => {
        const a0 = i * segAngle + gapDeg / 2 - 90;
        const a1 = (i + 1) * segAngle - gapDeg / 2 - 90;
        const rad0 = (a0 * Math.PI) / 180;
        const rad1 = (a1 * Math.PI) / 180;
        const x0o = cx + outerR * Math.cos(rad0);
        const y0o = cy + outerR * Math.sin(rad0);
        const x1o = cx + outerR * Math.cos(rad1);
        const y1o = cy + outerR * Math.sin(rad1);
        const x1i = cx + innerR * Math.cos(rad1);
        const y1i = cy + innerR * Math.sin(rad1);
        const x0i = cx + innerR * Math.cos(rad0);
        const y0i = cy + innerR * Math.sin(rad0);
        const d = `M ${x0o} ${y0o} A ${outerR} ${outerR} 0 0 1 ${x1o} ${y1o} L ${x1i} ${y1i} A ${innerR} ${innerR} 0 0 0 ${x0i} ${y0i} Z`;
        return <path key={i} d={d} fill={segmentColor(i)} />;
      })}
    </svg>
  );
}
