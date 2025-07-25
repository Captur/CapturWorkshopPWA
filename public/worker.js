importScripts(
  "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-core",
  "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs/dist/tf.min.js",
  "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm/dist/tf-backend-wasm.js",
  "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-tflite/dist/tf-tflite.min.js"
);

let tfliteModel = null;

const CLASSES = [
  "unit_number_or_character_visible",
  "package_visible",
  "dropoff_location_visible",
  "person_visible",
  "face",
  "reflection",
  "animal",
  "too_dark",
  "blur",
  "normal_image_quality",
];

const decisionArray = [
  {
    title: "Too dark",
    reasonCode: "too_dark",
    description: "⚡ Increase the light",
    conditions: ["too_dark==true"],
    decisionValue: "insufficientInformation",
    orderNumber: 1,
  },
  {
    title: "None visible",
    reasonCode:
      "package_not_visible_and_dropoff_location_not_visible_and_address_not_visible",
    description: "Point to the package, dropoff location, and address",
    conditions: [
      "unit_number_or_character_visible==false&&package_visible==false&&dropoff_location_visible==false",
    ],
    decisionValue: "insufficientInformation",
    orderNumber: 2,
  },
  {
    title: "Only package visible",
    reasonCode:
      "package_visible_and_dropoff_location_not_visible_and_address_not_visible",
    description: "Include the dropoff location, and address, if possible",
    conditions: [
      "package_visible==true&&dropoff_location_visible==false&&unit_number_or_character_visible==false",
    ],
    decisionValue: "insufficientInformation",
    orderNumber: 3,
  },
  {
    title: "Only dropoff location visible",
    reasonCode:
      "package_not_visible_and_dropoff_location_visible_and_address_not_visible",
    description: "Include the package and address if possible",
    conditions: [
      "package_visible==false&&dropoff_location_visible==true&&unit_number_or_character_visible==false",
    ],
    decisionValue: "insufficientInformation",
    orderNumber: 4,
  },
  {
    title: "Only address visible",
    reasonCode:
      "package_not_visible_and_dropoff_location_not_visible_and_address_visible",
    description: "Include the package and dropoff location if possible",
    conditions: [
      "package_visible==false&&dropoff_location_visible==false&&unit_number_or_character_visible==true",
    ],
    decisionValue: "insufficientInformation",
    orderNumber: 5,
  },
  {
    title: "Only Package not visible",
    reasonCode:
      "package_not_visible_and_dropoff_location_visible_and_address_visible",
    description: "Include the package in the image",
    conditions: [
      "package_visible==false&&unit_number_or_character_visible==true&&dropoff_location_visible==true",
    ],
    decisionValue: "insufficientInformation",
    orderNumber: 6,
  },
  {
    title: "Only dropoff location not visible",
    reasonCode:
      "package_visible_and_dropoff_location_not_visible_and_address_visible",
    description: "Include dropoff location if possible",
    conditions: [
      "package_visible==true&&dropoff_location_visible==false&&unit_number_or_character_visible==true",
    ],
    decisionValue: "insufficientInformation",
    orderNumber: 7,
  },
  {
    title: "Only address not visible",
    reasonCode:
      "package_visible_and_dropoff_location_visible_and_address_not_visible",
    description: "Include address if possible",
    conditions: [
      "package_visible==true&&dropoff_location_visible==true&&unit_number_or_character_visible==false",
    ],
    decisionValue: "insufficientInformation",
    orderNumber: 8,
  },
  {
    title: "✅ All visible",
    reasonCode:
      "package_visible_and_dropoff_location_visible_and_address_visible",
    description: "Package, address, and drop-off location are visible",
    conditions: [
      "package_visible==true&&dropoff_location_visible==true&&unit_number_or_character_visible==true",
    ],
    decisionValue: "insufficientInformation",
    orderNumber: 9,
  },
  {
    title: "No clear decision",
    reasonCode: "no_clear_decision",
    description: "Unable to assess the photo with positive delivery decision",
    conditions: ["decision_default"],
    decisionValue: "insufficientInformation",
    orderNumber: 10,
  },
];

onmessage = async (e) => {
  try {
    if (e.data.type === "init") {
      tflite.setWasmPath(
        "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-tflite/dist/"
      );
      await tf.setBackend("wasm");
      await tf.ready();
      tfliteModel = await tflite.loadTFLiteModel(e.data.modelPath, {
        numThreads: -1,
      });
      postMessage({ type: "init-done" });
    } else if (e.data.type === "video-not-playing") {
      console.log(
        `Video is not playing - reason: ${e.data.reason}. Skipping predictions.`
      );
    } else if (e.data.type === "predict" && tfliteModel) {
      const { bitmap, width, height } = e.data;

      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(bitmap, 0, 0);
      const originalImageData = ctx.getImageData(
        0,
        0,
        bitmap.width,
        bitmap.height
      );

      const outputTensor = tf.tidy(() => {
        const img = tf.browser.fromPixels(bitmap);
        const input = tf.image.resizeBilinear(img, [height, width]);
        const batched = tf.expandDims(input, 0);
        const casted = tf.cast(batched, "int32");
        return tfliteModel.predict(casted);
      });

      const scores = await tf.squeeze(outputTensor).array();
      const predictionSummary = getPredictionSummary(
        scores
          .map((c, i) => ({
            name: CLASSES[i],
            confidence: c,
          }))
          .sort((a, b) => b.confidence - a.confidence)
      );

      const decision = getDecision({
        predictionSummary,
        decisionArray,
      });

      outputTensor.dispose();
      bitmap.close();

      postMessage({
        type: "prediction",
        decision,
        originalImage: {
          data: originalImageData.data,
          width: originalImageData.width,
          height: originalImageData.height,
        },
      });
    }
  } catch (error) {
    console.error(error);
    postMessage({ type: "error", error: error.message });
  }
};

const getPredictionSummary = (predictions) => {
  if (!predictions) return [];

  const predictionSummary = predictions.map((prediction) => {
    return `${prediction.name}==${prediction.confidence >= 0.5}`;
  });

  return predictionSummary;
};

const getDecision = ({ predictionSummary, decisionArray }) => {
  const decisionArraySorted = decisionArray.sort(
    (a, b) => a.orderNumber - b.orderNumber
  );

  for (const decisionArrayItem of decisionArraySorted) {
    for (const condition of decisionArrayItem.conditions) {
      if (condition.includes("&&")) {
        const subConditions = condition.split("&&");
        if (subConditions.every((sc) => predictionSummary.includes(sc))) {
          return { ...decisionArrayItem, conditions: [condition] };
        }
      } else if (predictionSummary.includes(condition)) {
        return { ...decisionArrayItem, conditions: [condition] };
      }
    }
  }

  return decisionArraySorted[decisionArraySorted.length - 1];
};
