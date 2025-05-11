# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript and enable type-aware lint rules. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.


Absolutely! Let’s go step by step to clearly understand how **face recognition** works in your code:

---

## 🔍 What You're Doing

You're building a **face recognition-based attendance system** using:

* `face-api.js` (for face detection & recognition)
* `canvas` (to work with images in Node.js)
* `multer` (for handling image uploads)
* `MySQL` (to store face descriptors and attendance)

There are **two main operations**:

1. **Registering a face**
2. **Recognizing a face to mark attendance**

---

## ✅ 1. **Registering a Face**

### Endpoint: `POST /register`

### 🔁 Flow:

```text
Frontend sends name, details, and face image (as a blob)
        ↓
Multer stores the image temporarily in `uploads/`
        ↓
canvas.loadImage() loads that image into memory
        ↓
face-api.js processes the image:
   - Detects the face
   - Finds 68 landmarks on the face (eyes, nose, etc.)
   - Extracts a 128-value descriptor (unique representation of the face)
        ↓
Descriptor is stored in the DB as a string
```

### 🔬 Code that extracts the descriptor:

```js
const detection = await faceapi
  .detectSingleFace(image)
  .withFaceLandmarks()
  .withFaceDescriptor();
```

* `detection.descriptor` is a `Float32Array(128)`
* This is your **face signature** (like a fingerprint)
* It's converted to JSON and stored:

```js
const descriptor = JSON.stringify(Array.from(detection.descriptor));
```

So your database ends up storing:

```text
face_id | name | details | descriptor (array of 128 floats as string)
```

---

## 🧠 2. **Recognizing a Face & Marking Attendance**

### Endpoint: `POST /mark-attendance`

### 🔁 Flow:

```text
Frontend sends a new image blob
        ↓
Multer saves it in `uploads/`
        ↓
canvas loads it
        ↓
face-api.js extracts the descriptor again (from the new image)
        ↓
Compare new descriptor with ALL stored descriptors
        ↓
If match (distance < 0.6), mark attendance in MySQL
```

### 💡 How matching works:

```js
faceapi.euclideanDistance(descriptor1, descriptor2);
```

* This function returns how "close" two faces are.
* Smaller value = more similar
* A **threshold of 0.6** is used (commonly accepted limit)

### Matching logic:

```js
if (distance < 0.6 && distance < bestDistance) {
  bestDistance = distance;
  bestMatch = face;
}
```

So:

* It loops through all registered faces.
* Compares descriptors.
* Picks the best match (if under 0.6 distance).
* If found, inserts attendance record for today.

---

## 🧾 Final Output Example:

```text
✅ Attendance marked for John Doe (distance: 0.4532)
```

If no match:

```text
❌ Face not recognized
```

---

## 🧠 Summary

| Stage        | What Happens                                                               |
| ------------ | -------------------------------------------------------------------------- |
| Registration | Face is detected → Descriptor is extracted → Saved to DB                   |
| Recognition  | Face is detected → Descriptor is extracted → Compared to DB → Match → Mark |

---
Yes, absolutely — **`face-api.js` relies on deep learning models** to perform face detection, landmark detection, and face recognition.

---

## ✅ Models Used in Your Code

In your code, you're loading **three models**:

```js
await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_PATH);
await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_PATH);
await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_PATH);
```

Let’s break them down:

### 1. `ssdMobilenetv1` – Face Detection Model

* Full name: **Single Shot MultiBox Detector** based on **MobileNetV1**
* Purpose: Finds faces in the image (returns bounding boxes).
* It’s fast and reasonably accurate.
* Input: An image
* Output: Coordinates of detected face(s)

---

### 2. `faceLandmark68Net` – Landmark Detection Model

* Finds **68 key points** on the face (eyes, nose, mouth, jawline).
* Required for improving alignment before face recognition.
* Useful for extracting features or making sure the face is straight.

---

### 3. `faceRecognitionNet` – Face Descriptor Model

* Core of the recognition system.
* Converts a face into a **128-dimensional vector**.
* These vectors (called **descriptors**) represent the unique facial structure.
* Matching is done by calculating **Euclidean distance** between two such vectors.

---

## 📁 What Do You Need?

These model files must exist inside your `./models/` folder:

```
models/
│
├── face_recognition_model-weights_manifest.json
├── face_recognition_model-shard1
├── ssd_mobilenetv1_model-weights_manifest.json
├── ssd_mobilenetv1_model-shard1
├── face_landmark_68_model-weights_manifest.json
├── face_landmark_68_model-shard1
```



