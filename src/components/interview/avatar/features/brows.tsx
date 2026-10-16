export function Brows({ variant }: { variant: "warm" | "direct" }) {
  if (variant === "warm") {
    return (
      <g>
        <path className="avatar-brow" d="M146 178 C160 166 176 164 192 174" />
        <path className="avatar-brow" d="M208 174 C224 164 240 166 254 178" />
      </g>
    );
  }
  return (
    <g>
      <path className="avatar-brow" d="M150 176 C166 172 180 172 196 176" />
      <path className="avatar-brow" d="M206 176 C222 172 236 172 252 176" />
    </g>
  );
}
