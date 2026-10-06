import type { CharacterLook, HairStyle } from "@/components/interview/avatar/types";

const faceRound =
  "M200 112 C252 114 286 156 284 206 C282 258 258 304 200 316 C142 304 118 258 116 206 C114 156 148 114 200 112 Z";
const faceDefined =
  "M200 110 C246 112 278 154 276 202 C274 250 256 308 200 322 C144 308 126 250 124 202 C122 154 154 112 200 110 Z";

export function AnimatedInterviewer({
  id,
  look,
  label,
}: {
  id: string;
  look: CharacterLook;
  label?: string;
}) {
  const face = look.jaw === "defined" ? faceDefined : faceRound;

  return (
    <svg className="h-full w-full" viewBox="0 0 400 480" role={label ? "img" : "presentation"} aria-label={label} aria-hidden={label ? undefined : true}>
      <defs>
        <linearGradient id={`${id}-skin`} x1="150" y1="100" x2="260" y2="330" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={look.skin[0]} />
          <stop offset="0.58" stopColor={look.skin[1]} />
          <stop offset="1" stopColor={look.skin[2]} />
        </linearGradient>
        <linearGradient id={`${id}-hair`} x1="110" y1="36" x2="290" y2="300" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={look.hair[0]} />
          <stop offset="1" stopColor={look.hair[1]} />
        </linearGradient>
        <linearGradient id={`${id}-blazer`} x1="60" y1="320" x2="300" y2="480" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={look.blazer[0]} />
          <stop offset="1" stopColor={look.blazer[1]} />
        </linearGradient>
        <radialGradient id={`${id}-light`} cx="36%" cy="30%" r="48%">
          <stop offset="0" stopColor="#fff7f1" stopOpacity="0.5" />
          <stop offset="0.7" stopColor="#fff7f1" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g className="avatar-body">
        <path d="M8 408 C78 332 132 314 174 330 L200 356 L226 330 C268 314 322 332 392 408 V480 H8 Z" fill={`url(#${id}-blazer)`} />
        <path d="M174 332 C164 364 160 396 170 418 L198 396 L200 352 Z" fill={look.lapel[0]} />
        <path d="M226 332 C236 364 240 396 230 418 L202 396 L200 352 Z" fill={look.lapel[1]} />
        <path d="M188 346 L200 384 L212 346 L207 468 H193 Z" fill={look.shirt} />
        <path d="M178 268 C176 318 186 352 200 366 C214 352 224 318 222 268 C212 280 188 280 178 268 Z" fill={`url(#${id}-skin)`} />
      </g>

      <g className="avatar-head">
        <HairBack style={look.hairStyle} fill={`url(#${id}-hair)`} />
        <ellipse cx="112" cy="210" rx="14" ry="20" fill={look.skin[2]} />
        <ellipse cx="288" cy="210" rx="14" ry="20" fill={look.skin[1]} />
        <path d={face} fill={`url(#${id}-skin)`} />
        <path d={face} fill={`url(#${id}-light)`} />
        <ellipse cx="152" cy="232" rx="16" ry="8" fill="#e08b7c" opacity={look.blush} />
        <ellipse cx="248" cy="232" rx="16" ry="8" fill="#e08b7c" opacity={look.blush * 0.8} />
        <ellipse cx="200" cy="308" rx="36" ry="8" fill="#000" opacity="0.08" />
        <path d="M196 214 Q200 232 190 242 Q200 248 210 242 Q200 232 204 214 Z" fill={look.skin[2]} opacity="0.28" />
        <Brows />
        <Eye cx={166} cy={188} scale={look.eyeScale} iris={look.iris} lid={look.skin[1]} />
        <Eye cx={234} cy={188} scale={look.eyeScale} iris={look.iris} lid={look.skin[1]} />
        <Mouth smile={look.smile} lip={look.lip} />
        {look.beard ? (
          <path d="M156 286 C164 316 180 332 200 334 C220 332 236 316 244 286 C228 300 214 306 200 306 C186 306 172 300 156 286 Z" fill={`url(#${id}-hair)`} />
        ) : null}
        <HairFront style={look.hairStyle} fill={`url(#${id}-hair)`} />
      </g>
    </svg>
  );
}

function Eye({ cx, cy, scale, iris, lid }: { cx: number; cy: number; scale: number; iris: string; lid: string }) {
  const w = 24 * scale;
  const h = 16 * scale;
  const shape = `M${cx - w} ${cy} Q${cx} ${cy - h} ${cx + w} ${cy} Q${cx} ${cy + h * 0.92} ${cx - w} ${cy} Z`;
  return (
    <g>
      <path d={shape} fill="#f8f5f0" />
      <ellipse className="avatar-pupil" cx={cx} cy={cy + 1.2} rx={8.2 * scale} ry={8.4 * scale} fill={iris} />
      <ellipse className="avatar-pupil" cx={cx} cy={cy + 1.6} rx={3.8 * scale} ry={4 * scale} fill="#1a1614" />
      <ellipse cx={cx + 3 * scale} cy={cy - 2.6 * scale} rx={2.1 * scale} ry={2.1 * scale} fill="#fff" />
      <path className="avatar-lid" d={shape} fill={lid} />
    </g>
  );
}

function Brows() {
  return (
    <g>
      <path className="avatar-brow" d="M142 162 Q166 148 190 160" />
      <path className="avatar-brow" d="M210 160 Q234 148 258 162" />
    </g>
  );
}

function Mouth({ smile, lip }: { smile: number; lip: string }) {
  const y = 262 - smile * 2;
  const dip = 8 + smile * 8;
  return (
    <g className="avatar-mouth">
      <path className="avatar-mouth-closed" d={`M172 ${y} Q200 ${y + dip} 228 ${y} Q200 ${y + dip * 0.45} 172 ${y} Z`} fill={lip} />
      <path className="avatar-mouth-slight" d="M174 258 Q200 280 226 258 Q200 266 174 258 Z" fill={lip} />
      <path className="avatar-mouth-medium" d="M166 254 Q200 300 234 254 Q200 270 166 254 Z" />
      <ellipse className="avatar-teeth" cx="200" cy="266" rx="18" ry="5" />
      <path className="avatar-mouth-wide" d="M158 250 Q200 318 242 250 Q200 274 158 250 Z" />
    </g>
  );
}

function HairBack({ style, fill }: { style: HairStyle; fill: string }) {
  if (style === "short") {
    return <path d="M118 198 C110 128 148 52 200 46 C252 52 290 128 282 198 C266 168 244 150 220 146 C200 156 180 156 160 146 C136 150 122 168 118 198 Z" fill={fill} />;
  }
  return (
    <path
      fill={fill}
      fillRule="evenodd"
      d="M104 196 C96 118 136 40 200 34 C264 40 304 118 296 196 C286 286 270 360 246 412 L214 398 C238 328 248 250 234 190 C222 150 210 142 200 142 C190 142 178 150 166 190 C152 250 162 328 186 398 L154 412 C130 360 114 286 104 196 Z"
    />
  );
}

function HairFront({ style, fill }: { style: HairStyle; fill: string }) {
  if (style === "short") {
    return <path d="M146 162 C168 128 198 116 230 132 C252 146 258 164 240 172 C210 156 176 154 154 172 C142 164 140 164 146 162 Z" fill={fill} />;
  }
  return (
    <g>
      <path d="M148 168 C172 124 220 112 262 148 C244 168 188 174 154 160 C144 154 140 158 148 168 Z" fill={fill} />
    </g>
  );
}
