"""
app.py
------
Flask backend for the Car Price Prediction website.

Routes:
  GET  /            -> renders the frontend (templates/index.html)
  POST /predict      -> accepts JSON {Year, Present_Price, Kms_Driven}
                         and returns the predicted selling price

Local run:
    python app.py
    -> open http://127.0.0.1:5000

Production (e.g. Render) uses gunicorn instead of this file's __main__
block. See Procfile / render.yaml. Render sets the PORT env var, which
is respected below so the same app object works in both cases.
"""

from flask import Flask, request, jsonify, render_template
import joblib
import numpy as np
import os

app = Flask(__name__)

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.pkl")
artifact = joblib.load(MODEL_PATH)
model = artifact["model"]
feature_cols = artifact["feature_cols"]
current_year = artifact["current_year"]


@app.route("/")
def home():
    return render_template("index.html", current_year=current_year)


@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json(force=True)

        year = float(data.get("Year"))
        present_price = float(data.get("Present_Price"))
        kms_driven = float(data.get("Kms_Driven"))

        # Basic validation
        errors = []
        if not (1980 <= year <= current_year):
            errors.append(f"Year must be between 1980 and {current_year}.")
        if present_price <= 0:
            errors.append("Present price must be greater than 0.")
        if kms_driven < 0:
            errors.append("Kms driven cannot be negative.")

        if errors:
            return jsonify({"success": False, "errors": errors}), 400

        X = np.array([[year, present_price, kms_driven]])
        prediction = model.predict(X)[0]
        prediction = round(float(prediction), 2)

        # Never predict a price higher than the present (showroom) price
        prediction = min(prediction, present_price)
        prediction = max(prediction, 0.1)

        return jsonify({
            "success": True,
            "selling_price_lakhs": prediction,
            "selling_price_display": f"₹ {prediction} Lakhs"
        })

    except (TypeError, ValueError):
        return jsonify({
            "success": False,
            "errors": ["Please enter valid numeric values for all fields."]
        }), 400


if __name__ == "__main__":
    # PORT is set automatically by Render; defaults to 5000 for local dev.
    port = int(os.environ.get("PORT", 5000))
    debug_mode = os.environ.get("FLASK_DEBUG", "true").lower() == "true"
    app.run(debug=debug_mode, host="0.0.0.0", port=port)
