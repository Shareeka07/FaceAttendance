const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2');
const faceapi = require('face-api.js');
const canvas = require('canvas');
const cors = require('cors');
require('dotenv').config();
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Patch face-api with canvas
const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

const app = express();
app.use(cors());
app.use(express.json());

// Setup Multer for file uploads
const upload = multer({ dest: 'uploads/' });

// MySQL DB Connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'attendance'
});
db.connect();

// Load FaceAPI models from disk
const MODEL_PATH = './models';
Promise.all([
  faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_PATH),
  faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_PATH),
  faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_PATH)
]).then(() => console.log('✅ FaceAPI models loaded'));

// 📌 Register face endpoint
app.post('/register', upload.single('faceImage'), async (req, res) => {
  const { name, details } = req.body;

  try {

    
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'face-images',
    });

    const imageUrl = result.secure_url;

    // Now load the image from Cloudinary for face recognition
    const image = await canvas.loadImage(imageUrl);

    const detection = await faceapi
      .detectSingleFace(image)
      .withFaceLandmarks()
      .withFaceDescriptor();

    fs.unlinkSync(req.file.path); // delete uploaded image

    if (!detection) return res.send('No face detected');

    const descriptor = JSON.stringify(Array.from(detection.descriptor));

    db.query(
      'INSERT INTO faces (name, details, descriptor) VALUES (?, ?, ?)',
      [name, details, descriptor],
      (err) => {
        if (err) return res.status(500).send('Database error: ' + err.message);
        res.send('✅ Face registered successfully');
      }
    );
  } catch (error) {
    res.status(500).send('Internal server error: ' + error.message);
  }
});

// 📌 Mark attendance endpoint
app.post('/mark-attendance', upload.single('faceImage'), async (req, res) => {
  try {
    const imagePath = path.join(__dirname, req.file.path);
    const image = await canvas.loadImage(imagePath);

    const detection = await faceapi
      .detectSingleFace(image)
      .withFaceLandmarks()
      .withFaceDescriptor();

    fs.unlinkSync(imagePath); 

    if (!detection) return res.send(`❌ No face detected`);

    const descriptor = detection.descriptor;

    db.query('SELECT * FROM faces', (err, rows) => {
      if (err) return res.status(500).send('Database error: ' + err.message);

      let bestMatch = null;
      let bestDistance = Infinity;

      for (let face of rows) {
        try {
          const storedArray = JSON.parse(face.descriptor);

          if (!Array.isArray(storedArray) || storedArray.length !== 128) {
            console.warn(`Invalid descriptor for face ID ${face.face_id}`);
            continue;
          }

          const storedDesc = new Float32Array(storedArray);
          const distance = faceapi.euclideanDistance(descriptor, storedDesc);

          if (distance < 0.6 && distance < bestDistance) {
            bestDistance = distance;
            bestMatch = face;
          }
        } catch (parseError) {
          console.warn(`Failed to parse descriptor for face ID ${face.id}`, parseError);
        }
      }

      if (!bestMatch) return res.send(`❌ Face not recognized`);

      const today = new Date().toISOString().split('T')[0];
      db.query(
        'INSERT INTO attendance (face_id, date) VALUES (?, ?)',
        [bestMatch.face_id, today],
        (err2) => {
          if (err2) return res.status(500).send('Error marking attendance: ' + err2.message);
          res.send(`✅ Attendance marked for ${bestMatch.name} (distance: ${bestDistance.toFixed(4)})`);
        }
      );
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('❌ Internal server error: ' + error.message);
  }
});
// 📌 Get all registered students
app.get('/students', (req, res) => {
  db.query('SELECT face_id, name, details FROM faces', (err, results) => {
    if (err) return res.status(500).send('Database error: ' + err.message);
    res.json(results);
  });
});

// 📌 Submit manual attendance
app.post('/manual-attendance', (req, res) => {
  const { studentIds } = req.body;
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    return res.status(400).send('No students selected');
  }
  console.log(studentIds);

  const today = new Date().toISOString().split('T')[0];
  const values = studentIds.map(id => [id, today]);

  db.query(
    'INSERT INTO attendance (face_id, date) VALUES ?',
    [values],
    (err) => {
      if (err) return res.status(500).send('Error saving attendance: ' + err.message);
      res.send('✅ Manual attendance submitted');
    }
  );
});




app.listen(3000, () => console.log('🚀 Server running on port 3000'));
