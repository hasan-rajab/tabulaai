import streamlit as st
import plotly.express as px
import pandas as pd
import numpy as np
from intelligence.explainer import get_shap_values, get_feature_importance

def render():
    st.title("🔬 Explainability")

    if st.session_state.results is None:
        st.info("Run analysis from the sidebar first.")
        return

    results  = st.session_state.results
    task     = st.session_state.task
    target   = st.session_state.target_col

    model_names = [k for k in results.keys()
                   if not k.startswith("_") and k not in ["Stacking", "TabPFN"]]

    selected_model = st.selectbox("Select model to explain", model_names)
    model = results[selected_model]["model"]
    X_val = results["_val"]["X_val"]
    feature_names = list(X_val.columns)

    if st.button("Generate SHAP Explanation", type="primary"):
        with st.spinner(f"Computing SHAP values for {selected_model}..."):
            explainer, shap_values = get_shap_values(
                model, X_val, selected_model, task
            )

            if shap_values is None:
                st.error("Could not compute SHAP values for this model.")
                return

            importance_df = get_feature_importance(
                shap_values, feature_names, task
            )

            if importance_df is None or len(importance_df) == 0:
                st.error("Could not compute feature importance.")
                return

            st.session_state.shap_importance = importance_df
            st.session_state.shap_model = selected_model

    if "shap_importance" in st.session_state and st.session_state.shap_importance is not None:
        importance_df = st.session_state.shap_importance.copy()

        if importance_df is None or len(importance_df) == 0:
            st.warning("No feature importance data available.")
            return

        st.divider()
        st.subheader(f"Feature Importance — {st.session_state.shap_model}")
        st.caption("Higher SHAP value = stronger influence on predictions")

        # Map f_0, f_1 back to original feature names
        df = st.session_state.df
        orig_cols = [c for c in df.columns if c != target]

        def map_feature_name(f):
            try:
                if f.startswith("f_"):
                    idx = int(f.replace("f_", ""))
                    if idx < len(orig_cols):
                        return orig_cols[idx]
                return f
            except:
                return f

        importance_df["Feature"] = importance_df["Feature"].apply(map_feature_name)

        # Filter out padding features
        importance_df = importance_df[~importance_df["Feature"].str.startswith("pad_")]
        importance_df = importance_df[~importance_df["Feature"].str.startswith("f_")]
        importance_df = importance_df.reset_index(drop=True)

        if len(importance_df) == 0:
            st.warning("No original features found in importance ranking.")
            return

        # Bar chart
        fig = px.bar(
            importance_df.head(20),
            x="Importance",
            y="Feature",
            orientation="h",
            color="Importance",
            color_continuous_scale="Teal",
            title=f"Top {min(20, len(importance_df))} Most Important Features"
        )
        fig.update_layout(yaxis={"categoryorder": "total ascending"}, height=500)
        st.plotly_chart(fig, use_container_width=True)

        # Table
        st.subheader("Full Feature Ranking")
        st.dataframe(importance_df, use_container_width=True)

        # Plain English explanation via Groq
        st.divider()
        st.subheader("What does this mean?")
        if st.button("Explain in plain English"):
            with st.spinner("Generating explanation..."):
                try:
                    top_features = importance_df.head(5)["Feature"].tolist()
                    system_prompt = """You are a data scientist explaining model behavior
to a non-technical audience. Be clear, specific, and helpful."""
                    user_msg = f"""
Task: {task} on target column '{target}'
Top 5 most important features by SHAP value: {top_features}

Explain in 2-3 sentences what this means — why these features matter
for predicting {target}, and what a business user should take away from this.
"""
                    from intelligence.groq_client import ask_groq
                    explanation = ask_groq(system_prompt, user_msg, max_tokens=200)
                    st.markdown(explanation)
                except Exception as e:
                    st.error(f"Error: {e}")