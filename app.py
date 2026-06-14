import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

import streamlit as st

st.set_page_config(
    page_title="TabulaAI",
    page_icon="",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Session state init
if "df" not in st.session_state:
    st.session_state.df = None
if "meta" not in st.session_state:
    st.session_state.meta = None
if "clean_df" not in st.session_state:
    st.session_state.clean_df = None
if "results" not in st.session_state:
    st.session_state.results = None
if "task" not in st.session_state:
    st.session_state.task = None
if "target_col" not in st.session_state:
    st.session_state.target_col = None
if "eda_report" not in st.session_state:
    st.session_state.eda_report = None
if "artifacts" not in st.session_state:
    st.session_state.artifacts = None
if "eda_narrative" not in st.session_state:
    st.session_state.eda_narrative = None
if "model_narrative" not in st.session_state:
    st.session_state.model_narrative = None
if "chat_history" not in st.session_state:
    st.session_state.chat_history = []
if "shap_importance" not in st.session_state:
    st.session_state.shap_importance = None
if "shap_model" not in st.session_state:
    st.session_state.shap_model = None

# Sidebar
with st.sidebar:
    st.title("TabulaAI")
    st.caption("Domain-agnostic conversational data science")
    st.divider()

    uploaded_file = st.file_uploader("Upload any CSV", type=["csv"])

    if uploaded_file:
        from core.loader import load_csv
        from core.preprocessor import preprocess
        from core.eda import generate_eda

        df, meta = load_csv(uploaded_file)
        st.session_state.df = df
        st.session_state.meta = meta

        st.success(f"{df.shape[0]} rows × {df.shape[1]} cols")
        st.caption(f"Suggested tasks: {', '.join(meta.suggested_tasks)}")

        available_tasks = [t for t in meta.suggested_tasks
                           if t in ["classification", "regression"]]
        task = st.radio("Task type", options=available_tasks)
        st.session_state.task = task

        from core.loader import get_targets_for_task
        task_targets = get_targets_for_task(meta.columns, task)

        if not task_targets:
            st.warning("No suitable target columns found for this task.")
        else:
            target = st.selectbox("Select target column", options=task_targets)
            st.session_state.target_col = target

            # Smart recommendation
            col_meta = meta.columns[target]
            if task == "classification":
                if col_meta.n_unique == 2:
                    st.caption(f"{target} is binary — ideal for classification.")
                else:
                    st.caption(f"{target} has {col_meta.n_unique} classes.")
            elif task == "regression":
                st.caption(f"{target} is continuous with {col_meta.n_unique} unique values — good regression target.")

            if st.button("Run Analysis", type="primary"):
                with st.spinner("Fine-tuning models on your data..."):
                    from core.eda import generate_eda
                    from models.finetuner import finetune_models

                    clean_df, artifacts = preprocess(df, meta, target)
                    eda_report = generate_eda(df, meta)
                    results = finetune_models(df, target, task)

                    st.session_state.clean_df = clean_df
                    st.session_state.eda_report = eda_report
                    st.session_state.results = results
                    st.session_state.artifacts = artifacts
                    st.session_state.eda_narrative = None
                    st.session_state.model_narrative = None
                    st.session_state.shap_importance = None
                    st.session_state.shap_model = None
                    st.session_state.chat_history = []

                    # Show best model — exclude suspicious perfect scores
                    model_results = {k: v for k, v in results.items() if not k.startswith("_")}
                    if task == "classification":
                        reliable = {k: v for k, v in model_results.items()
                                    if v["f1_weighted"] < 1.0}
                        if not reliable:
                            best = max(model_results, key=lambda k: model_results[k]["f1_weighted"])
                            st.warning(f"All models show F1 = 1.0 — likely overfitting. {best} selected but scores are not trustworthy.")
                        else:
                            best = max(reliable, key=lambda k: reliable[k]["f1_weighted"])
                            st.info(f"Best model: {best} (F1: {reliable[best]['f1_weighted']})")

                    elif task == "regression":
                        reliable = {k: v for k, v in model_results.items()
                                    if 0 <= v["r2"] <= 0.99}
                        if not reliable:
                            best = max(model_results, key=lambda k: model_results[k]["r2"])
                            st.warning(f"No reliable regression scores found. {best} has highest R² ({model_results[best]['r2']}) but may not be trustworthy.")
                        else:
                            best = max(reliable, key=lambda k: reliable[k]["r2"])
                            st.info(f"Best model: {best} (R²: {reliable[best]['r2']})")

                st.success("Analysis complete!")

    st.divider()
    page = st.radio(
        "Navigate",
        ["Overview", "Ask", "Insights", "Benchmark", "What-If", "Explainability"]
    )

# Page routing
if page == "Overview":
    from ui.tabs.overview import render
    render()
elif page == "Ask":
    from ui.tabs.ask import render
    render()
elif page == "Insights":
    from ui.tabs.insights import render
    render()
elif page == "Benchmark":
    from ui.tabs.benchmark import render
    render()
elif page == "What-If":
    from ui.tabs.whatif import render
    render()
elif page == "Explainability":
    from ui.tabs.explain import render
    render()