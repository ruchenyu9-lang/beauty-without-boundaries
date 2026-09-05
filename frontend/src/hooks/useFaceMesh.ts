import { useRef, useState, useEffect, useCallback } from 'react';
import { FaceLandmarker, FilesetResolver, NormalizedLandmark } from '@mediapipe/tasks-vision';

/**
 * Hook: Initialize MediaPipe FaceLandmarker and detect 468 3D face landmarks
 * from a video stream in real-time.
 */
export interface FaceMeshResult {
  landmarks: NormalizedLandmark[];       // 468 normalized landmarks (x,y in 0-1, z relative)
  blendshapes: any[];                    // Face blendshapes (expression data)
  transformationMatrix: any;             // Facial transformation matrix
}

export function useFaceMesh() {
  const [landmarks, setLandmarks] = useState<NormalizedLandmark[]>([]);
  const [blendshapes, setBlendshapes] = useState<any[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const lastTimestampRef = useRef(-1);

  // Initialize FaceLandmarker (one-time async)
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm',
        );
        const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
        });
        if (!cancelled) {
          faceLandmarkerRef.current = faceLandmarker;
          setIsLoaded(true);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'FaceLandmarker 初始化失败');
          // Fallback: try CPU delegate
          try {
            const vision = await FilesetResolver.forVisionTasks(
              'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm',
            );
            const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
              baseOptions: {
                modelAssetPath:
                  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
                delegate: 'CPU',
              },
              runningMode: 'VIDEO',
              numFaces: 1,
              outputFaceBlendshapes: true,
              outputFacialTransformationMatrixes: true,
            });
            if (!cancelled) {
              faceLandmarkerRef.current = faceLandmarker;
              setIsLoaded(true);
              setError(null);
            }
          } catch (cpuErr: any) {
            if (!cancelled) setError(cpuErr.message);
          }
        }
      }
    }
    init();

    return () => {
      cancelled = true;
      if (faceLandmarkerRef.current) {
        faceLandmarkerRef.current.close();
        faceLandmarkerRef.current = null;
      }
    };
  }, []);

  // Process a single video frame and update landmarks
  const processFrame = useCallback((videoElement: HTMLVideoElement, timestamp: number) => {
    if (!faceLandmarkerRef.current || !isLoaded) return;

    // MediaPipe requires monotonically increasing timestamps
    if (timestamp <= lastTimestampRef.current) return;
    lastTimestampRef.current = timestamp;

    try {
      const result = faceLandmarkerRef.current.detectForVideo(videoElement, timestamp);
      if (result.faceLandmarks && result.faceLandmarks.length > 0) {
        setLandmarks(result.faceLandmarks[0]);  // 468 landmarks
      }
      if (result.faceBlendshapes && result.faceBlendshapes.length > 0) {
        setBlendshapes(result.faceBlendshapes[0].categories);
      }
    } catch (err) {
      // Silently handle frame processing errors (can happen during init)
    }
  }, [isLoaded]);

  return { landmarks, blendshapes, isLoaded, error, processFrame };
}
