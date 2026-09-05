"""Color vision accessibility service — Daltonize, Ishihara, palette generation."""

from app.utils.color_math import (
    delta_e_2000, rgb_to_lab, lab_to_rgb, hex_to_lab, lab_to_hex,
    detect_undertone,
)


# ── Daltonize matrices (Brettel/Viénot/Mollon 1997) ────────────────

CB_MATRICES = {
    "protanopia": {
        "simulate": [
            [0.567, 0.433, 0.000],
            [0.558, 0.442, 0.000],
            [0.000, 0.242, 0.758],
        ],
        "shift": [
            [0.000, 0.000, 0.000],
            [0.700, 1.000, 0.000],
            [0.300, 0.000, 1.000],
        ],
    },
    "deuteranopia": {
        "simulate": [
            [0.625, 0.375, 0.000],
            [0.700, 0.300, 0.000],
            [0.000, 0.300, 0.700],
        ],
        "shift": [
            [0.000, 0.000, 0.000],
            [1.000, 0.700, 0.000],
            [0.000, 0.300, 1.000],
        ],
    },
    "tritanopia": {
        "simulate": [
            [0.950, 0.050, 0.000],
            [0.000, 0.433, 0.567],
            [0.000, 0.475, 0.525],
        ],
        "shift": [
            [1.000, 0.700, 0.000],
            [0.000, 0.000, 0.000],
            [0.000, 0.300, 1.000],
        ],
    },
}


def _matrix_multiply(mat: list[list[float]], vec: list[float]) -> list[float]:
    """Multiply a 3×3 matrix by a 3-vector."""
    return [
        mat[0][0] * vec[0] + mat[0][1] * vec[1] + mat[0][2] * vec[2],
        mat[1][0] * vec[0] + mat[1][1] * vec[1] + mat[1][2] * vec[2],
        mat[2][0] * vec[0] + mat[2][1] * vec[1] + mat[2][2] * vec[2],
    ]


def daltonize_pixel(
    r: int, g: int, b: int, cb_type: str,
) -> tuple[int, int, int]:
    """Apply Daltonize correction to a single RGB pixel.

    Steps: simulate → compute error → shift error → add back.
    """
    matrices = CB_MATRICES.get(cb_type, CB_MATRICES["deuteranopia"])
    rgb_norm = [r / 255.0, g / 255.0, b / 255.0]

    # Simulate
    simulated = _matrix_multiply(matrices["simulate"], rgb_norm)
    # Error
    error = [rgb_norm[0] - simulated[0], rgb_norm[1] - simulated[1], rgb_norm[2] - simulated[2]]
    # Shift
    shifted = _matrix_multiply(matrices["shift"], error)
    # Corrected
    corrected = [
        max(0, min(1, rgb_norm[0] + shifted[0])),
        max(0, min(1, rgb_norm[1] + shifted[1])),
        max(0, min(1, rgb_norm[2] + shifted[2])),
    ]

    return (round(corrected[0] * 255), round(corrected[1] * 255), round(corrected[2] * 255))


def daltonize_image_data(
    pixels: list[tuple[int, int, int]], cb_type: str,
) -> list[tuple[int, int, int]]:
    """Apply Daltonize to a flat list of (R, G, B) tuples."""
    return [daltonize_pixel(r, g, b, cb_type) for r, g, b in pixels]


def simulate_cb_pixel(
    r: int, g: int, b: int, cb_type: str,
) -> tuple[int, int, int]:
    """Simulate how a color-blind person sees a pixel (no correction)."""
    matrices = CB_MATRICES.get(cb_type, CB_MATRICES["deuteranopia"])
    rgb_norm = [r / 255.0, g / 255.0, b / 255.0]
    simulated = _matrix_multiply(matrices["simulate"], rgb_norm)
    return (round(simulated[0] * 255), round(simulated[1] * 255), round(simulated[2] * 255))


# ── Ishihara detection ──────────────────────────────────────────────

ISHIHARA_PLATES = [
    {"plate_id": 1, "correct_answer": 12, "protanopia_sees": 6, "deuteranopia_sees": 6, "tritanopia_sees": 12},
    {"plate_id": 2, "correct_answer": 8, "protanopia_sees": 3, "deuteranopia_sees": 3, "tritanopia_sees": 8},
    {"plate_id": 3, "correct_answer": 29, "protanopia_sees": 70, "deuteranopia_sees": 7, "tritanopia_sees": 29},
    {"plate_id": 4, "correct_answer": 5, "protanopia_sees": 2, "deuteranopia_sees": 2, "tritanopia_sees": 5},
    {"plate_id": 5, "correct_answer": 3, "protanopia_sees": 5, "deuteranopia_sees": 5, "tritanopia_sees": 3},
    {"plate_id": 6, "correct_answer": 15, "protanopia_sees": 17, "deuteranopia_sees": 17, "tritanopia_sees": 15},
]


