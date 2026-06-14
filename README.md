# 🧠 TabulaAI

A domain-agnostic conversational data science assistant. Upload any CSV, ask questions in plain English, and get ML-powered insights instantly.

## Features
- 🏆 **Benchmark** — Auto-trains XGBoost, LightGBM, CatBoost, TabPFN + Stacking ensemble
- 💬 **Ask** — Natural language questions about your data powered by Groq (Llama 3.1 8B)
- 📖 **Insights** — Auto-generated plain English narratives about your data and model results
- 🔍 **What-If** — Live predictions as you adjust input values
- 🔬 **Explainability** — SHAP feature importance for every model

## Pretrained Models
Models are pretrained on OpenML-CC18 benchmark (67 classification + 5 regression datasets).

📥 [Download pretrained models from Google Drive](YOUR_GOOGLE_DRIVE_LINK_HERE)

Place downloaded `.joblib` files in `models/pretrained/`.

## Setup

```bash
# Clone repo
git clone https://github.com/YOUR_USERNAME/tabulaai.git
cd tabulaai

# Create virtual environment
python3.12 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Add your Groq API key
echo "GROQ_API_KEY=your_key_here" > .env

# Run
streamlit run app.py
```

## Tech Stack
- **ML**: XGBoost, LightGBM, CatBoost, TabPFN, SHAP
- **LLM**: Groq API (Llama 3.1 8B)
- **Frontend**: Streamlit + Plotly
- **Pretraining**: OpenML-CC18 benchmark (72 datasets)
