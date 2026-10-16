export function Mouth({ smile, lip, drop = 0 }: { smile: number; lip: string; drop?: number }) {
  const lift = smile * 7;
  const y = 266 - lift * 0.35;
  const closed = `M170 ${y} C184 ${y - 6} 194 ${y - 8} 200 ${y - 5} C206 ${y - 8} 216 ${y - 6} 230 ${y} C218 ${y + 5 + smile * 5} 208 ${y + 8 + smile * 6} 200 ${y + 8 + smile * 6} C192 ${y + 8 + smile * 6} 182 ${y + 5 + smile * 5} 170 ${y} Z`;
  return (
    <g className="avatar-mouth" transform={drop ? `translate(0 ${drop})` : undefined}>
      <path className="avatar-mouth-closed" d={closed} fill={lip} />
      <path className="avatar-mouth-slight" d="M174 260 C188 256 196 256 200 258 C204 256 212 256 226 260 C214 272 206 276 200 276 C194 276 186 272 174 260 Z" fill={lip} />
      <path className="avatar-mouth-medium" d="M166 256 C184 250 194 250 200 254 C206 250 216 250 234 256 C220 286 208 292 200 292 C192 292 180 286 166 256 Z" />
      <ellipse className="avatar-teeth" cx="200" cy="268" rx="16" ry="4.5" />
      <path className="avatar-mouth-wide" d="M158 252 C180 246 194 248 200 252 C206 248 220 246 242 252 C224 304 208 312 200 312 C192 312 176 304 158 252 Z" />
    </g>
  );
}