def detect_color_blind_type(quiz_answers: list[dict]) -> dict:
    """Evaluate Ishihara quiz answers to determine color blindness type."""
    scores = {"protanopia": 0.0, "deuteranopia": 0.0, "tritanopia": 0.0, "normal": 0.0}

    for answer in quiz_answers:
        plate = None
        for p in ISHIHARA_PLATES:
            if p["plate_id"] == answer["plate_id"]:
                plate = p
                break
        if not plate:
            continue

        selected = answer.get("selected_number", 0)
        if selected == plate["correct_answer"]:
            scores["normal"] += 2
        elif selected == plate["protanopia_sees"]:
            scores["protanopia"] += 2
            scores["deuteranopia"] += 1
        elif selected == plate["deuteranopia_sees"]:
            scores["deuteranopia"] += 2
            scores["protanopia"] += 1
        elif selected == plate["tritanopia_sees"]:
            scores["tritanopia"] += 2

    best_type = max(scores, key=lambda k: scores[k])
    total = len(quiz_answers) * 2
    confidence = min(1.0, scores[best_type] / total) if total > 0 else 0

    if scores["normal"] > total * 0.6:
        detected_type = "normal"
        severity = "none"
    elif scores[best_type] > total * 0.7:
        severity = "strong"
    elif scores[best_type] > total * 0.4:
        severity = "moderate"
    else:
        severity = "mild"

    return {
        "detected_type": detected_type if severity == "none" else best_type,
        "severity": severity,
        "confidence": round(confidence, 2),
        "score_breakdown": scores,
    }


# ── Custom palette generation ────────────────────────────────────────

def generate_custom_palette(
    cb_type: str, skin_tone_lab: dict, shade_database: list[dict],
) -> list[dict]:
    """Generate a custom color palette based on what the CB user can perceive.

    Strategy:
    - Protanopia/Deuteranopia: sample colors with varied L* and b* (blue-yellow axis)
    - Tritanopia: sample colors with varied L* and a* (red-green axis)
    - Remove colors that look the same to this user (simulated deltaE < 3)
    """
    base_colors = []

    if cb_type in ["protanopia", "deuteranopia"]:
        # User perceives L* (lightness) and b* (blue-yellow) well
        for L in range(20, 90, 10):
            for b in range(-40, 60, 10):
                a = skin_tone_lab.get("a", 12) * 0.5  # anchor near skin
                base_colors.append((L, a, b))
    elif cb_type == "tritanopia":
        # User perceives L* and a* (red-green) well
        for L in range(20, 90, 10):
            for a in range(-30, 50, 10):
                b = skin_tone_lab.get("b", 18) * 0.5  # anchor near skin
                base_colors.append((L, a, b))
    else:
        # Normal vision: full color range
        for L in range(20, 90, 15):
            for a in range(-30, 50, 15):
                for b in range(-40, 60, 15):
                    base_colors.append((L, a, b))

    # Filter: remove colors that look identical to this CB type
    filtered = []
    for color in base_colors:
        simulated = simulate_cb_lab(color, cb_type)
        is_unique = True
        for existing in filtered:
            existing_sim = simulate_cb_lab(existing, cb_type)
            if delta_e_2000(simulated, existing_sim) < 3.0:
                is_unique = False
                break
        if is_unique:
            filtered.append(color)

    # Map to descriptive names and product suggestions
    palette = []
    for lab_color in filtered[:20]:
        hex_color = lab_to_hex(*lab_color)
        simulated_hex = lab_to_hex(*simulate_cb_lab(lab_color, cb_type))
        desc = generate_color_description(lab_color)
        perceivable_desc = generate_color_description(simulate_cb_lab(lab_color, cb_type))

        # Find matching products from database
        suggestions = []
        for shade in shade_database[:5]:
            shade_lab = (shade["lab_l"], shade["lab_a"], shade["lab_b"])
            dE = delta_e_2000(lab_color, shade_lab)
            if dE <= 5:
                suggestions.append({"shade_name": shade["shade_name"], "hex": shade["hex_color"], "delta_e": round(dE, 2)})

        palette.append({
            "hex_color": hex_color,
            "lab_values": {"L": round(lab_color[0], 1), "a": round(lab_color[1], 1), "b": round(lab_color[2], 1)},
            "descriptive_name": desc,
            "perceivable_as": f"您将感知此色为：{perceivable_desc}",
            "simulated_hex": simulated_hex,
            "product_suggestions": suggestions[:3],
        })

    palette.sort(key=lambda p: p["lab_values"]["L"])
    return palette


def simulate_cb_lab(lab: tuple[float, float, float], cb_type: str) -> tuple[float, float, float]:
    """Simulate how a color-blind person perceives a Lab color.

    Simplified: convert Lab→RGB→simulate→Lab.
    """
    r, g, b = lab_to_rgb(*lab)
    sim_r, sim_g, sim_b = simulate_cb_pixel(r, g, b, cb_type)
    return rgb_to_lab(sim_r, sim_g, sim_b)


def generate_color_description(lab: tuple[float, float, float]) -> str:
    """Generate a descriptive color name from Lab values."""
    L, a, b = lab

    if L > 80: light = "极浅/苍白"
    elif L > 60: light = "中浅"
    elif L > 40: light = "中等"
    elif L > 20: light = "深色/浓郁"
    else: light = "极深"

    if a > 15 and b > 20: warmth = "暖色调，带有玫瑰金色底调"
    elif a > 10: warmth = "暖色调，带有粉红色调"
    elif b > 20: warmth = "暖色调，带有金色调"
    elif a < -5 and b < -5: warmth = "冷色调，带有蓝绿色调"
    elif b < -10: warmth = "冷色调，带有蓝色底调"
    elif a < -5: warmth = "冷色调，带有绿色底调"
    else: warmth = "中性色调"

    return f"{light} {warmth}"
