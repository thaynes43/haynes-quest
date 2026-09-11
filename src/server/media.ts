import type { FrozenMemory } from './domain.js';

export interface PrivateMediaProvider {
  fetchMedia(memory: FrozenMemory): Promise<{ bytes: Uint8Array; contentType: string }>;
}

export function fixtureSvg(key: string): string | null {
  const palette: Record<string, [string, string]> = {
    'demo-memory-2020-07': ['#f5ebdc', '#dca953'],
    'demo-memory-2024-01': ['#dfe8de', '#557363'],
    'demo-memory-2027-01': ['#e5deeb', '#342c46'],
  };
  const colors = palette[key];
  if (!colors) return null;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540" role="img" aria-label="Synthetic memory"><rect width="960" height="540" fill="${colors[0]}"/><circle cx="480" cy="230" r="118" fill="${colors[1]}"/><path d="M0 430 Q240 350 480 430 T960 430 V540 H0Z" fill="#557363"/><path d="M420 420V276h120v144" fill="#342c46"/><circle cx="480" cy="238" r="42" fill="#f5ebdc"/></svg>`;
}
