"""Mock Claude service — returns pre-generated data instead of calling external API.

All AI-generated results (makeup looks, image analysis, color translation, etc.)
are replaced with hardcoded mock data so the project runs without any external API key.
"""

import json
from pathlib import Path


class MockClaudeService:
    """Mock implementation that returns pre-generated responses."""

    # ── Feature 1: Makeup look generation ────────────────────────

    @staticmethod
    def _load_mock_makeup_looks() -> dict:
        data_path = Path(__file__).resolve().parents[1] / "data" / "makeup_looks.json"
        with open(data_path, encoding="utf-8") as f:
            product_looks = json.load(f)

        category_meta = {
            "粉底": ("foundation", ["forehead", "nose"], "blend outward", "light"),
            "眼影": ("eyeshadow", ["upper_lid", "crease"], "sweep across", "medium"),
            "腮红": ("blush", ["left_cheek", "right_cheek"], "sweep across", "medium"),
            "口红": ("lipstick", ["lips_upper", "lips_lower"], "press", "medium"),
        }
        intensity_by_style = {
            "natural": "subtle", "subtle": "subtle",
            "glam": "dramatic", "professional": "moderate",
        }

        grouped: dict = {}
        for source in product_looks:
            region_colors: dict = {}
            steps: list = []
            for product in source["products"]:
                product_type, regions, technique, intensity = category_meta.get(
                    product["category"],
                    (product["category"], [], "sweep across", "medium"),
                )
                for region in regions:
                    region_colors[region] = product["colorHex"]
                    steps.append({
                        "step_number": len(steps) + 1,
                        "product_type": product_type,
                        "shade_number": product["shade"],
                        "region": region,
                        "technique": technique,
                        "intensity": intensity,
                        "hex_color": product["colorHex"],
                        "shade_name": product["name"],
                        "brand": product["brand"],
                        "product_name": product["name"],
                    })

            brand_chain = " + ".join(p["brand"] for p in source["products"])
            look = {
                "lookName": source["lookName"],
                "look_name": source["lookName"],
                "description": f"{source['lookName']} · {brand_chain}",
                "style": source["style"],
                "products": source["products"],
                "steps": steps,
                "shade_ids_used": [p["shade"] for p in source["products"]],
                "region_colors": region_colors,
                "overall_intensity": intensity_by_style.get(source["style"], "subtle"),
            }
            grouped.setdefault(source["style"], []).append(look)
        return grouped

    MOCK_MAKEUP_LOOKS = _load_mock_makeup_looks()

    def generate_makeup_looks(
        self, skin_tone_lab: dict, available_shades: list[dict],
        style: str = "natural", occasion: str = "daily", language: str = "zh",
    ) -> dict:
        """Return mock makeup looks based on requested style."""
        looks = self.MOCK_MAKEUP_LOOKS.get(style, self.MOCK_MAKEUP_LOOKS["natural"])
        # Return all 3 looks from the style, or pad with other styles
        result_looks = []
        for s in ["natural", "glam", "professional"]:
            style_looks = self.MOCK_MAKEUP_LOOKS.get(s, [])
            if style_looks:
                result_looks.append(style_looks[0])
        return {"looks": result_looks[:3]}

    # ── Feature 2: Image analysis ────────────────────────────────

    MOCK_ANALYSIS_RESULT = {
        "detected_style": "韩式玻璃肌肤",
        "difficulty_level": "intermediate",
        "suitable_skin_tones": "适合所有肤色，尤其适合偏暖肤色",
        "detected_products": [
            {"type": "foundation", "color_description": "暖米色轻薄底妆", "estimated_hex": "#F5D5B8", "region": "full_face", "finish": "dewy", "apparent_intensity": "light"},
            {"type": "eyeshadow", "color_description": "柔和棕色眼影", "estimated_hex": "#C9A96E", "region": "upper_lid", "finish": "satin", "apparent_intensity": "medium"},
            {"type": "blush", "color_description": "蜜桃色腮红", "estimated_hex": "#E8A87C", "region": "cheek", "finish": "matte", "apparent_intensity": "medium"},
            {"type": "lipstick", "color_description": "温柔玫瑰粉唇色", "estimated_hex": "#D4735E", "region": "lip", "finish": "glossy", "apparent_intensity": "medium"},
        ],
        "color_palette": [
            {"hex": "#F5D5B8", "name": "暖米色"},
            {"hex": "#C9A96E", "name": "柔和棕"},
            {"hex": "#E8A87C", "name": "蜜桃色"},
            {"hex": "#D4735E", "name": "玫瑰粉"},
            {"hex": "#E0C8B0", "name": "奶油白"},
        ],
        "step_instructions": [
            {"step_number": 1, "action": "涂抹轻薄底妆于全脸", "product_type": "foundation", "color_reference": "暖米色", "technique": "blend outward", "tip": "少量多次，用海绵按压更贴合", "warning": "不要一次涂太厚，会显得假面", "duration_estimate": "2-3分钟"},
            {"step_number": 2, "action": "棕色眼影扫在上眼睑", "product_type": "eyeshadow", "color_reference": "柔和棕", "technique": "sweep across", "tip": "从内眼角向外眼角渐变", "warning": "下眼睑不要涂太重", "duration_estimate": "3-4分钟"},
            {"step_number": 3, "action": "蜜桃色腮红扫在颧骨", "product_type": "blush", "color_reference": "蜜桃色", "technique": "sweep across", "tip": "微笑时颧骨最高点为起点", "warning": "腮红量要少，慢慢叠加", "duration_estimate": "1-2分钟"},
            {"step_number": 4, "action": "玫瑰粉唇色涂抹双唇", "product_type": "lipstick", "color_reference": "玫瑰粉", "technique": "press", "tip": "先用唇刷勾勒唇形再填充", "warning": "唇线不要超出自然唇缘", "duration_estimate": "2-3分钟"},
        ],
    }

    def analyze_makeup_image(
        self, image_base64: str, language: str = "zh",
    ) -> dict:
        """Return mock makeup image analysis result."""
        return self.MOCK_ANALYSIS_RESULT

    # ── Feature 3: Color vision ──────────────────────────────────

    MOCK_COLOR_IDENTIFICATION = {
        "identified_colors": [
            {"region": "整体", "hex_color": "#C44569", "lab_values": {"L": 42.5, "a": 28.3, "b": 14.7}, "descriptive_name": "温暖珊瑚粉色，类似成熟蜜桃的柔和质感", "perceivable_descriptions": {"protanopia": "中性金棕色，缺少玫瑰暖意", "deuteranopia": "偏深的金棕色调", "tritanopia": "温暖珊瑚粉色（可正常感知）", "normal": "温暖珊瑚粉色，类似成熟蜜桃"}, "undertone_classification": "warm", "finish_type": "satin"},
            {"region": "底部", "hex_color": "#8B4513", "lab_values": {"L": 35.2, "a": 18.5, "b": 22.3}, "descriptive_name": "深棕色，类似烤焦糖的醇厚质感", "perceivable_descriptions": {"protanopia": "偏灰暗的棕色调", "deuteranopia": "偏暖的棕色调", "tritanopia": "深棕色（可正常感知）", "normal": "深棕色，类似烤焦糖"}, "undertone_classification": "warm", "finish_type": "matte"},
        ],
        "overall_color_story": "温暖秋季色调组合，以珊瑚粉和深棕为主色",
        "warmth_level": "warm",
    }

    def identify_product_color(
        self, image_base64: str, language: str = "zh",
    ) -> dict:
        """Return mock product color identification."""
        return self.MOCK_COLOR_IDENTIFICATION


# ── Singleton ──────────────────────────────────────────────────────
claude_service = MockClaudeService()
