"""Core color math utilities: RGB→Lab conversion, CIEDE2000 deltaE calculation.

These are server-side implementations. The colormath library is used as the
primary reference; this file provides a self-contained fallback that does not
depend on colormath, so the project works even if colormath is unavailable.
"""

import math


# ── sRGB gamma helpers ──────────────────────────────────────────────

def _linearize_srgb(c: float) -> float:
    """Convert sRGB component (0-1) to linear RGB."""
    if c <= 0.04045:
        return c / 12.92
    return ((c + 0.055) / 1.055) ** 2.4


def _compress_srgb(c: float) -> float:
    """Convert linear RGB component back to sRGB (0-1)."""
    if c <= 0.0031308:
        return 12.92 * c
    return 1.055 * (c ** (1.0 / 2.4)) - 0.055


# ── RGB ↔ Lab ───────────────────────────────────────────────────────

# D65 reference white
_XN, _YN, _ZN = 0.95047, 1.0, 1.08883


def _lab_f(t: float) -> float:
    """CIE Lab forward transform helper."""
    if t > 0.008856:
        return t ** (1.0 / 3.0)
    return 7.787 * t + 16.0 / 116.0


def _lab_f_inv(t: float) -> float:
    """CIE Lab inverse transform helper."""
    if t > 0.206893:  # (6/29)^3
        return t ** 3.0
    return (t - 16.0 / 116.0) / 7.787


def rgb_to_lab(r: int, g: int, b: int) -> tuple[float, float, float]:
    """Convert sRGB (0-255) to CIE Lab (L*, a*, b*).

    Steps: sRGB → linear RGB → XYZ (D65) → Lab
    """
    # Normalize to 0-1
    r1, g1, b1 = r / 255.0, g / 255.0, b / 255.0

    # Linearize
    rl = _linearize_srgb(r1)
    gl = _linearize_srgb(g1)
    bl = _linearize_srgb(b1)

    # Linear RGB → XYZ (D65 illuminant matrix)
    X = 0.4124564 * rl + 0.3575761 * gl + 0.1804375 * bl
    Y = 0.2126729 * rl + 0.7151522 * gl + 0.0721750 * bl
    Z = 0.0193339 * rl + 0.1191920 * gl + 0.9503041 * bl

    # XYZ → Lab
    fx = _lab_f(X / _XN)
    fy = _lab_f(Y / _YN)
    fz = _lab_f(Z / _ZN)

    L = 116.0 * fy - 16.0
    a = 500.0 * (fx - fy)
    b_val = 200.0 * (fy - fz)

    return (L, a, b_val)


def lab_to_rgb(L: float, a: float, b: float) -> tuple[int, int, int]:
    """Convert CIE Lab back to sRGB (0-255)."""
    fy = (L + 16.0) / 116.0
    fx = a / 500.0 + fy
    fz = fy - b / 200.0

    X = _XN * _lab_f_inv(fx)
    Y = _YN * _lab_f_inv(fy)
    Z = _ZN * _lab_f_inv(fz)

    # XYZ → linear RGB
    rl = 3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z
    gl = -0.9692660 * X + 1.8760108 * Y + 0.0415560 * Z
    bl = 0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z

    # Compress to sRGB
    r = _compress_srgb(rl)
    g = _compress_srgb(gl)
    b = _compress_srgb(bl)

    return (
        round(max(0, min(255, r * 255))),
        round(max(0, min(255, g * 255))),
        round(max(0, min(255, b * 255))),
    )


def hex_to_lab(hex_color: str) -> tuple[float, float, float]:
    """Convert hex color (#RRGGBB) to Lab."""
    hex_color = hex_color.lstrip("#")
    r, g, b = int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)
    return rgb_to_lab(r, g, b)


def lab_to_hex(L: float, a: float, b: float) -> str:
    """Convert Lab to hex color (#RRGGBB)."""
    r, g, b = lab_to_rgb(L, a, b)
    return f"#{r:02X}{g:02X}{b:02X}"


# ── CIEDE2000 ΔE ────────────────────────────────────────────────────

