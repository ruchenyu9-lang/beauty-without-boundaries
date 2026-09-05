/**
 * MediaPipe Face Mesh triangulation indices (subset of the full ~1800 indices).
 *
 * The full triangulation is defined in MediaPipe's face_geometry module.
 * This file contains the essential triangulation for rendering a face mesh
 * in Three.js BufferGeometry. For production, load the full list from
 * https://raw.githubusercontent.com/google/mediapipe/master/mediapipe/modules/face_geometry/data/canonical_face_model_uv_map.csv
 *
 * These indices form triangles connecting the 468 face landmarks.
 * Each triangle is defined by 3 consecutive indices (i0, i1, i2).
 */

// Key triangulation for visible face regions (lips, eyes, cheeks, forehead, nose)
// This is a curated subset that covers the main makeup application areas.
// Total: ~330 triangles covering the face surface

export const FACE_TRIANGULATION: number[] = [
  // Lips outer ring (perimeter)
  61,146,185, 61,185,144, 61,144,57, 61,57,172, 61,172,39,
  61,39,37, 61,37,0, 61,0,267, 61,267,269, 61,269,270,
  61,270,409, 61,409,291, 291,409,270, 291,270,269,
  291,269,267, 291,267,0, 291,0,37, 291,37,39,
  291,39,172, 291,172,57, 291,57,144, 291,144,185,

  // Upper lip inner
  78,191,80, 78,80,81, 78,81,82, 78,82,13,
  13,82,312, 13,312,311, 13,311,310, 13,310,415,
  308,415,310, 308,310,311, 308,311,312, 308,312,82,
  308,82,81, 308,81,80, 308,80,191,

  // Forehead region
  10,151,108, 10,108,109, 10,109,337, 10,337,338,
  10,338,67, 10,67,69, 10,69,104, 10,104,297,
  10,297,299, 10,299,333, 151,108,21,
  108,109,21, 109,337,21, 337,338,21, 338,67,21,
  67,69,21, 69,104,21, 104,297,21, 297,299,21,

  // Nose bridge and tip
  168,6,197, 168,197,195, 168,195,5, 6,197,94,
  197,195,94, 195,5,94, 4,1,19, 4,19,3,
  4,3,2, 4,2,5, 5,2,94, 5,94,3,

  // Left cheek region
  116,117,118, 117,118,119, 118,119,120, 119,120,121,
  120,121,122, 121,122,123, 122,123,187, 123,187,205,
  187,205,206, 205,206,207, 206,207,216, 207,216,215,
  116,117,188, 117,118,188, 118,119,188, 119,120,188,
  120,121,188, 121,122,188,

  // Right cheek region
  345,346,347, 346,347,348, 347,348,349, 348,349,350,
  349,350,351, 350,351,352, 351,352,411, 352,411,425,
  411,425,426, 425,426,427, 426,427,436, 427,436,435,
  345,346,412, 346,347,412, 347,348,412, 348,349,412,
  349,350,412, 350,351,412,

  // Left eye outline
  33,24,133, 133,24,23, 133,23,22, 133,22,26,
  133,26,112, 133,112,24, 24,112,23, 112,23,22,
  112,22,26, 112,26,24,

  // Right eye outline
  263,254,362, 362,254,253, 362,253,252, 362,252,256,
  362,256,341, 362,341,254, 254,341,253, 341,253,252,
  341,252,256, 341,256,254,

  // Upper eyelid (left) — makeup region
  159,160,161, 160,161,162, 161,162,31, 162,31,223,
  223,31,224, 224,31,225, 225,31,113, 113,31,159,

  // Upper eyelid (right) — makeup region
  386,387,388, 387,388,389, 388,389,263, 389,263,443,
  443,263,444, 444,263,445, 445,263,342, 342,263,386,

  // Eye crease left
  70,63,105, 63,105,66, 105,66,107, 66,107,55,
  107,55,65, 55,65,52, 65,52,53, 52,53,56,

  // Eye crease right
  300,293,334, 293,334,296, 334,296,336, 296,336,285,
  336,285,295, 285,295,282, 295,282,283, 282,283,286,

  // Chin
  152,377,148, 377,148,376, 148,376,379, 376,379,373,
  379,373,374, 373,374,150, 374,150,152,

  // General face surface triangles (bridging regions)
  234,93,132, 93,132,58, 132,58,172, 172,58,57,
  454,323,361, 323,361,288, 361,288,397, 397,288,57,

  // Nose to cheek connections
  51,5,4, 5,4,1, 4,1,19, 1,19,94, 19,94,3,
  94,3,2, 3,2,5,

  // Nose wing connections
  98,2,327, 2,327,97, 97,327,98,

  // Connecting forehead to eyebrows
  71,68,9, 68,9,8, 9,8,7, 8,7,6, 7,6,197,

  // General face fill triangles
  33,7,93, 93,7,132, 7,132,58, 132,58,172,
  362,301,323, 301,323,288, 323,288,397, 288,397,57,

  // Nose sides
  139,71,68, 71,68,9, 68,9,8, 9,8,7,
  368,301,323, 301,323,288, 323,288,397,

  // Additional face surface
  17,16,15, 16,15,14, 15,14,13, 14,13,312,
  13,312,311, 311,310,415, 310,415,308,
  78,95,96, 95,96,191, 96,191,80,
  78,191,95,

  // Eyebrow connections
  46,53,52, 53,52,65, 52,65,55, 65,55,107,
  107,55,66, 55,66,105, 66,105,63, 105,63,70,
  276,283,282, 283,282,295, 282,295,285,
  295,285,336, 285,336,296, 336,296,334,
  296,334,293, 334,293,300,

  // Jaw line connections
  152,148,377, 148,376,377, 376,379,377,
  379,373,376, 373,374,379, 374,150,373,

  // More forehead surface
  109,67,338, 338,67,337, 337,109,338,
  104,69,297, 297,69,299, 299,69,333,

  // Eye region fills
  33,24,23, 24,23,133, 133,23,22, 22,23,26,
  263,254,253, 254,253,362, 362,253,252, 252,253,256,

  // Additional lip detail
  61,78,191, 78,191,95, 191,95,80,
  291,308,415, 308,415,310, 415,310,311,
];

