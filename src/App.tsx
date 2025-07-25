import { useRef } from "react";
import "./App.css";
import { Camera, CameraRef } from "./components/Camera";

function App() {
  const cameraRef = useRef<CameraRef>(null);

  const handleStartCamera = async () => {
    await cameraRef.current?.startCamera();
  };

  const handleStopCamera = () => {
    cameraRef.current?.stopCamera();
  };

  const getCameraStatus = () => {
    const camera = cameraRef.current;
    if (!camera) return;

    console.log("Camera active:", camera.isActive);
    console.log("Camera starting:", camera.isStarting);
    console.log("Camera error:", camera.error);
  };

  const handleTakePicture = async () => {
    try {
      const result = await cameraRef.current?.takePicture();
      console.log("Picture taken:", result);
      // result contains: { decision, reasonCode, image }
    } catch (error) {
      console.error("Failed to take picture:", error);
    }
  };

  const handleReceivingPrediction = ({
    decision,
    reasonCode,
    image,
  }: {
    decision: string;
    reasonCode: string;
    image: string;
  }) => {
    console.log(decision, reasonCode, image);
  };

  return (
    <div className="w-[100vw] h-[100vh] relative">
      <div className="absolute inset-0">
        <Camera
          ref={cameraRef}
          className="w-full h-full object-cover"
          facingMode={"environment"}
          onPrediction={handleReceivingPrediction}
        />
      </div>

      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 z-10">
        <button
          onClick={handleStartCamera}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Start Camera
        </button>
        <button
          onClick={handleStopCamera}
          className="px-4 py-2 bg-red-500 text-white rounded"
        >
          Stop Camera
        </button>
        <button
          onClick={handleTakePicture}
          className="px-4 py-2 bg-purple-600 text-white rounded"
        >
          Take Picture
        </button>
        <button
          onClick={getCameraStatus}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Get Status
        </button>
      </div>
    </div>
  );
}

export default App;
