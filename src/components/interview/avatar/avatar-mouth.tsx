export function AvatarMouth() {
  return (
    <g className="avatar-mouth">
      <path className="avatar-mouth-closed" d="M178 252 Q200 256 222 252 Q200 260 178 252 Z" />
      <path className="avatar-mouth-slight" d="M180 250 Q200 262 220 250 Q200 256 180 250 Z" />
      <path className="avatar-mouth-medium" d="M174 248 Q200 272 226 248 Q200 258 174 248 Z" />
      <path className="avatar-mouth-wide" d="M170 246 Q200 282 230 246 Q200 258 170 246 Z" />
      <ellipse className="avatar-teeth" cx="200" cy="252" rx="13" ry="2.8" />
    </g>
  );
}
