# 5D Hyperspace Fly-Through

A real-time, browser-based exploration of procedurally generated 5D hyperspace slices. This application uses Flask to host a lightweight server and Three.js with WebGL ray-marching to create an immersive experience inspired by the tesseract scene in the movie "Interstellar".

![5D Hyperspace Screenshot](screenshots/hyperspace.jpg)

## Features

- **Real-time ray-marching** of a 5D signed-distance field (SDF) in WebGL/Three.js
- **First-person flight** through five dimensions: X, Y, Z, W (4th), V (5th)
- **Headless deployment** on Raspberry Pi 5 (no monitor/keyboard needed)
- **Optional Coral TPU** support for offloading heavy SDF generation or neural-driven textures

## Prerequisites

### Hardware
- Raspberry Pi 5 running Raspberry Pi OS Bookworm (64-bit)
- Python 3.9+ virtual environment
- (Optional) Coral USB Accelerator with Edge-TPU runtime

### Software
- Flask (`pip install flask`)
- Three.js (served via CDN)
- (Optional) TensorFlow Lite runtime and PyCoral for TPU integration

## Installation