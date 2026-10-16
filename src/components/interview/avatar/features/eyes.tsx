export function Eyes({
  id,
  left,
  right,
  y = 198,
  scale,
  lid,
}: {
  id: string;
  left: number;
  right: number;
  y?: number;
  scale: number;
  lid: string;
}) {
  return (
    <g>
      <Eye id={id} cx={left} cy={y} lid={lid} scale={scale} />
      <Eye id={id} cx={right} cy={y} lid={lid} scale={scale} />
    </g>
  );
}

function Eye({ id, cx, cy, scale, lid }: { id: string; cx: number; cy: number; scale: number; lid: string }) {
  const w = 18.5 * scale;
  const h = 10.2 * scale;
  const shape = `M${cx - w} ${cy + 0.6} C${cx - w * 0.35} ${cy - h} ${cx + w * 0.28} ${cy - h * 0.92} ${cx + w} ${cy + 1} C${cx + w * 0.32} ${cy + h * 0.72} ${cx - w * 0.28} ${cy + h * 0.78} ${cx - w} ${cy + 0.6} Z`;
  const crease = `M${cx - w * 0.72} ${cy - h * 0.15} C${cx - w * 0.1} ${cy - h * 1.45} ${cx + w * 0.45} ${cy - h * 1.2} ${cx + w * 0.82} ${cy - 0.2}`;
  const lash = `M${cx - w + 0.4} ${cy - 0.2} C${cx - w * 0.15} ${cy - h - 1.6} ${cx + w * 0.4} ${cy - h - 0.8} ${cx + w - 0.2} ${cy + 1.1}`;
  return (
    <g>
      <path d={crease} fill="none" stroke={lid} strokeWidth="1.3" strokeLinecap="round" opacity="0.55" />
      <path d={shape} fill="#f6f3ee" />
      <g className="avatar-pupil">
        <ellipse cx={cx + 0.4} cy={cy + 1.1} rx={6.3 * scale} ry={6.5 * scale} fill={`url(#${id}-iris)`} />
        <ellipse cx={cx + 0.5} cy={cy + 1.6} rx={2.7 * scale} ry={2.9 * scale} fill="#16110f" />
        <ellipse cx={cx + 2.3 * scale} cy={cy - 1.3 * scale} rx={1.35 * scale} ry={1.35 * scale} fill="#fff" />
      </g>
      <path d={lash} fill="none" stroke="#241c18" strokeWidth="1.45" strokeLinecap="round" />
      <path className="avatar-lid" d={shape} fill={lid} />
    </g>
  );
}
