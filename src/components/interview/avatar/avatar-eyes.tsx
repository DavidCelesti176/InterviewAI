export function AvatarEyes() {
  return (
    <g>
      <path className="avatar-brow" d="M148 162 Q170 152 192 164" />
      <path className="avatar-brow" d="M208 164 Q230 152 252 162" />
      <Eye cx={170} cy={188} />
      <Eye cx={230} cy={188} delay />
    </g>
  );
}

function Eye({ cx, cy, delay = false }: { cx: number; cy: number; delay?: boolean }) {
  return (
    <g>
      <path d={`M${cx - 16} ${cy} Q${cx} ${cy - 11} ${cx + 16} ${cy} Q${cx} ${cy + 9} ${cx - 16} ${cy} Z`} fill="#f6f0e8" />
      <ellipse cx={cx} cy={cy + 0.4} rx="6.4" ry="6.4" fill="#5a4032" />
      <ellipse cx={cx} cy={cy + 0.6} rx="3" ry="3" fill="#1b1513" />
      <ellipse cx={cx + 2} cy={cy - 1.8} rx="1.5" ry="1.5" fill="#fff" opacity="0.85" />
      <path
        className={delay ? "avatar-lid avatar-lid-late" : "avatar-lid"}
        d={`M${cx - 17} ${cy} Q${cx} ${cy - 12} ${cx + 17} ${cy} Q${cx} ${cy + 10} ${cx - 17} ${cy} Z`}
        fill="#e0b08c"
      />
    </g>
  );
}
