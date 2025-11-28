// src/App.jsx
import { useEffect, useRef, useState } from "react";

const BACKEND_URL = "http://localhost:5000"; // ganti kalau backend beda host/port

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [usingCameraPhoto, setUsingCameraPhoto] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // ---------------------------
  // UPLOAD FILE
  // ---------------------------
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setResult(null);
    setError(null);
    setUsingCameraPhoto(false);

    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setSelectedFile(null);
      setPreviewUrl(null);
    }
  };

  // ---------------------------
  // KIRIM FILE KE BACKEND
  // ---------------------------
  const sendToBackend = async (file) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    // HARUS "file" karena backend Flask pakai request.files["file"]
    formData.append("file", file);

    try {
      const res = await fetch(`${BACKEND_URL}/predict`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Request gagal");
      }

      setResult(data);
    } catch (err) {
      setError(err.message || "Terjadi kesalahan saat memproses gambar.");
    } finally {
      setIsLoading(false);
    }
  };

  // ---------------------------
  // HANDLE SUBMIT UPLOAD
  // ---------------------------
  const handleSubmitUpload = async (e) => {
    e.preventDefault();

    if (!selectedFile) {
      setError("Silakan pilih gambar buah terlebih dahulu.");
      return;
    }

    setUsingCameraPhoto(false);
    await sendToBackend(selectedFile);
  };

  // ---------------------------
  // KAMERA: START / STOP
  // ---------------------------
  const startCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError(
        "Browser kamu tidak mendukung akses kamera (getUserMedia). Coba pakai Chrome/Edge terbaru."
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" }, // HP: belakang, PC: webcam
        },
        audio: false,
      });

      const video = videoRef.current;
      if (!video) {
        setError("Video element tidak ditemukan.");
        return;
      }

      video.srcObject = stream;
      streamRef.current = stream;
      setCameraActive(true);
      setCameraReady(false);

      video.onloadedmetadata = () => {
        video.play();
        setCameraReady(true);
      };
    } catch (err) {
      console.error("getUserMedia error:", err);
      setError(
        "Tidak dapat mengakses kamera. Cek izin browser (Allow camera) atau pastikan device punya kamera."
      );
      setCameraActive(false);
      setCameraReady(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setCameraReady(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // ---------------------------
  // KAMERA: CAPTURE + PREDICT
  // ---------------------------
  const capturePhotoAndPredict = async () => {
    if (!cameraActive || !videoRef.current) {
      setError("Kamera belum aktif.");
      return;
    }

    const video = videoRef.current;
    const width = video.videoWidth;
    const height = video.videoHeight;

    if (!width || !height) {
      setError("Video belum siap. Tunggu 1–2 detik lalu coba lagi.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/jpeg");
    setPreviewUrl(dataUrl);
    setUsingCameraPhoto(true);
    setResult(null);
    setError(null);

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg")
    );
    const file = new File([blob], "camera.jpg", { type: "image/jpeg" });

    await sendToBackend(file);
  };

  // ---------------------------
  // RENDER
  // ---------------------------
  return (
    <div className="app-root">
      <header className="app-header">
        <h1>Fruit Image Classifier</h1>
        <p>
          Upload gambar buah atau gunakan kamera untuk menebak nama buah
          tersebut.
        </p>
      </header>

      <main className="app-main">
        {/* PANEL KIRI: Upload + Kamera */}
        <section className="panel panel-left">
          {/* Upload */}
          <div className="card">
            <h2>Upload Gambar</h2>
            <p className="card-subtitle">
              Pilih file gambar buah dari galeri / file explorer.
            </p>

            <form onSubmit={handleSubmitUpload}>
              <label className="field-label">
                <span>Pilih file gambar buah</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </label>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isLoading}
              >
                {isLoading && !usingCameraPhoto
                  ? "Memprediksi..."
                  : "Prediksi dari Upload"}
              </button>
            </form>
          </div>

          {/* Kamera */}
          <div className="card">
            <h2>Kamera</h2>
            <p className="card-subtitle">
              Nyalakan kamera, arahkan ke buah, lalu ambil foto untuk
              diprediksi.
            </p>

            <div className="camera-controls">
              {!cameraActive ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={startCamera}
                >
                  Nyalakan Kamera
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={stopCamera}
                >
                  Matikan Kamera
                </button>
              )}

              <button
                type="button"
                className="btn btn-primary"
                onClick={capturePhotoAndPredict}
                disabled={!cameraReady || isLoading}
              >
                {isLoading && usingCameraPhoto
                  ? "Memprediksi..."
                  : "Ambil Foto & Prediksi"}
              </button>
            </div>

            <div className="camera-frame">
              {/* Video disembunyikan ketika kamera belum aktif,
                  supaya teks placeholder kelihatan penuh di HP */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="camera-video"
                style={{ display: cameraActive ? "block" : "none" }}
              />
              {!cameraActive && (
                <p className="camera-placeholder">
                  Kamera belum aktif. Klik <strong>Nyalakan Kamera</strong> dan
                  izinkan akses kamera di browser.
                </p>
              )}
            </div>

            {!cameraReady && cameraActive && (
              <p className="camera-hint">
                Menyiapkan kamera... tunggu sebentar sebelum mengambil foto.
              </p>
            )}
          </div>
        </section>

        {/* PANEL KANAN: Preview + Hasil */}
        <section className="panel panel-right">
          <div className="card">
            <h2>Preview Gambar</h2>
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Preview"
                className="preview-image"
              />
            ) : (
              <p className="preview-placeholder">
                Belum ada gambar. Upload file atau ambil foto dari kamera.
              </p>
            )}
          </div>

          {error && (
            <div className="card card-error">
              <h3>Error</h3>
              <p>{error}</p>
            </div>
          )}

          {result && (
            <div className="card card-result">
              <h2>Hasil Prediksi</h2>
              <p className="result-main">
                <span className="result-label">Buah:</span>
                <span className="result-value">
                  {result.predicted_class}
                </span>
              </p>
              <p className="result-main">
                <span className="result-label">Confidence:</span>
                <span className="result-value">
                  {(result.confidence * 100).toFixed(2)}%
                  {result.is_confident === false && " (model tidak yakin)"}
                </span>
              </p>

              {Array.isArray(result.class_names) && (
                <div className="result-classes">
                  <span className="result-label">Daftar kelas:</span>
                  <span className="result-classes-list">
                    {result.class_names.join(", ")}
                  </span>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      <footer className="app-footer">
        <span>© {new Date().getFullYear()} Fruit Classifier</span>
      </footer>
    </div>
  );
}

export default App;