def delta_e_2000(
    lab1: tuple[float, float, float],
    lab2: tuple[float, float, float],
    kL: float = 1.0,
    kC: float = 1.0,
    kH: float = 1.0,
) -> float:
    """Compute CIEDE2000 color difference.

    Full implementation per Sharma, Wu, Dalal (2005).
    Parameters kL, kC, kH are weighting factors (1.0 for standard).
    """
    L1, a1, b1 = lab1
    L2, a2, b2 = lab2

    # Step 1: Calculate C*ab and h_ab
    C1_ab = math.sqrt(a1**2 + b1**2)
    C2_ab = math.sqrt(a2**2 + b2**2)
    C_ab_avg = (C1_ab + C2_ab) / 2.0

    # Step 2: G factor (chroma weighting)
    C_ab_avg_7 = C_ab_avg**7
    G = 0.5 * (1.0 - math.sqrt(C_ab_avg_7 / (C_ab_avg_7 + 25.0**7)))

    a1_prime = a1 * (1.0 + G)
    a2_prime = a2 * (1.0 + G)

    C1_prime = math.sqrt(a1_prime**2 + b1**2)
    C2_prime = math.sqrt(a2_prime**2 + b2**2)

    # Hue angle in degrees [0, 360)
    def _hue_angle(a: float, b: float) -> float:
        if a == 0 and b == 0:
            return 0.0
        h = math.degrees(math.atan2(b, a))
        if h < 0:
            h += 360.0
        return h

    h1_prime = _hue_angle(a1_prime, b1)
    h2_prime = _hue_angle(a2_prime, b2)

    # Step 4: ΔL', ΔC', ΔH'
    delta_L_prime = L2 - L1
    delta_C_prime = C2_prime - C1_prime

    if C1_prime * C2_prime == 0:
        delta_h_prime = 0.0
    elif abs(h2_prime - h1_prime) <= 180.0:
        delta_h_prime = h2_prime - h1_prime
    elif h2_prime - h1_prime > 180.0:
        delta_h_prime = h2_prime - h1_prime - 360.0
    else:
        delta_h_prime = h2_prime - h1_prime + 360.0

    delta_H_prime = 2.0 * math.sqrt(C1_prime * C2_prime) * math.sin(math.radians(delta_h_prime / 2.0))

    # Step 5: Arithmetic means
    L_avg = (L1 + L2) / 2.0
    C_avg_prime = (C1_prime + C2_prime) / 2.0

    if C1_prime * C2_prime == 0:
        h_avg_prime = h1_prime + h2_prime
    elif abs(h1_prime - h2_prime) <= 180.0:
        h_avg_prime = (h1_prime + h2_prime) / 2.0
    elif h1_prime + h2_prime < 360.0:
        h_avg_prime = (h1_prime + h2_prime + 360.0) / 2.0
    else:
        h_avg_prime = (h1_prime + h2_prime - 360.0) / 2.0

    # Step 6: Weighting functions
    T = (
        1.0
        - 0.17 * math.cos(math.radians(h_avg_prime - 30.0))
        + 0.24 * math.cos(math.radians(2.0 * h_avg_prime))
        + 0.32 * math.cos(math.radians(3.0 * h_avg_prime + 6.0))
        - 0.20 * math.cos(math.radians(4.0 * h_avg_prime - 63.0))
    )

    SL = 1.0 + 0.015 * (L_avg - 50.0)**2 / math.sqrt(20.0 + (L_avg - 50.0)**2)
    SC = 1.0 + 0.045 * C_avg_prime
    SH = 1.0 + 0.015 * C_avg_prime * T

    C_avg_prime_7 = C_avg_prime**7
    RT = (
        -2.0
        * math.sin(math.radians(30.0 + math.exp(-((h_avg_prime - 275.0) / 25.0)**2)))
        * math.sqrt(C_avg_prime_7 / (C_avg_prime_7 + 25.0**7))
    )

    # Step 7: Final ΔE
    dE = math.sqrt(
        (delta_L_prime / (kL * SL))**2
        + (delta_C_prime / (kC * SC))**2
        + (delta_H_prime / (kH * SH))**2
        + RT * (delta_C_prime / (kC * SC)) * (delta_H_prime / (kH * SH))
    )

    return dE


def classify_match(dE: float) -> str:
    """Classify the quality of a color match by deltaE value."""
    if dE <= 1.0:
        return "perfect"
    if dE <= 2.0:
        return "excellent"
    if dE <= 3.0:
        return "good"
    if dE <= 5.0:
        return "acceptable"
    return "different"


# ── Undertone detection ──────────────────────────────────────────────

def detect_undertone(L: float, a: float, b: float) -> str:
    """Detect skin undertone from Lab values.

    Returns: "warm", "cool", or "neutral"
    """
    if a > 5.0 and b > 15.0:
        return "warm"
    if a < -2.0 and b < 5.0:
        return "cool"
    return "neutral"


# ── Skin tone extraction helpers ─────────────────────────────────────

FACE_REGION_INDICES = {
    "forehead": [10, 151, 108, 109, 337, 338, 67, 69, 104, 297, 299, 333],
    "left_cheek": [116, 117, 118, 119, 120, 121, 122, 123, 187, 205, 206, 207],
    "right_cheek": [345, 346, 347, 348, 349, 350, 351, 352, 411, 425, 426, 427],
    "nose_bridge": [168, 6, 197, 195, 5],
    "chin": [152, 377, 148, 376, 379, 373, 374, 150],
}

SKIN_REGION_WEIGHTS = {
    "forehead": 2.0,
    "left_cheek": 1.5,
    "right_cheek": 1.5,
    "nose_bridge": 0.8,
    "chin": 0.8,
}
