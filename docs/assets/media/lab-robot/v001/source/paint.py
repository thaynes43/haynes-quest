"""WO111 lab-robot v001: the original 1024 painted atlas, generated with numpy.

Painted regions (see common.py for the UV side; all shapes use the blockout's measured coordinates):
* S  band front (planar x/z): the plum speaker-grille smile with three brass grille bars;
* I  iris shell (polar): the blue iris ring with camera-aperture blade lines, the plum pupil and a pale
     glass margin that blends into the lens;
* P  control panel / back hatch face (face fractions): pale tin, soft bevel shade and four brass rivets;
* R  head seam ring strip (angle x height): plum with ten brass rivets;
* K  hazard kick plate: honey brass with eight plum diagonal stripes;
* Z  hazard ring round the self-destruct button: 16 alternating brass/plum wedges;
* H  hubcap: brass with four plum radial slots, so wheel spin reads;
* DR, DL  gauge dial faces: cream face, brass rim, plum ticks and needles (35 deg right, -50 deg left);
* A  warning light (glow material): amber with a bright rotating hot spot and a paler top;
* N  head interior under the dome lid: dark works with cogs and a coiled spring (seen when it pops);
* BT self-destruct button cap: tomato with a darker rim and the cream shine;
plus 128 px flat tiles holding the sheet colours, the groove shade and the glow colours.
Supersampled 3x and box-filtered; written as an RGB PNG with zlib (no external image tools).
"""
import math, struct, zlib
import numpy as np

HEX = {'tin': '5f9ea3', 'silver': 'dde2d9', 'steel': '8e98a2', 'steel_dark': '66707c', 'brass': 'dca953', 'brass_hi': 'efc56e',
       'plum': '4a3f63', 'rubber': '3a3446', 'rubber_hi': '4b4459', 'tomato': 'e0544b', 'glass': '9fd6e3', 'cream': 'fbf6ea',
       'pupil': '2e2840', 'iris': '5a9cb4', 'smoke_light': 'cdc8d6', 'smoke_mid': '9e98ad', 'interior': '231e2e', 'amber_matte': 'f39a3d',
       'tin_shade': '538c91', 'plum_dark': '382f4d', 'glow_red': 'd8201c', 'glare_red': 'e0241c', 'spark_yellow': 'f5c93a',
       'spark_white': 'fff6d8', 'spark_orange': 'f07a26', 'amber_glow': 'c8691c', 'iris_dark': '3f7690', 'silver_shade': 'c3c8bf',
       'tomato_dark': 'b93f38', 'amber_hot': 'fff1b8'}
# Flat tile order (common.tile_uv index): 0-15 top-right quadrant, 16-31 bottom-right quadrant (24+ are glow colours).
TILES = ['tin', 'silver', 'steel', 'steel_dark', 'brass', 'brass_hi', 'plum', 'rubber', 'rubber_hi', 'tomato', 'glass', 'cream', 'pupil', 'iris',
         'smoke_light', 'smoke_mid', 'interior', 'amber_matte', 'tin_shade', 'plum_dark', 'silver_shade', 'tomato_dark', 'iris_dark', 'rubber',
         'glow_red', 'glare_red', 'spark_yellow', 'spark_white', 'spark_orange', 'amber_glow', 'glow_red', 'glow_red']
T = {}
for i, name in enumerate(TILES):
    T.setdefault(name, i)
GLOW_TILES = {'glow_red', 'glare_red', 'spark_yellow', 'spark_white', 'spark_orange', 'amber_glow'}
RECT = {'S': (0, 0, 256, 256), 'I': (256, 0, 256, 256), 'P': (0, 256, 256, 256), 'K': (256, 288, 256, 64),
        'Z': (256, 352, 128, 128), 'H': (384, 352, 128, 128), 'DR': (0, 512, 128, 128), 'DL': (128, 512, 128, 128),
        'A': (256, 512, 128, 128), 'N': (384, 512, 128, 128), 'BT': (0, 640, 128, 128), 'R': (0, 768, 512, 32)}
# Region source extents (metres), shared with build.py's UV calls.
SMILE_SRC = (0.0, 0.905, 0.11, 0.07)          # cx, cz, half width, half height of the band-front planar map
IRIS_R = 0.062                                 # iris shell edge radius (polar map radius)
IRIS_RING = (0.036, 0.056)                     # pupil edge, iris outer edge
SEAM_Z = (0.966, 0.984)
KICK = (0.0, 0.361, 0.20, 0.024)
HAZ_R = 0.08
BTN_R = 0.05
DIAL_R = 0.034
INTERIOR_R = 0.205
BEACON_ZS = (1.200, 1.280)
SS = 3

