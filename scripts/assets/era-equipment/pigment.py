"""Original, deterministic 512px pigment maps; no photos or external inputs.

Long, gently wandering fibers run along V. These are color maps, with broad
carving represented by geometry in build.py. All images are packed into masters
and embedded as ordinary JPEG images by the GLB exporter.
"""
import math
from pathlib import Path
import struct
import zlib


def png(path, width, height, pixels):
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)
    rows = b''.join(b'\0' + pixels[y * width * 3:(y + 1) * width * 3] for y in range(height))
    path.write_bytes(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(rows, 9)) + chunk(b'IEND', b''))


def generate(folder):
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    for name, base in [('walnut', (126, 82, 49)), ('brass', (185, 138, 68)), ('sage', (111, 128, 76)), ('plum', (113, 65, 84))]:
        pixels = bytearray()
        for y in range(512):
            v = y / 511
            for x in range(512):
                u = x / 511
                if name == 'walnut':
                    bend = u + .024 * math.sin(v * 8 + u * 3) + .012 * math.sin(v * 18 + u * 11)
                    # Sparse knots bend the same long grain rather than adding black lines.
                    for ku, kv in [(.24, .37), (.77, .81)]:
                        dx, dy = u - ku, (v - kv) * .55
                        bend += .018 * math.exp(-(dx * dx / .009 + dy * dy / .015)) * math.sin(math.atan2(dy, dx) * 2)
                    wave = math.sin(bend * 145 + .6 * math.sin(v * 13))
                    hair = math.sin(bend * 530 + 2 * math.sin(v * 5))
                    wash = 1 + .14 * math.sin(bend * 31) + .09 * wave - .075 * max(0, hair) ** 8 + .035 * math.sin(v * 25 + u * 8)
                elif name == 'brass':
                    wash = 1 + .042 * math.sin(u * 29 + v * 19) + .022 * math.sin(u * 103) * math.sin(v * 91) + .009 * math.sin(u * 447 + v * 239)
                else:
                    wash = 1 + .065 * math.sin(u * 23 + v * 14) * math.cos(v * 17) + .025 * math.sin(u * 750) + .019 * math.sin(v * 690)
                for channel in base:
                    # Quantization preserves pigment variation while avoiding noisy files.
                    pixels.append(max(0, min(255, round(channel * wash / 2) * 2)))
        png(folder / (name + '.png'), 512, 512, pixels)
    return [folder / (name + '.png') for name in ['walnut', 'brass', 'sage', 'plum']]


if __name__ == '__main__':
    import sys
    generate(sys.argv[1])
