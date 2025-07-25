# Summary

This is a basic PWA that has real time computer vision capabilities using tflite.

It has a Camera component that runs camera frames though a tflite model and outputs its predictions in real time without blocking the UI thread.

This PWA is installable on phone devices ( it has to be served on a secure https domain )

It exposes a camera component that can be styled with tailwind.

# Camera Props:

className: for styling either using tailwind or giving it a css class.

facingMode:
Sets the camera to either back or front using `environment` or `user`

onPrediction:
A callback that runs everytime a prediction is received in real time.

# Imperative handles:

`cameraRef.current?.startCamera()`

Starts the camera (make sure to accept permissions to use the camera).

`cameraRef.current?.stopCamera()`

Stops the camera

`cameraRef.current?.takePicture()`

Takes the current frame and runs it through the model and retuns a decision object, reasonCode string and the image in `Uint8ClampedArray` format.
