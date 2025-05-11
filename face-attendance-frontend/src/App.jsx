import React, { useState, useRef, useEffect } from "react";
import axios from "axios";

const FaceApp = () => {
  const [mode, setMode] = useState(null);
  const [name, setName] = useState("");
  const [details, setDetails] = useState("");
  const [message, setMessage] = useState("");
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [imageBlob, setImageBlob] = useState(null);
  const [students, setStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [cameraStream, setCameraStream] = useState(null);

  const startCamera = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoRef.current.srcObject = stream;
    videoRef.current.play();
    setCameraStream(stream);  
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);  
    }
  };

  const captureImage = () => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => setImageBlob(blob), "image/jpeg");
  };

  const handleRegister = async () => {
    if (!name || !details || !imageBlob) {
      return setMessage("Please provide all details and capture image.");
    }

    const formData = new FormData();
    formData.append("faceImage", imageBlob);
    formData.append("name", name);
    formData.append("details", details);

    try {
      const res = await axios.post("http://localhost:3000/register", formData);
      setMessage(res.data);
    } catch (err) {
      setMessage("Registration failed");
    }

    stopCamera();
  };

  const handleAttendance = async () => {
    if (!imageBlob) return setMessage("Please capture image first.");

    const formData = new FormData();
    formData.append("faceImage", imageBlob);

    try {
      const res = await axios.post("http://localhost:3000/mark-attendance", formData);
      setMessage(res.data);
    } catch (err) {
      setMessage("Attendance failed");
    }

    stopCamera();  // Stop the camera once attendance is marked
  };

  const toggleAttendance = (studentId) => {
    if (selectedStudents.includes(studentId)) {
      setSelectedStudents(selectedStudents.filter((id) => id !== studentId));
    } else {
      setSelectedStudents([...selectedStudents, studentId]);
    }
  };

  const fetchStudents = async () => {
    try {
      const res = await axios.get("http://localhost:3000/students");
      setStudents(res.data);
    } catch (err) {
      setMessage("Failed to load students.");
    }
  };

  useEffect(() => {
    if (mode === "manual") {
      fetchStudents();
      stopCamera();  // Stop the camera when in manual mode
    }
  }, [mode]);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  useEffect(() => {
    let stream;

    const startCameraAndAutoSubmit = async () => {
      if (cameraStream) return;  // Prevent multiple camera starts

      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        setTimeout(() => {
          const canvas = canvasRef.current;
          const context = canvas.getContext("2d");
          context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(async (blob) => {
            if (!blob) {
              setMessage("Failed to capture image.");
              return;
            }

            const formData = new FormData();
            formData.append("faceImage", blob);

            try {
              const res = await axios.post("http://localhost:3000/mark-attendance", formData);
              setMessage(res.data);
            } catch (err) {
              setMessage("Attendance failed.");
            }

            // Stop camera after capture
            if (videoRef.current.srcObject) {
              videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
            }
          }, "image/jpeg");
        }, 5000); // Adjust delay if needed
      } catch (err) {
        setMessage("Camera access error.");
      }
    };

    if (mode === "attendance" && !cameraStream) {
      startCameraAndAutoSubmit();
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [mode, cameraStream]);

  const submitManualAttendance = async () => {
    try {
      const res = await axios.post("http://localhost:3000/manual-attendance", {
        studentIds: selectedStudents,
      });
      setMessage(res.data);
      setMode(null);
    } 
    catch (err) {
      setMessage("Failed to mark manual attendance.");
    }
  };

  return (
    <div>
      <h2>Face Recognition System</h2>

      {!mode && (
        <div>
          <button onClick={() => { setMode("register"); }}>Register</button>
          <button onClick={() => { setMode("attendance"); }}>Mark Attendance</button>
          <button onClick={() => { setMode("manual"); }}>Mark Manual</button>
        </div>
      )}

      {mode === "register" && (
        <div>
          <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} /><br />
          <textarea placeholder="Details" value={details} onChange={(e) => setDetails(e.target.value)} /><br />
          <button onClick={startCamera}>Start Camera</button>
          <video ref={videoRef} width="480" height="360" autoPlay muted />
          <canvas ref={canvasRef} width="480" height="360" style={{ display: "none" }} />
          <button onClick={captureImage}>Capture Image</button>
          <button onClick={handleRegister}>Submit Registration</button>
          <button onClick={() => setMode(null)}>Back</button>
        </div>
      )}

      {mode === "attendance" && (
        <div>
          <h3>Face Attendance (Auto Mode)</h3>
          <video ref={videoRef} width="480" height="360" autoPlay muted />
          <canvas ref={canvasRef} width="480" height="360" style={{ display: "none" }} />
          <button onClick={() => setMode(null)}>Back</button>
        </div>
      )}

      {mode === "manual" && (
        <div>
          <h3>Manual Attendance</h3>
          <ul>
            {students.map((student) => (
              <li key={student.face_id}>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedStudents.includes(student.face_id)}
                    onChange={() => toggleAttendance(student.face_id)}
                  />
                  {student.name} - {student.details}
                </label>
              </li>
            ))}
          </ul>
          <button onClick={submitManualAttendance}>Submit Attendance</button>
          <button onClick={() => setMode(null)}>Back</button>
        </div>
      )}

      <p>{message}</p>
    </div>
  );
};

export default FaceApp;
