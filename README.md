# TabulaAI

A domain-agnostic conversational data science assistant. Upload any CSV, ask questions in plain English, and get ML-powered insights instantly — no data science experience required.

## Overview

TabulaAI automates the full data science workflow on any tabular dataset. It handles preprocessing, trains and benchmarks multiple models, explains predictions, and answers natural language questions about your data — all from a single interface.

The system uses models pretrained on the OpenML-CC18 benchmark suite (67 classification datasets, 5 regression datasets) and fine-tunes them on your uploaded CSV at inference time.

## Features

**Benchmark**
Automatically trains and compares XGBoost, LightGBM, CatBoost, TabPFN, and a Stacking ensemble. Displays a ranked leaderboard with accuracy, F1, R², RMSE, and MAE depending on task type. Flags suspicious scores caused by small datasets.

**Ask**
Natural language interface powered by Groq (Llama 3.1 8B). Ask anything about your data — feature relationships, model behavior, data quality — and get plain English answers grounded in your actual results.

**Insights**
Auto-generated narrative summaries of your dataset and model results. Two tabs: Data Insights (EDA narrative) and Model Insights (result interpretation). Regenerate at any time.

**What-If Analysis**
Adjust input feature values with sliders and see live predictions update instantly. Uses the best-performing reliable model automatically.

**Explainability**
SHAP-based feature importance for XGBoost, LightGBM, and CatBoost. Ranks features by influence on predictions and generates a plain English explanation of the top features via Groq.

## Pretrained Models

Models are pretrained on the OpenML-CC18 benchmark suite using XGBoost, LightGBM, CatBoost, and a Logistic Regression meta-learner for stacking. Pretraining covers 67 classification and 5 regression datasets across diverse domains.

The pretrained model files are hosted on Google Drive. Download and place them in `models/pretrained/` before running the app.

[Download pretrained models from Google Drive](https://drive.google.com/drive/folders/1XZhGlfmHa-EHr8UACkuks9-SMlQCFTkU?usp=sharing)

Files required:
- base_xgb_clf.joblib
- base_lgbm_clf.joblib
- base_cat_clf.joblib
- base_meta_learner.joblib
- base_xgb_reg.joblib
- base_lgbm_reg.joblib
- base_cat_reg.joblib
- base_iso_forest.joblib

## Setup

Clone the repository:

```bash
git clone https://github.com/g245kczb4x-png/tabulaai.git
cd tabulaai
```

Create a virtual environment with Python 3.12:

```bash
python3.12 -m venv venv
source venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Download the pretrained models from the Google Drive link above and place them in `models/pretrained/`.

Add your Groq API key. Get a free key at console.groq.com:

```bash
echo "GROQ_API_KEY=your_key_here" > .env
```

Run the app:

```bash
streamlit run app.py
```

## Project Structure

```
tabulaai/
├── app.py                        # Streamlit entry point
├── core/
│   ├── loader.py                 # CSV ingestion, type detection, task suggestion
│   ├── preprocessor.py           # Encoding, imputation, scaling
│   └── eda.py                    # EDA statistics and correlation
├── models/
│   ├── finetuner.py              # Fine-tuning pipeline for all models
│   └── pretrained/               # Pretrained .joblib files (download separately)
├── intelligence/
│   ├── groq_client.py            # Groq API wrapper
│   ├── router.py                 # NL question to task routing
│   ├── narrator.py               # EDA and result narration
│   └── explainer.py              # SHAP value computation
├── ui/
│   └── tabs/
│       ├── overview.py           # Data overview and EDA charts
│       ├── benchmark.py          # Model leaderboard
│       ├── ask.py                # Natural language Q&A
│       ├── insights.py           # Auto-generated narratives
│       ├── whatif.py             # Live prediction interface
│       └── explain.py            # SHAP explainability
├── requirements.txt
└── .env                          # Groq API key (not committed)
```

## Tech Stack

- ML models: XGBoost, LightGBM, CatBoost, TabPFN, scikit-learn
- Explainability: SHAP
- LLM: Groq API with Llama 3.1 8B
- Frontend: Streamlit, Plotly
- Pretraining data: OpenML-CC18 benchmark suite

## Experimental Protocol

Pretraining uses the OpenML-CC18 benchmark suite. Each dataset is capped at 2,000 rows and padded or truncated to 200 features for a unified input space. Class imbalance is addressed via SMOTE capped at 200,000 rows. Rare classes with fewer than 50 samples are removed before training.

Classification models are evaluated on accuracy, weighted F1, and macro F1. Regression models are evaluated on R², RMSE, and MAE. The stacking ensemble uses a Logistic Regression meta-learner trained on the probability outputs of the three base classifiers.

At inference time, models are fine-tuned on the user's uploaded CSV using the pretrained hyperparameters as initialization. Fine-tuning adds 100 additional estimators per model.

## Notes

- Minimum recommended dataset size: 200 rows for reliable model scores
- Scores of 1.0 on small datasets indicate overfitting, not genuine performance
- Negative R² in regression means the model performs worse than a mean predictor, typically caused by insufficient data
- LightGBM consistently underperforms on small datasets relative to XGBoost and CatBoost
- The Groq API free tier supports approximately 14,400 requests per day, sufficient for normal usage
```



