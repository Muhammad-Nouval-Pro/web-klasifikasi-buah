import io
import json
import os

import numpy as np
from PIL import Image
from flask import Flask, jsonify, request
from flask_cors import CORS
import keras  # <-- pakai keras langsung

# ------------------------------------------------
# KONFIGURASI DASAR
# ------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "fruit_mobilenetv2.keras")
CLASS_NAMES_PATH = os.path.join(BASE_DIR, "class_names.json")

IMG_SIZE = 224  # harus sama dengan saat training


# ------------------------------------------------
# INISIALISASI FLASK APP
# ------------------------------------------------
app = Flask(__name__)
CORS(app)


# ------------------------------------------------
# LOAD MODEL & CLASS NAMES SAAT SERVER START
# ------------------------------------------------
print("Loading model from:", MODEL_PATH)
# PENTING: pakai keras.saving.load_model untuk file .keras (Keras 3)
model = keras.saving.load_model(MODEL_PATH)
print("Model loaded.")

print("Loading class names from:", CLASS_NAMES_PATH)
with open(CLASS_NAMES_PATH, "r") as f:
    class_names = json.load(f)
print("Class names:", class_names)


# ------------------------------------------------
# FUNGSI HELPER UNTUK PREPROCESS GAMBAR
# ------------------------------------------------
def preprocess_image(image_bytes):
    """
    image_bytes: raw bytes dari file gambar yang diupload
    return: numpy array shape (1, IMG_SIZE, IMG_SIZE, 3) dengan nilai [0,1]
    """
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize((IMG_SIZE, IMG_SIZE))

    img_array = np.array(img).astype("float32") / 255.0
    img_array = np.expand_dims(img_array, axis=0)

    return img_array


# ------------------------------------------------
# ROUTES
# ------------------------------------------------
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/predict", methods=["POST"])
def predict():
    if "file" not in request.files:
        return jsonify({
            "error": "No file part in the request. Gunakan field name 'file'."
        }), 400

    file = request.files["file"]

    if file.filename == "":
        return jsonify({"error": "No file selected."}), 400

    try:
        image_bytes = file.read()
        img_array = preprocess_image(image_bytes)

        preds = model.predict(img_array)
        pred_idx = int(np.argmax(preds[0]))
        confidence = float(preds[0][pred_idx])
        pred_class = class_names[pred_idx]

        return jsonify({
            "predicted_class": pred_class,
            "confidence": confidence,
            "class_names": class_names
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ------------------------------------------------
# MAIN
# ------------------------------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
