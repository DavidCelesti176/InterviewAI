import type { CharacterLook, HairStyle } from "@/components/interview/avatar/types";

const faceRound =
  "M200 118 C246 116 270 162 268 208 C266 256 248 302 200 314 C152 302 134 256 132 208 C130 162 154 116 200 118 Z";
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
        {look.hairStyle === "short" ? (
          <>
            <Ear side="left" fill={look.skin[2]} />
            <Ear side="right" fill={look.skin[1]} />
          </>
        ) : null}
        <path d={face} fill={`url(#${id}-skin)`} />
        <path d={face} fill={`url(#${id}-light)`} />
        <ellipse cx="154" cy="236" rx="18" ry="9" fill="#e08b7c" opacity={look.blush} />
        <ellipse cx="246" cy="236" rx="18" ry="9" fill="#e08b7c" opacity={look.blush * 0.85} />
        <ellipse cx="200" cy="304" rx="26" ry="6" fill="#000" opacity="0.05" />
        <Nose fill={look.skin[2]} />
        <Brows soft={look.hairStyle === "long"} />
        <Eye cx={164} cy={198} scale={look.eyeScale} iris={look.iris} lid={look.skin[1]} />
        <Eye cx={236} cy={198} scale={look.eyeScale} iris={look.iris} lid={look.skin[1]} />
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

function Nose({ fill }: { fill: string }) {
  return (
    <g opacity="0.35">
      <path d="M200 214 C197 232 196 244 200 248 C204 244 203 232 200 214" fill={fill} />
      <ellipse cx="191" cy="250" rx="5" ry="3" fill={fill} />
      <ellipse cx="209" cy="250" rx="5" ry="3" fill={fill} />
    </g>
  );
}

function Ear({ side, fill }: { side: "left" | "right"; fill: string }) {
  const outer = side === "left"
    ? "M122 192 C104 202 100 226 112 240 C126 252 138 240 136 222 C134 206 130 196 122 192 Z"
    : "M278 192 C296 202 300 226 288 240 C274 252 262 240 264 222 C266 206 270 196 278 192 Z";
  const inner = side === "left"
    ? "M120 208 C112 218 116 230 124 230 C130 228 132 216 126 208 Z"
    : "M280 208 C288 218 284 230 276 230 C270 228 268 216 274 208 Z";
  return (
    <g>
      <path d={outer} fill={fill} />
      <path d={inner} fill="#000" opacity="0.12" />
    </g>
  );
}

function Brows({ soft }: { soft: boolean }) {
  return soft ? (
    <g>
      <path className="avatar-brow" d="M140 176 Q166 160 192 172" />
      <path className="avatar-brow" d="M208 172 Q234 160 260 176" />
    </g>
  ) : (
    <g>
      <path className="avatar-brow" d="M144 174 Q168 166 194 172" />
      <path className="avatar-brow" d="M206 172 Q232 166 256 174" />
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
    return <path d="M118 188 C108 118 148 52 200 44 C252 52 292 118 282 188 C268 150 240 122 200 118 C160 122 132 150 118 188 Z" fill={fill} />;
  }
  return <path d="M116 190 C104 120 148 50 200 44 C252 50 296 120 284 190 C270 150 240 124 200 120 C160 124 130 150 116 190 Z" fill={fill} />;
}

function HairFront({ style, fill }: { style: HairStyle; fill: string }) {
  if (style === "short") {
    return (
      <g>
        <path d="M124 178 C128 112 156 72 200 66 C244 72 272 112 276 178 C262 156 238 142 214 140 C200 152 186 152 172 140 C148 142 134 156 124 178 Z" fill={fill} />
        <path d="M124 162 C114 186 116 214 130 220 C140 206 140 182 132 164 Z" fill={fill} />
        <path d="M276 162 C286 186 284 214 270 220 C260 206 260 182 268 164 Z" fill={fill} />
      </g>
    );
  }
  return (
    <path
      fill={fill}
      d="M102 326 C90 228 108 164 132 136 C156 92 176 72 200 66 C224 72 244 92 268 136 C292 164 310 228 298 326 C282 346 266 316 260 274 C254 198 244 152 222 134 C208 122 192 122 178 134 C156 152 146 198 140 274 C134 316 118 346 102 326 Z"
    />
  );
}
