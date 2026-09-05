/**
 * Three.js AR Face Renderer — real-time 3D makeup overlay on webcam video stream.
 *
 * Architecture (Procreate Face Paint style):
 * 1. Video background plane — renders live webcam feed as scene backdrop
 * 2. Face mesh (BufferGeometry) — built from MediaPipe 468 landmarks, updated each frame
 * 3. UV makeup texture — synthesized by UvMakeupCanvas, applied as material to face mesh
 * 4. Overlay shader — blends makeup texture onto face with soft-light/multiply modes
 *
 * The face mesh tracks the user's face in real-time, and the makeup texture
 * sticks to the face surface, moving naturally with head turns and expressions.
 */

import * as THREE from 'three';
import { FACE_TRIANGULATION, generateCanonicalUVs } from '../face/faceTriangulation';
import { UvMakeupCanvas } from '../face/uvMakeupCanvas';
import { NormalizedLandmark } from '@mediapipe/tasks-vision';

export class ARFaceRenderer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private videoTexture: THREE.VideoTexture;
  private videoPlane: THREE.Mesh;
  private faceMesh: THREE.Mesh | null = null;
  private faceGeometry: THREE.BufferGeometry;
  private uvMakeupCanvas: UvMakeupCanvas;
  private makeupTexture: THREE.CanvasTexture | null = null;
  private makeupMaterial: THREE.ShaderMaterial;
  private container: HTMLElement;
  private videoElement: HTMLVideoElement;
  private width: number;
  private height: number;
  private animFrameId: number | null = null;
  private landmarks: NormalizedLandmark[] = [];
  private currentRegionColors: Record<string, string> = {};

  constructor(container: HTMLElement, videoElement: HTMLVideoElement) {
    this.container = container;
    this.videoElement = videoElement;
    this.width = container.clientWidth || 640;
    this.height = container.clientHeight || 480;

    this.uvMakeupCanvas = new UvMakeupCanvas();

    // ── Scene setup ──────────────────────────────────────────
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.1, 100);
    this.camera.position.z = 2;

    this.renderer = new THREE.WebGLRenderer({
      alpha: true,           // Transparent background (video is separate)
      antialias: true,
      premultipliedAlpha: false,
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);

    // ── Video background plane ───────────────────────────────
    this.videoTexture = new THREE.VideoTexture(videoElement);
    this.videoTexture.minFilter = THREE.LinearFilter;
    this.videoTexture.magFilter = THREE.LinearFilter;

    const videoPlaneGeo = new THREE.PlaneGeometry(4, 3);
    const videoPlaneMat = new THREE.MeshBasicMaterial({
      map: this.videoTexture,
      depthWrite: false,
    });
    this.videoPlane = new THREE.Mesh(videoPlaneGeo, videoPlaneMat);
    this.videoPlane.position.z = -1;
    this.videoPlane.renderOrder = 0;  // Render first (background)
    this.scene.add(this.videoPlane);

    // ── Face mesh geometry ────────────────────────────────────
    this.faceGeometry = new THREE.BufferGeometry();

    // Position buffer: 468 landmarks × 3 components (x, y, z)
    const positions = new Float32Array(468 * 3);
    this.faceGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // UV buffer: canonical face UV coordinates
    const uvs = generateCanonicalUVs();
    this.faceGeometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

    // Index buffer: triangulation
    this.faceGeometry.setIndex(FACE_TRIANGULATION);

    // ── Makeup overlay shader ─────────────────────────────────
    this.makeupMaterial = new THREE.ShaderMaterial({
      uniforms: {
        makeupTexture: { value: null },         // UV makeup canvas texture
        makeupOpacity: { value: 0.0 },          // 0 = no makeup, 1 = full
        skinTone: { value: new THREE.Color(0.83, 0.65, 0.46) },  // Default warm skin #D4A574
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vPosition;

        void main() {
          vUv = uv;
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D makeupTexture;
        uniform float makeupOpacity;
        uniform vec3 skinTone;

        varying vec2 vUv;

        void main() {
          // Sample makeup texture at this UV position
          vec4 makeupColor = texture2D(makeupTexture, vUv);
          float makeupAlpha = makeupColor.a * makeupOpacity;

          // Key design: the face mesh is transparent where there's NO makeup,
          // so the video background plane shows through naturally.
          // Only makeup-colored areas appear as semi-transparent overlays on the face.

          if (makeupAlpha < 0.01) {
            // No makeup at this pixel — make face mesh fully transparent
            // so the live video feed (background plane) shows through
            gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
            return;
          }

          // Use the skin tone as base for blending (not video — video is behind)
          vec3 base = skinTone;
          vec3 makeup = makeupColor.rgb;

          // ── Blend mode: Overlay + Soft-light hybrid ──────────
          // Overlay blend (combines multiply + screen, like Photoshop overlay)
          vec3 overlayBlended;
          for (int i = 0; i < 3; i++) {
            if (base[i] < 0.5) {
              overlayBlended[i] = 2.0 * base[i] * makeup[i];
            } else {
              overlayBlended[i] = 1.0 - 2.0 * (1.0 - base[i]) * (1.0 - makeup[i]);
            }
          }

          // Soft-light blend (gentler, more natural for makeup)
          vec3 softBlended;
          for (int i = 0; i < 3; i++) {
            if (makeup[i] < 0.5) {
              softBlended[i] = base[i] - (1.0 - 2.0 * makeup[i]) * base[i] * (1.0 - base[i]);
            } else {
              softBlended[i] = base[i] + (2.0 * makeup[i] - 1.0) * (sqrt(base[i]) - base[i]);
            }
          }

          // Mix: 70% soft-light for natural cheek/forehead, 30% overlay for lip definition
          vec3 finalBlend = mix(softBlended, overlayBlended, 0.3);

          // Preserve 15% skin texture so makeup doesn't look flat
          vec3 result = mix(base, finalBlend, makeupAlpha);

          gl_FragColor = vec4(result, makeupAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    });

    // ── Create face mesh ──────────────────────────────────────
    this.faceMesh = new THREE.Mesh(this.faceGeometry, this.makeupMaterial);
    this.faceMesh.renderOrder = 1;  // Render after video plane
    this.scene.add(this.faceMesh);

    // ── Start animation loop ──────────────────────────────────
    this.startAnimationLoop();
  }

  // ── Update face mesh from MediaPipe landmarks ──────────────
  updateLandmarks(landmarks: NormalizedLandmark[]): void {
    this.landmarks = landmarks;
    if (!this.faceMesh) return;

    const positions = this.faceGeometry.attributes.position as THREE.BufferAttribute;
    const posArray = positions.array as Float32Array;

    for (let i = 0; i < 468; i++) {
      const lm = landmarks[i];
      // Convert normalized coords (0-1) to Three.js world coords
      // Mirror x for selfie view, center the face
      // Video plane is 4×3 centered at z=-1, face mesh at z=0+
      posArray[i * 3 + 0] = -(lm.x - 0.5) * 2;  // x: centered, mirrored for selfie
      posArray[i * 3 + 1] = -(lm.y - 0.5) * 2;  // y: centered, flipped
      posArray[i * 3 + 2] = -lm.z * 0.5;         // z: depth (small scale for AR overlay)
    }

    positions.needsUpdate = true;
    this.faceGeometry.computeVertexNormals();
  }

  // ── Update UV makeup texture ────────────────────────────────
  updateMakeup(regionColors: Record<string, string>): void {
    this.currentRegionColors = regionColors;

    // Synthesize makeup on UV canvas
    this.uvMakeupCanvas.applyMakeup(regionColors);

    // Convert to Three.js texture
    const textureSource = this.uvMakeupCanvas.toTextureSource();

    if (this.makeupTexture) {
      this.makeupTexture.dispose();
    }

    this.makeupTexture = new THREE.CanvasTexture(textureSource);
    this.makeupTexture.minFilter = THREE.LinearFilter;
    this.makeupTexture.magFilter = THREE.LinearFilter;
    this.makeupTexture.needsUpdate = true;

    // Update shader uniforms
    this.makeupMaterial.uniforms.makeupTexture.value = this.makeupTexture;
    this.makeupMaterial.uniforms.makeupOpacity.value = 1.0;
    this.makeupMaterial.needsUpdate = true;
  }

  // ── Update skin tone (used as shader base for blend) ──────
  updateSkinTone(hex: string): void {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    this.makeupMaterial.uniforms.skinTone.value = new THREE.Color(r, g, b);
  }

  // ── Remove makeup (reset to bare face) ─────────────────────
  clearMakeup(): void {
    this.uvMakeupCanvas.clear();
    this.makeupMaterial.uniforms.makeupOpacity.value = 0.0;
    this.currentRegionColors = {};
  }

  // ── Animation loop ──────────────────────────────────────────
  private startAnimationLoop(): void {
    const animate = () => {
      this.animFrameId = requestAnimationFrame(animate);

      // Update video texture (auto-updates from video element)
      this.videoTexture.needsUpdate = true;

      // Update makeup texture if present
      if (this.makeupTexture) {
        this.makeupTexture.needsUpdate = true;
      }

      // Render scene
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  // ── Resize handler ──────────────────────────────────────────
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  // ── Cleanup ─────────────────────────────────────────────────
  dispose(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }

    this.videoTexture.dispose();
    if (this.makeupTexture) this.makeupTexture.dispose();
    this.faceGeometry.dispose();
    this.makeupMaterial.dispose();
    this.renderer.dispose();

    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
