"""Claude API prompt templates for Feature 1: Smart Makeup Generation."""

MAKEUP_GENERATION_SYSTEM_PROMPT = """\
You are a professional makeup artist AI system built for L'Oréal's \
Beauty Without Boundaries (美妆无界) platform.
Your role is to create personalized makeup looks that are:
1. Tailored to the user's specific skin tone (given in CIELAB color values)
2. Using ONLY the products the user already owns (specified by shade number)
3. Appropriate for the requested style and occasion
4. Inclusive and suitable for diverse skin tones and facial features

Key principles:
- Never suggest products the user doesn't have
- Always specify exact shade numbers from the available list
- Provide region-specific color hex values for 3D face mesh overlay rendering
- Consider skin undertone (warm/cool/neutral) when recommending application techniques
- Describe techniques in clear, actionable language
"""

MAKEUP_GENERATION_USER_TEMPLATE = """\
User skin tone: Lab L={L}, a={a}, b={b}
Skin undertone: {undertone}
Desired style: {style}
Occasion: {occasion}

Available products the user owns:
{shade_context}

Generate 3 different makeup looks using ONLY the available products listed above.

For each look, provide:
1. look_name: A creative name for this look
2. description: Brief description of the overall aesthetic
3. style: One of [natural, glam, evening, professional, creative]
4. steps: Array of application steps, each containing:
   - step_number
   - product_type (must match one of the available product types)
   - shade_number (must be one of the available shade numbers)
   - region (forehead/nose/left_cheek/right_cheek/lips_upper/lips_lower/upper_lid/lower_lid/crease/cheekbone/chin)
   - technique (blend outward, pat and build, sweep across, stipple, press, layer)
   - intensity (light/medium/heavy)
5. region_colors: Map of face region → hex color that should appear on the 3D overlay
   Available regions: forehead, nose, left_cheek, right_cheek, upper_lid, lower_lid,
   crease, lips_upper, lips_lower, chin, cheekbone
6. overall_intensity: subtle/moderate/dramatic

IMPORTANT: You may ONLY reference shade numbers from the available products list.
Do not invent or suggest products that are not listed.
"""

MAKEUP_LOOK_SCHEMA = {
    "name": "makeup_looks_output",
    "type": "object",
    "properties": {
        "looks": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "look_name": {"type": "string"},
                    "description": {"type": "string"},
                    "style": {"type": "string"},
                    "steps": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "step_number": {"type": "integer"},
                                "product_type": {"type": "string"},
                                "shade_number": {"type": "string"},
                                "region": {"type": "string"},
                                "technique": {"type": "string"},
                                "intensity": {"type": "string"},
                            },
                            "required": [
                                "step_number", "product_type", "shade_number",
                                "region", "technique", "intensity",
                            ],
                        },
                    },
                    "shade_ids_used": {"type": "array", "items": {"type": "string"}},
                    "region_colors": {
                        "type": "object",
                        "description": "Map of face region name to hex color for 3D overlay",
                    },
                    "overall_intensity": {"type": "string"},
                },
                "required": [
                    "look_name", "description", "steps",
                    "shade_ids_used", "region_colors", "overall_intensity",
                ],
            },
        },
    },
    "required": ["looks"],
}


def format_shade_context(shades: list[dict]) -> str:
    """Format shade data into a readable context string for Claude."""
    lines = []
    for s in shades:
        line = (
            f"- {s['product_type']}: {s['brand']} {s['product_name']} "
            f"{s['shade_name']} ({s['undertone']} {s['shade_number']}, "
            f"Lab: L={s['lab_l']:.1f}, a={s['lab_a']:.1f}, b={s['lab_b']:.1f}, "
            f"{s['hex_color']})"
        )
        lines.append(line)
    return "\n".join(lines)
