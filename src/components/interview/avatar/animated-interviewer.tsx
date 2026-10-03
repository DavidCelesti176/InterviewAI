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
        {look.hairStyle === "crop" ? (
          <>
            <ellipse cx="118" cy="214" rx="12" ry="18" fill={look.skin[2]} />
            <ellipse cx="282" cy="214" rx="12" ry="18" fill={look.skin[1]} />
          </>
        ) : null}
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
  if (style === "crop") {
    return <path d="M128 168 C122 112 156 72 200 68 C246 72 280 112 274 168 C258 142 230 130 200 130 C170 130 144 142 128 168 Z" fill={fill} />;
  }
  if (style === "waves") {
    return (
      <path
        d="M72 210 C62 128 118 52 200 46 C282 52 338 128 328 210 C320 292 290 348 228 362 C208 318 192 318 172 362 C110 348 80 292 72 210 Z"
        fill={fill}
      />
    );
  }
  if (style === "bob") {
    return (
      <path
        d="M86 196 C78 118 124 56 200 50 C276 56 322 118 314 196 C308 268 286 324 236 338 L164 338 C114 324 92 268 86 196 Z"
        fill={fill}
      />
    );
  }
  return (
    <path
      d="M96 198 C86 122 132 54 200 48 C268 54 314 122 304 198 C298 258 276 304 228 316 L172 316 C124 304 102 258 96 198 Z"
      fill={fill}
    />
  );
}

function HairFront({ style, fill }: { style: HairStyle; fill: string }) {
  const sheen = <path d="M156 86 C184 74 214 76 242 96" fill="none" stroke="#fff" strokeOpacity="0.22" strokeWidth="7" strokeLinecap="round" />;
  if (style === "crop") return sheen;
  if (style === "waves") {
    return (
      <g>
        <path d="M118 168 C142 96 188 78 248 98 C270 112 276 136 266 158 C230 136 170 134 136 164 C122 174 112 176 118 168 Z" fill={fill} />
        {sheen}
      </g>
    );
  }
  if (style === "bob") {
    return (
      <g>
        <path d="M122 164 C150 96 198 78 258 108 C274 124 274 146 262 162 C226 140 168 136 140 162 C126 172 114 174 122 164 Z" fill={fill} />
        {sheen}
      </g>
    );
  }
  return (
    <g>
      <path d="M126 166 C152 98 196 80 246 104 C264 120 268 142 256 160 C222 136 168 134 142 162 C128 172 116 174 126 166 Z" fill={fill} />
      {sheen}
    </g>
  );
}
