// Background motif — DESIGN.md §5.3.
//
// TWO rendering modes:
//   1) PATTERN mode (default — used by booking/destinations/wishlist/trending/detail):
//      tile 300×300 containing "travel map" composition (dashed routes, waypoints,
//      small compass rose, location pin). Small & faint elements,
//      orange still readable; two patterns (A/B) break rigid grid look.
//   2) RANDOM mode (prop `random` — used by Home & Account): same elements
//      scattered pseudo-randomly but DETERMINISTIC
//      (fixed seed → safe SSR/hydration, no Math.random during render).
//      Positions guaranteed non-overlapping (center distance >= 140 units;
//      each cluster bounded to ~55 unit radius), rotation & variant
//      randomized per point → organic feel, not repeating grid.
//
// Props:
//   - size="small"  → only affects PATTERN mode (pattern scaled down).
//   - dense={false} → PATTERN mode: no pattern B; RANDOM mode: fewer clusters
//     (16 clusters, same density as Booking) vs default 24 clusters.
//   - random=true   → random scatter mode (Home & Account).
export default function BackgroundMotif({
  size = "default",
  dense = true,
  random = false,
}: {
  size?: "default" | "small";
  dense?: boolean;
  random?: boolean;
}) {
  const scale = size === "small" ? "0.72" : "1";
  const patA = scale === "1" ? undefined : `scale(${scale})`;
  const patB =
    scale === "1" ? undefined : `scale(${scale}) translate(150 150) rotate(8)`;
  const scatterItems = random ? (dense ? SCATTER_DENSE : SCATTER_SPARSE) : [];

  return (
    <svg
      className="bg-motif pointer-events-none absolute inset-0 -z-10 h-full w-full text-brand-orange"
      viewBox="0 0 1440 1000"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        {/* Small compass rose, reusable — center at (0,0) */}
        <g id="np-compass-small" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="0" cy="0" r="20" />
          <path d="M 0 -5 L 0 -16 M 0 5 L 0 16 M -5 0 L -16 0 M 5 0 L 16 0" />
          <path d="M -3.5 -3.5 L -11 -11 M 3.5 3.5 L 11 11 M 3.5 -3.5 L 11 -11 M -3.5 3.5 L -11 11" />
          <path d="M 0 -20 L 0 -25" />
          <path d="M -3 -20 L 0 -26 L 3 -20 Z" fill="currentColor" stroke="none" />
          <circle cx="0" cy="0" r="2.5" fill="currentColor" stroke="none" />
        </g>
        {/* Small location pin, reusable — center at (0,0) */}
        <g id="np-pin" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M 0 -18 C -9 -18 -14 -11 -14 -4 C -14 5 -2 13 0 15 C 2 13 14 5 14 -4 C 14 -11 9 -18 0 -18 Z" />
          <circle cx="0" cy="-5" r="4" />
        </g>

        {/* ——— Compact cluster for RANDOM mode (center at 0,0, radius ≤ ~55) ——— */}
        <g id="np-sc-route" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <path
            d="M -34 14 C -10 24, 10 -16, 34 -8"
            strokeWidth="1.4"
            strokeDasharray="4 7"
          />
          <path
            d="M -26 -14 C -8 -22, 8 2, 18 -6"
            strokeWidth="1.1"
            strokeDasharray="3 6"
            opacity="0.65"
          />
          <circle cx="-34" cy="14" r="3" fill="currentColor" stroke="none" />
          <circle cx="34" cy="-8" r="3" fill="currentColor" stroke="none" />
          <circle cx="34" cy="-8" r="6.5" strokeWidth="1.3" />
        </g>

        <g id="np-sc-routecompass" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <path
            d="M -34 14 C -10 24, 10 -16, 34 -8"
            strokeWidth="1.4"
            strokeDasharray="4 7"
          />
          <circle cx="-34" cy="14" r="3" fill="currentColor" stroke="none" />
          <circle cx="34" cy="-8" r="3" fill="currentColor" stroke="none" />
          <circle cx="34" cy="-8" r="6.5" strokeWidth="1.3" />
          <use href="#np-compass-small" transform="translate(54 12) rotate(12)" />
        </g>

        <g id="np-sc-routepin" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <path
            d="M -34 14 C -10 24, 10 -16, 34 -8"
            strokeWidth="1.4"
            strokeDasharray="4 7"
          />
          <circle cx="-34" cy="14" r="3" fill="currentColor" stroke="none" />
          <circle cx="34" cy="-8" r="3" fill="currentColor" stroke="none" />
          <circle cx="34" cy="-8" r="6.5" strokeWidth="1.3" />
          <use href="#np-pin" transform="translate(56 14) rotate(-8)" />
        </g>

        <pattern id="np-travel-a" width="300" height="300" patternUnits="userSpaceOnUse" patternTransform={patA}>
          <g opacity="0.14">
            <path
              d="M 22 258 C 84 238, 128 160, 218 118 S 262 72, 284 38"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="4 8"
              strokeLinecap="round"
            />
            <path
              d="M 150 300 C 160 250, 150 210, 178 170"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeDasharray="3 7"
              strokeLinecap="round"
              opacity="0.7"
            />
            <g fill="currentColor">
              <circle cx="52" cy="248" r="3" />
              <circle cx="222" cy="114" r="3" />
              <circle cx="286" cy="42" r="3" />
            </g>
            <circle cx="286" cy="42" r="6.5" stroke="currentColor" strokeWidth="1.4" />
            <use href="#np-compass-small" transform="translate(204 236) rotate(-14)" />
            <use href="#np-pin" transform="translate(66 66) rotate(10)" />
          </g>
        </pattern>

        <pattern id="np-travel-b" width="300" height="300" patternUnits="userSpaceOnUse" patternTransform={patB}>
          <g opacity="0.12">
            <path
              d="M 252 24 C 214 84, 178 148, 214 226 S 214 266, 128 286"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="4 8"
              strokeLinecap="round"
            />
            <path
              d="M 40 210 C 70 190, 80 150, 60 120"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeDasharray="3 7"
              strokeLinecap="round"
              opacity="0.7"
            />
            <g fill="currentColor">
              <circle cx="232" cy="232" r="3" />
              <circle cx="124" cy="290" r="3" />
              <circle cx="54" cy="122" r="3" />
            </g>
            <circle cx="54" cy="122" r="6.5" stroke="currentColor" strokeWidth="1.4" />
            <use href="#np-compass-small" transform="translate(96 48) rotate(20)" />
            <use href="#np-pin" transform="translate(232 128) rotate(-6)" />
          </g>
        </pattern>
      </defs>

      {random ? (
        <g>
          {scatterItems.map((it, i) => (
            <g
              key={i}
              opacity={it.o}
              transform={`translate(${it.x} ${it.y}) rotate(${it.r})`}
            >
              <use href={`#${CLUSTER_IDS[it.v]}`} />
            </g>
          ))}
        </g>
      ) : (
        <>
          <rect width="1440" height="1000" fill="url(#np-travel-a)" />
          {dense && <rect width="1440" height="1000" fill="url(#np-travel-b)" />}
        </>
      )}
    </svg>
  );
}