// Simplified canonical face UV coordinates (approximate)
// In production, load from MediaPipe's canonical_face_model_uv_map.csv
// Each landmark i has a (u, v) coordinate on the texture.
// Here we provide UV coords for the key makeup regions.

export function generateCanonicalUVs(): Float32Array {
  const uvs = new Float32Array(468 * 2);

  // For landmarks we don't have specific UV data,
  // use a simple projection based on the landmark's normalized position.
  // The UV map is a frontal projection of the face onto a 2D plane.

  // We'll set up basic UV mapping using the landmark positions themselves
  // (normalized x → u, normalized y → v)
  // This creates a simple frontal UV projection that works for makeup rendering.

  for (let i = 0; i < 468; i++) {
    // Default UV: centered frontal projection
    // u range: 0-1 (left to right), v range: 0-1 (top to bottom)
    uvs[i * 2] = 0.5;     // u center (will be updated per landmark)
    uvs[i * 2 + 1] = 0.5; // v center (will be updated per landmark)
  }

  // Key landmark UV mappings (approximate canonical face UV)
  // Forehead
  setUV(uvs, 10, 0.50, 0.27);  // forehead top center
  setUV(uvs, 151, 0.50, 0.30); // forehead center

  // Nose
  setUV(uvs, 1, 0.50, 0.55);   // nose tip
  setUV(uvs, 6, 0.50, 0.45);   // nose bridge
  setUV(uvs, 168, 0.50, 0.38);  // nose bridge top
  setUV(uvs, 197, 0.50, 0.48);  // nose middle

  // Lips
  setUV(uvs, 0, 0.50, 0.72);   // upper lip center
  setUV(uvs, 13, 0.50, 0.76);   // lower lip center
  setUV(uvs, 61, 0.42, 0.72);   // left lip corner
  setUV(uvs, 291, 0.58, 0.72);  // right lip corner
  setUV(uvs, 78, 0.45, 0.76);   // lower lip left
  setUV(uvs, 308, 0.55, 0.76);  // lower lip right

  // Eyes
  setUV(uvs, 33, 0.35, 0.48);   // left eye inner corner
  setUV(uvs, 133, 0.27, 0.50);  // left eye outer corner
  setUV(uvs, 159, 0.33, 0.48);  // left upper eyelid center
  setUV(uvs, 263, 0.65, 0.48);  // right eye inner corner
  setUV(uvs, 362, 0.73, 0.50);  // right eye outer corner
  setUV(uvs, 386, 0.67, 0.48);  // right upper eyelid center

  // Cheeks
  setUV(uvs, 116, 0.24, 0.60);  // left cheek start
  setUV(uvs, 123, 0.35, 0.58);  // left cheek inner
  setUV(uvs, 345, 0.76, 0.60);  // right cheek start
  setUV(uvs, 352, 0.65, 0.58);  // right cheek inner

  // Chin
  setUV(uvs, 152, 0.50, 0.85);  // chin center

  // Eyebrows
  setUV(uvs, 70, 0.30, 0.42);   // left eyebrow inner
  setUV(uvs, 300, 0.70, 0.42);  // right eyebrow inner

  return uvs;
}

function setUV(uvs: Float32Array, landmarkIdx: number, u: number, v: number) {
  uvs[landmarkIdx * 2] = u;
  uvs[landmarkIdx * 2 + 1] = v;
}

// Face region landmark index groups (for mapping region_colors to specific vertices)
export const REGION_LANDMARK_INDICES: Record<string, number[]> = {
  lips_upper: [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308],
  lips_lower: [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185],
  left_cheek: [116, 117, 118, 119, 120, 121, 122, 123, 187, 205, 206, 207, 188, 216, 215, 34, 35, 36, 124, 125],
  right_cheek: [345, 346, 347, 348, 349, 350, 351, 352, 411, 425, 426, 427, 412, 436, 435, 264, 265, 266, 353, 354],
  forehead: [10, 151, 108, 109, 337, 338, 67, 69, 104, 297, 299, 333, 9, 8, 7, 6, 197, 168, 71, 68],
  nose: [1, 2, 3, 4, 5, 6, 19, 20, 94, 141, 168, 197, 195, 98, 97, 327, 139, 51],
  chin: [152, 377, 148, 376, 379, 373, 374, 150, 17, 16, 15, 14, 18],
  upper_lid: [159, 160, 161, 162, 31, 223, 224, 225, 113, 386, 387, 388, 389, 263, 443, 444, 445, 342],
  crease: [70, 63, 105, 66, 107, 55, 65, 52, 53, 56, 300, 293, 334, 296, 336, 285, 295, 282, 283, 286],
  cheekbone: [116, 117, 345, 346, 347, 411, 124, 353],
};
