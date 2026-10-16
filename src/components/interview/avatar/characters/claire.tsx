import { Brows } from "@/components/interview/avatar/features/brows";
import { Eyes } from "@/components/interview/avatar/features/eyes";
import { Mouth } from "@/components/interview/avatar/features/mouth";
import type { CharacterLook } from "@/components/interview/avatar/types";

const face =
  "M200 124 C232 122 258 146 264 180 C270 214 266 246 258 270 C248 300 226 322 200 328 C174 322 152 300 142 270 C134 246 130 214 136 180 C142 146 168 122 200 124 Z";

export function ClaireFigure({ id, look }: { id: string; look: CharacterLook }) {
  const skin = `url(#${id}-skin)`;
  const hair = `url(#${id}-hair)`;
  return (
    <>
      <g className="avatar-body">
        <path d="M36 480 V410 C78 348 128 326 172 348 C186 358 194 368 200 376 C206 368 214 358 228 348 C272 326 322 348 364 410 V480 Z" fill={`url(#${id}-blazer)`} />
        <path d="M36 480 V410 C78 348 128 326 172 348 C186 358 194 368 200 376 C206 368 214 358 228 348 C272 326 322 348 364 410 V480 Z" fill="none" stroke={look.lapel[0]} strokeWidth="1.4" opacity="0.4" />
        <path d="M172 350 C162 384 160 422 174 448 L198 408 L200 372 Z" fill={look.lapel[0]} />
        <path d="M228 350 C238 384 240 422 226 448 L202 408 L200 372 Z" fill={look.lapel[1]} />
        <path d="M188 366 L200 408 L212 366 L206 470 H194 Z" fill={look.shirt} />
      </g>
      <g className="avatar-head">
        <path d="M200 62 C248 70 292 132 296 206 C300 286 276 362 236 396 C220 372 214 328 210 300 C206 286 194 286 190 300 C186 328 180 372 164 396 C124 362 100 286 104 206 C108 132 152 70 200 62 Z" fill={hair} />
        <path d="M236 130 C268 180 274 260 248 350 C270 280 278 180 252 120 C246 108 240 116 236 130 Z" fill={look.hair[1]} opacity="0.45" />
        <path d="M178 312 C176 348 184 378 200 390 C216 378 224 348 222 312 C214 322 186 322 178 312 Z" fill={skin} />
        <path d={face} fill={skin} />
        <path d={face} fill={`url(#${id}-light)`} />
        <path d="M156 248 C168 270 184 284 200 286 C184 276 170 262 156 248 Z" fill={look.skin[2]} opacity="0.16" />
        <ellipse cx="158" cy="242" rx="14" ry="7" fill="#e7a090" opacity={look.blush} />
        <ellipse cx="244" cy="242" rx="14" ry="7" fill="#e7a090" opacity={look.blush * 0.75} />
        <ellipse cx="200" cy="314" rx="26" ry="6" fill="#000" opacity="0.05" />
        <path d="M200 220 C197 236 196 248 200 258 C204 248 203 236 200 220" fill={look.skin[2]} opacity="0.25" />
        <ellipse cx="193" cy="258" rx="3.6" ry="2" fill={look.skin[2]} opacity="0.2" />
        <ellipse cx="207" cy="258" rx="3.6" ry="2" fill={look.skin[2]} opacity="0.2" />
        <Brows variant="warm" />
        <Eyes id={id} left={166} right={234} y={202} scale={look.eyeScale} lid={look.skin[1]} />
        <Mouth smile={look.smile} lip={`url(#${id}-lip)`} />
        <path d="M150 170 C156 118 178 92 208 90 C236 92 258 120 252 168 C236 152 216 144 196 148 C174 152 158 160 150 170 Z" fill={hair} />
      </g>
    </>
  );
}