type ScatterItem = { x: number; y: number; r: number; v: number; o: number };

const CLUSTER_IDS = [
  "np-sc-route",
  "np-compass-small",
  "np-pin",
  "np-sc-routecompass",
  "np-sc-routepin",
];

// Deterministic PRNG (mulberry32) — fixed seed, so position/rotation/variant
// are IDENTICAL on server & client (safe hydration) and stable across renders.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildScatter(maxCount: number): ScatterItem[] {
  const rand = mulberry32(0x9e3779b9);
  const candidates: { x: number; y: number }[] = [];
  const cols = 14;
  const rows = 9;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      candidates.push({
        x: ((i + 0.5 + (rand() - 0.5) * 0.65) / cols) * 1440,
        y: ((j + 0.5 + (rand() - 0.5) * 0.65) / rows) * 1000,
      });
    }
  }
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = candidates[i];
    candidates[i] = candidates[j];
    candidates[j] = tmp;
  }
  const picked: ScatterItem[] = [];
  const MIN_DIST = 140; // ensure clusters don't stick together
  for (const c of candidates) {
    if (picked.length >= maxCount) break;
    if (picked.every((p) => Math.hypot(p.x - c.x, p.y - c.y) >= MIN_DIST)) {
      picked.push({
        x: Math.round(c.x * 10) / 10,
        y: Math.round(c.y * 10) / 10,
        r: Math.round((rand() * 360 - 180) * 10) / 10,
        v: Math.floor(rand() * 5),
        o: Math.round((0.11 + rand() * 0.05) * 100) / 100,
      });
    }
  }
  return picked;
}

const SCATTER_DENSE = buildScatter(24);
const SCATTER_SPARSE = SCATTER_DENSE.slice(0, 16);
