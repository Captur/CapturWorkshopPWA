import {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";

const MODEL_PATH =
  "/production_package_small_delivery_0_1_0_image_artifacts_1_0_4_image_quality_package_delivery_1_0_0.tflite";
const MODEL_WIDTH = 256;
const MODEL_HEIGHT = 341;

export interface CameraRef {
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  isActive: boolean;
  isStarting: boolean;
  error: string | null;
}

export interface CameraProps {
  className?: string;
  facingMode: MediaTrackConstraintSet["facingMode"];
  onPrediction?: ({
    decision,
    reasonCode,
    image,
  }: {
    decision: string;
    reasonCode: string;
    image: string;
  }) => void;
}

export const Camera = forwardRef<CameraRef, CameraProps>((props, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);

  const startCamera = async () => {
    setCameraStarting(true);
    setCameraError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: props.facingMode ? props.facingMode : "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      setCameraError(
        error instanceof Error
          ? error.message
          : "Failed to access camera. Please check permissions."
      );
    } finally {
      setCameraStarting(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraActive(false);
  };

  useImperativeHandle(ref, () => ({
    startCamera,
    stopCamera,
    isActive: cameraActive,
    isStarting: cameraStarting,
    error: cameraError,
  }));

  useEffect(() => {
    if (!cameraActive) return;

    let worker: Worker;
    let isLooping = false;
    let shouldContinuePredictions = false;

    async function initWorker() {
      worker = new Worker("/worker.js", { type: "classic" });
      await new Promise<void>((resolve, reject) => {
        worker.onmessage = (e) => {
          if (e.data.type === "init-done") resolve();
          if (e.data.type === "error") reject(new Error(e.data.error));
        };
        worker.postMessage({ type: "init", modelPath: MODEL_PATH });
      });
    }

    async function predictLoop() {
      if (!videoRef.current || isLooping || !cameraActive) return;

      const video = videoRef.current;

      if (video.readyState < 2) {
        shouldContinuePredictions = false;
        isLooping = false;
        return;
      }

      if (!shouldContinuePredictions) {
        isLooping = false;
        return;
      }

      isLooping = true;

      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;

      const videoAspectRatio = videoWidth / videoHeight;
      const modelAspectRatio = MODEL_WIDTH / MODEL_HEIGHT;

      let resizeWidth: number;
      let resizeHeight: number;

      if (videoAspectRatio > modelAspectRatio) {
        resizeWidth = MODEL_WIDTH;
        resizeHeight = Math.round(MODEL_WIDTH / videoAspectRatio);
      } else {
        resizeHeight = MODEL_HEIGHT;
        resizeWidth = Math.round(MODEL_HEIGHT * videoAspectRatio);
      }

      try {
        const bitmap = await createImageBitmap(video, {
          resizeWidth,
          resizeHeight,
          resizeQuality: "high",
        });

        worker.postMessage(
          {
            type: "predict",
            bitmap,
            width: MODEL_WIDTH,
            height: MODEL_HEIGHT,
          },
          [bitmap]
        );
      } catch (error) {
        console.error("Error creating bitmap:", error);
        isLooping = false;
      }
    }

    async function main() {
      try {
        await initWorker();
        shouldContinuePredictions = true;

        worker.onmessage = (e) => {
          if (e.data.type === "prediction") {
            const decision = e.data.decision;
            const image = e.data.originalImage;
            const reasonCode = decision.reasonCode;

            props.onPrediction?.({
              decision,
              reasonCode,
              image,
            });

            console.log(reasonCode);

            isLooping = false;

            if (shouldContinuePredictions) {
              setTimeout(predictLoop, 30);
            }
          }
        };

        predictLoop();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        console.error(err);
      }
    }

    if (cameraActive) {
      main();
    }

    return () => {
      shouldContinuePredictions = false;
      if (worker) worker.terminate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraActive]);

  return (
    <video
      ref={videoRef}
      autoPlay
      controls={false}
      muted
      playsInline
      className={props.className}
    />
  );
});

Camera.displayName = "Camera";
