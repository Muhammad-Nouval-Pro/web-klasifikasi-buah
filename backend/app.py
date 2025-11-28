import os
import io
import json
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import tensorflow as tf

app = Flask(__name__)
CORS(app)  # biar bisa diakses dari Vercel (domain berbeda)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MODEL_PATH = os.path.join(BASE_DIR, "fruit_mobilenetv2.keras")
CLASS_NAMES_PATH = os.path.join(BASE_DIR, "class_names.json")

print(f"Loading model from: {MODEL_PATH}")
model = tf.keras.models.load_model(MODEL_PATH)
print("Model loaded.")

print(f"Loading class names from: {CLASS_NAMES_PATH}")
with open(CLASS_NAMES_PATH, "r") as f:
  class_names = json.load(f)
print("Class names:", class_names)

IMG_SIZE = (224, 224)
THRESHOLD = 0.5  # kalau confidence < 0.5 anggap tidak yakin

def preprocess_image(image_bytes):
  img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
  img = img.resize(IMG_SIZE)
  img_array = np.array(img) / 255.0
  img_array = np.expand_dims(img_array, axis=0)
  return img_array

@app.route("/health", methods=["GET"])
def health():
  return jsonify({"status": "ok"})

@app.route("/predict", methods=["POST"])
def predict():
  if "file" not in request.files:
    return jsonify({"error": "No file part in request (pakai field name 'file')."}), 400

  file = request.files["file"]
  if file.filename == "":
    return jsonify({"error": "No file selected."}), 400

  try:
    image_bytes = file.read()
    img_array = preprocess_image(image_bytes)

    preds = model.predict(img_array)
    pred_idx = int(np.argmax(preds[0]))
    confidence = float(preds[0][pred_idx])

    if confidence < THRESHOLD:
      pred_class = "Unknown"
      is_confident = False
    else:
      pred_class = class_names[pred_idx]
      is_confident = True

    return jsonify({
        "predicted_class": pred_class,
        "confidence": confidence,
        "class_names": class_names,
        "is_confident": is_confident,
    })
  except Exception as e:
    return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
  port = int(os.environ.get("PORT", 5000))
  app.run(host="0.0.0.0", port=port, debug=False)
