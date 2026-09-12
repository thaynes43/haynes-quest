import type { FrozenMemory } from "./domain.js";

export interface PrivateMediaProvider {
  fetchMedia(
    memory: FrozenMemory,
  ): Promise<{ bytes: Uint8Array; contentType: string }>;
}

/** Fictional route pictures, deliberately distinct and safe to serve without a photo library. */
export function fixtureSvg(key: string): string | null {
  const pictures: Record<
    string,
    { sky: string; ground: string; label: string; drawing: string }
  > = {
    "demo-memory-2020-07": {
      sky: "#f5e7c9",
      ground: "#c8b77e",
      label: "The first glow",
      drawing: `<circle cx="710" cy="120" r="70" fill="#ffd36f"/><path d="M300 335h360v85H300z" fill="#967057"/><path d="M325 220h310v125H325z" fill="#eaa994"/><path d="M330 265Q480 180 630 265v80H330z" fill="#f8eccc"/><circle cx="480" cy="242" r="42" fill="#b47f5d"/><path d="M300 180v240M660 180v240M300 335h360" stroke="#805840" stroke-width="22" stroke-linecap="round"/><path d="m190 125 12 28 30 3-23 20 6 29-25-15-25 15 6-29-23-20 30-3z" fill="#d6a349"/>`,
    },
    "demo-memory-2022-01": {
      sky: "#ddebdf",
      ground: "#9fbb91",
      label: "A small discovery",
      drawing: `<rect x="300" y="300" width="130" height="120" rx="14" fill="#e5a959"/><rect x="450" y="300" width="130" height="120" rx="14" fill="#83a4c1"/><rect x="375" y="170" width="130" height="120" rx="14" fill="#d88278"/><path d="m440 100 85 65H355z" fill="#b16d55"/><circle cx="665" cy="360" r="64" fill="#edcf77"/><path d="M614 324q51 64 102 0M665 296v128" fill="none" stroke="#bb9150" stroke-width="9"/><path d="M140 400q70-170 135 0" fill="#759766"/>`,
    },
    "demo-memory-2024-01": {
      sky: "#f8dfd6",
      ground: "#9cb68c",
      label: "A taller path",
      drawing: `<path d="M170 70Q480 240 790 70" fill="none" stroke="#907258" stroke-width="6"/><path d="m230 95 55 15-40 65m130-42 55 5-25 65m130-63 55-4-20 63m122-98 48-17-3 68" fill="#be7584"/><ellipse cx="480" cy="428" rx="225" ry="30" fill="#799a74"/><rect x="340" y="300" width="280" height="120" rx="22" fill="#bb7868"/><path d="M340 315q35 45 70 0 35 45 70 0 35 45 70 0 35 45 70 0v-20H340z" fill="#f8edcb"/><path d="M400 295v-66M450 295v-66M510 295v-66M560 295v-66" stroke="#f1cb64" stroke-width="15"/><path d="M400 225q-22-30 0-43 22 30 0 43M450 225q-22-30 0-43 22 30 0 43M510 225q-22-30 0-43 22 30 0 43M560 225q-22-30 0-43 22 30 0 43" fill="#ffb857"/>`,
    },
    "demo-memory-2025-01": {
      sky: "#d9e4ed",
      ground: "#84a9a2",
      label: "A bright detour",
      drawing: `<path d="M280 275a200 190 0 0 1 400 0z" fill="#d69a70"/><path d="M480 105v295q0 55-55 35" fill="none" stroke="#82634f" stroke-width="13" stroke-linecap="round"/><path d="M175 140l-15 40m65 55-15 40m520-125-15 40m75 65-15 40m-610 45-15 40" stroke="#86a9be" stroke-width="12" stroke-linecap="round"/><ellipse cx="470" cy="448" rx="210" ry="24" fill="#b8d3d5"/><path d="M345 370h60v55h-90v-25h30m185-30h60v55h-90v-25h30" fill="#d4ad59"/>`,
    },
    "demo-memory-2026-01": {
      sky: "#d5dce9",
      ground: "#8f9eab",
      label: "A brave crossing",
      drawing: `<circle cx="730" cy="145" r="66" fill="#f5d584"/><path d="M410 335V185l70-80 70 80v150z" fill="#eee0c3"/><path d="m410 260-72 118h72m140-118 72 118h-72" fill="#bd7a80"/><circle cx="480" cy="230" r="40" fill="#718a9e" stroke="#ac9f80" stroke-width="13"/><path d="m435 335 45 113 45-113" fill="#e8ad65"/><path d="m190 150 9 24 26 2-21 17 7 26-21-16-22 16 7-26-20-17 26-2zM670 315l7 18 21 2-16 13 5 20-17-12-17 12 5-20-16-13 21-2z" fill="#f4d997"/>`,
    },
    "demo-memory-2027-01": {
      sky: "#45415d",
      ground: "#668b7d",
      label: "The lantern gate",
      drawing: `<path d="M270 420V190Q480-5 690 190v230" fill="none" stroke="#a78b67" stroke-width="35"/><path d="M335 420V215q145-142 290 0v205" fill="none" stroke="#c5a47a" stroke-width="12"/><path d="M480 170v50" stroke="#d7be7b" stroke-width="8"/><circle cx="480" cy="295" r="115" fill="#ffd375" opacity=".13"/><rect x="435" y="225" width="90" height="110" rx="15" fill="#f7cf77" stroke="#8f684a" stroke-width="10"/><path d="M415 225h130l-30-30h-70zM415 345h130" fill="#b5935c" stroke="#b5935c" stroke-width="10"/><path d="M480 420 365 540h235z" fill="#c0ae7e"/><circle cx="165" cy="145" r="5" fill="#f9dd9b"/><circle cx="780" cy="235" r="7" fill="#f9dd9b"/>`,
    },
  };
  const picture = pictures[key];
  if (!picture) return null;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540" role="img" aria-label="Fictional illustration: ${picture.label}"><rect width="960" height="540" fill="${picture.sky}"/><path d="M0 425Q240 350 480 425T960 425V540H0Z" fill="${picture.ground}"/>${picture.drawing}<rect x="14" y="14" width="932" height="512" rx="24" fill="none" stroke="#fff5dc" stroke-opacity=".45" stroke-width="6"/></svg>`;
}