def rgb(h): return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float64)

class Canvas:
    """Supersampled region canvas over source coordinates A (horizontal) and B (vertical, top = b1)."""
    def __init__(self, w, h, a0, a1, b0, b1, bg):
        self.w = w * SS; self.h = h * SS
        ca = (np.arange(self.w) + .5) / self.w; cb = (np.arange(self.h) + .5) / self.h
        self.A, self.B = np.meshgrid(a0 + ca * (a1 - a0), b1 - cb * (b1 - b0))
        self.img = np.empty((self.h, self.w, 3)); self.img[:] = rgb(HEX.get(bg, bg))
    def put(self, mask, color, alpha=1.0):
        c = rgb(HEX.get(color, color)); self.img[mask] = self.img[mask] * (1 - alpha) + c * alpha
    def down(self):
        return self.img.reshape(self.h // SS, SS, self.w // SS, SS, 3).mean(axis=(1, 3))

def inside(A, B, poly):
    res = np.zeros(A.shape, dtype=bool); n = len(poly)
    for i in range(n):
        (xi, zi), (xj, zj) = poly[i], poly[(i - 1) % n]
        cond = ((zi > B) != (zj > B))
        with np.errstate(divide='ignore', invalid='ignore'):
            xint = (xj - xi) * (B - zi) / (zj - zi + 1e-30) + xi
        res ^= cond & (A < xint)
    return res

def disc(cv, cx, cz, r, color, alpha=1.0):
    m = np.hypot(cv.A - cx, cv.B - cz) < r; cv.put(m, color, alpha); return m

def seg_mask(cv, p, q, width):
    p = np.array(p); q = np.array(q); d = q - p; L = float(d @ d)
    t = np.clip(((cv.A - p[0]) * d[0] + (cv.B - p[1]) * d[1]) / max(L, 1e-18), 0, 1)
    return np.hypot(cv.A - (p[0] + t * d[0]), cv.B - (p[1] + t * d[1])) < width / 2

def rivet(cv, cx, cz, r):
    """Brass rivet with a dark lower-right rim and a light upper-left highlight."""
    disc(cv, cx + r * 0.12, cz - r * 0.12, r * 1.05, 'plum_dark', .45)
    disc(cv, cx, cz, r, 'brass')
    disc(cv, cx - r * 0.3, cz + r * 0.3, r * 0.42, 'brass_hi')

# ---------------- band front: the smile ----------------
def paint_smile():
    cx, cz, hw, hh = SMILE_SRC
    cv = Canvas(256, 256, cx - hw, cx + hw, cz - hh, cz + hh, 'silver')
    MW = 0.08
    xs = [-MW + 2 * MW * i / 40 for i in range(41)]
    upper = [(x, 0.884 + 0.014 * (x / MW) ** 2) for x in xs]; lower = [(x, 0.857 + 0.037 * (x / MW) ** 2) for x in xs]
    poly = lower + upper[::-1]
    m = inside(cv.A, cv.B, poly); cv.put(m, 'plum')
    # a thin darker lower lip line for depth
    low2 = [(x, z + 0.0035) for x, z in lower]; m2 = m & ~inside(cv.A, cv.B, low2 + upper[::-1]); cv.put(m2, 'plum_dark', .8)
    for gx in (-0.036, 0.0, 0.036):
        zl = 0.857 + 0.037 * (gx / MW) ** 2 + 0.005; zu = 0.884 + 0.014 * (gx / MW) ** 2 - 0.005
        cv.put(seg_mask(cv, (gx, zl), (gx, zu), 0.0095), 'brass')
        cv.put(seg_mask(cv, (gx - 0.0015, zl + 0.002), (gx - 0.0015, zu - 0.002), 0.003), 'brass_hi')
    return cv.down()

# ---------------- iris shell ----------------
def paint_iris():
    R = IRIS_R; cv = Canvas(256, 256, -R, R, -R, R, 'glass')
    rho = np.hypot(cv.A, cv.B); ang = np.arctan2(cv.B, cv.A)
    p0, p1 = IRIS_RING
    ring = (rho >= p0) & (rho < p1); cv.put(ring, 'iris')
    # six curved aperture blades (thin darker arcs spiralling out from the pupil)
    for k in range(6):
        a0 = math.tau * k / 6
        for t in np.linspace(0, 1, 40):
            r = p0 + (p1 - p0) * t; a = a0 + 0.9 * t
            m = np.hypot(cv.A - r * math.cos(a), cv.B - r * math.sin(a)) < 0.0013
            cv.put(m & ring, 'iris_dark', .9)
    cv.put((rho >= p1 - 0.003) & (rho < p1), 'iris_dark')
    cv.put(rho < p0, 'pupil')
    cv.put((rho >= p0 - 0.002) & (rho < p0), 'plum_dark')
    return cv.down()

# ---------------- panel / hatch face ----------------
def paint_panel():
    cv = Canvas(256, 256, 0, 1, 0, 1, 'silver')
    edge = np.minimum(np.minimum(cv.A, 1 - cv.A), np.minimum(cv.B, 1 - cv.B))
    cv.put(edge < 0.018, 'silver_shade')
    for fx in (0.065, 0.935):
        for fz in (0.077, 0.923):
            rivet(cv, fx, fz, 0.036)
    return cv.down()

# ---------------- seam ring rivets ----------------
def paint_seam():
    z0, z1 = SEAM_Z; pad = 4 / 512
    cv = Canvas(512, 32, 0, 1, z0, z1, 'plum')
    circ = math.tau * 0.212
    for i in range(10):
        a = math.tau * (i + 0.5) / 10                       # blockout angle from +X
        x, y = math.cos(a), math.sin(a)
        phi = math.atan2(x, -y) % math.tau; u = pad + (1 - 2 * pad) * phi / math.tau
        for du in (-1, 0, 1):
            # rivets as ellipses in (u, z): radius 0.008 m
            m = np.hypot((cv.A - (u + du)) * circ, cv.B - (z0 + z1) / 2) < 0.0078
            cv.put(m, 'brass')
            mh = np.hypot((cv.A - (u + du)) * circ + 0.0025, cv.B - (z0 + z1) / 2 - 0.0025) < 0.003
            cv.put(mh, 'brass_hi')
    return cv.down()

# ---------------- hazard kick plate ----------------
def paint_kick():
    cx, cz, hw, hh = KICK
    cv = Canvas(256, 64, cx - hw, cx + hw, cz - hh, cz + hh, 'brass')
    for i in range(8):
        x0 = -0.19 + i * 0.048
        cv.put(inside(cv.A, cv.B - cz, [(x0, -0.02), (x0 + 0.02, -0.02), (x0 + 0.042, 0.02), (x0 + 0.022, 0.02)]), 'plum')
    edge = np.minimum(np.minimum(cv.A - (cx - hw), (cx + hw) - cv.A), np.minimum(cv.B - (cz - hh), (cz + hh) - cv.B))
    cv.put(edge < 0.0025, 'plum_dark', .5)
    return cv.down()

# ---------------- hazard ring ----------------
def paint_hazard():
    R = HAZ_R; cv = Canvas(128, 128, -R, R, -R, R, 'plum')
    rho = np.hypot(cv.A, cv.B); ang = (np.arctan2(cv.B, cv.A) - math.pi / 16) % math.tau
    wedge = np.floor(ang / (math.tau / 16)).astype(int) % 2 == 0
    ring = (rho >= 0.052) & (rho < 0.078)
    cv.put(ring & wedge, 'brass'); cv.put(ring & ~wedge, 'plum')
    cv.put((rho >= 0.0765) & (rho < 0.079), 'plum_dark')
    return cv.down()

# ---------------- hubcap ----------------
def paint_hub():
    cv = Canvas(128, 128, -1, 1, -1, 1, 'brass')
    rho = np.hypot(cv.A, cv.B)
    for k in range(4):
        a = math.tau * k / 4 + math.pi / 4
        cv.put(seg_mask(cv, (0.34 * math.cos(a), 0.34 * math.sin(a)), (0.80 * math.cos(a), 0.80 * math.sin(a)), 0.16), 'plum')
    cv.put((rho > 0.9) & (rho < 1.0), 'plum_dark', .55)
    cv.put(rho < 0.30, 'brass_hi')
    return cv.down()

# ---------------- gauge dials ----------------
def paint_dial(ang_deg):
    R = DIAL_R; cv = Canvas(128, 128, -R, R, -R, R, 'brass')
    rho = np.hypot(cv.A, cv.B)
    cv.put(rho < 0.027, 'cream')
    for k in range(7):
        a = math.radians(-70 + 140 * k / 6)
        cv.put(seg_mask(cv, (0.019 * math.sin(a), 0.019 * math.cos(a)), (0.025 * math.sin(a), 0.025 * math.cos(a)), 0.0022), 'plum')
    a = math.radians(ang_deg)
    cv.put(seg_mask(cv, (-0.004 * math.sin(a), -0.004 * math.cos(a)), (0.022 * math.sin(a), 0.022 * math.cos(a)), 0.0042), 'plum')
    disc(cv, 0, 0, 0.0045, 'plum_dark')
    cv.put((rho > 0.0255) & (rho < 0.0275), 'plum_dark', .5)
    return cv.down()

# ---------------- warning light (glow) ----------------
def paint_beacon():
    z0, z1 = BEACON_ZS
    cv = Canvas(128, 128, 0, 1, z0, z1, 'amber_glow')
    phi = cv.A * math.tau
    hot = np.exp(-((np.angle(np.exp(1j * (phi - math.pi)))) / 0.55) ** 2)       # hot spot facing forward at rest
    back = np.exp(-((np.angle(np.exp(1j * phi))) / 0.9) ** 2)
    img = cv.img
    # darker than the sheet amber: lit colour plus the same atlas as emission lands near the sheet's #f39a3d
    img[:] = rgb('c8691c') * (1 - hot[..., None]) + rgb('ffcf6a') * hot[..., None]
    img[:] = img * (1 - 0.40 * back[..., None]) + rgb('93420f') * 0.40 * back[..., None]
    top = np.clip((cv.B - (z1 - 0.022)) / 0.022, 0, 1)[..., None]
    img[:] = img * (1 - 0.30 * top) + rgb('e8a043') * 0.30 * top
    return cv.down()

# ---------------- head interior ----------------
def paint_interior():
    R = INTERIOR_R; cv = Canvas(128, 128, -R, R, -R, R, 'interior')
    def cog(cx, cz, r, teeth, color):
        rho = np.hypot(cv.A - cx, cv.B - cz); ang = np.arctan2(cv.B - cz, cv.A - cx)
        outer = r * (1 + 0.14 * (np.cos(teeth * ang) > 0.2))
        cv.put((rho < outer) & (rho > r * 0.45), color); cv.put(rho < r * 0.18, color)
    cog(-0.07, 0.05, 0.05, 10, 'plum'); cog(0.06, 0.07, 0.035, 8, 'brass'); cog(0.03, -0.08, 0.045, 9, 'plum')
    rho = np.hypot(cv.A + 0.06, cv.B + 0.07)
    for r in (0.012, 0.024, 0.036):
        cv.put((rho > r - 0.0025) & (rho < r + 0.0025), 'steel')
    cv.put(np.hypot(cv.A, cv.B) > 0.195, 'silver_shade')
    return cv.down()

# ---------------- self-destruct button cap ----------------
def paint_button():
    R = BTN_R; cv = Canvas(128, 128, -R, R, -R, R, 'tomato')
    rho = np.hypot(cv.A, cv.B)
    cv.put(rho > 0.040, 'tomato_dark', .55)
    m = np.hypot((cv.A + 0.018) / 0.014, (cv.B - 0.02) / 0.009) < 1; cv.put(m, 'cream')
    m = np.hypot((cv.A + 0.004) / 0.005, (cv.B - 0.029) / 0.004) < 1; cv.put(m, 'cream', .8)
    return cv.down()

def png(path, img):
    img = np.clip(np.round(img), 0, 255).astype(np.uint8)
    def chunk(name, data): return struct.pack('>I', len(data)) + name + data + struct.pack('>I', zlib.crc32(name + data) & 0xffffffff)
    raw = b''.join(b'\x00' + row.tobytes() for row in img)
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', img.shape[1], img.shape[0], 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    open(path, 'wb').write(data)

def paint_atlas(path):
    A = np.empty((1024, 1024, 3)); A[:] = rgb(HEX['silver'])
    def put(key, img):
        x, y, w, h = RECT[key]; A[y:y + h, x:x + w] = img
    put('S', paint_smile()); put('I', paint_iris()); put('P', paint_panel()); put('R', paint_seam()); put('K', paint_kick())
    put('Z', paint_hazard()); put('H', paint_hub()); put('DR', paint_dial(35)); put('DL', paint_dial(-50)); put('A', paint_beacon())
    put('N', paint_interior()); put('BT', paint_button())
    for i, name in enumerate(TILES):
        q = i % 16; x = 512 + (q % 4) * 128; y = (q // 4) * 128 + (512 if i >= 16 else 0); A[y:y + 128, x:x + 128] = rgb(HEX[name])
    png(path, A)
    return {'tiles': TILES, 'glow_tiles': sorted(GLOW_TILES), 'regions': RECT, 'smile_src': SMILE_SRC, 'iris_r': IRIS_R, 'iris_ring': IRIS_RING,
            'seam_z': SEAM_Z, 'kick': KICK, 'hazard_r': HAZ_R, 'button_r': BTN_R, 'dial_r': DIAL_R, 'interior_r': INTERIOR_R, 'beacon_z': BEACON_ZS, 'supersampling': SS}

if __name__ == '__main__':
    import sys; print(paint_atlas(sys.argv[1] if len(sys.argv) > 1 else 'pigment.png'))
