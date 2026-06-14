import streamlit as st
import plotly.express as px
import pandas as pd

def render():
    st.title("Model Benchmark")

    if st.session_state.results is None:
        st.info("Run analysis from the sidebar first.")
        return

    results = st.session_state.results
    task    = st.session_state.task

    # Filter out metadata keys
    model_results = {k: v for k, v in results.items() if not k.startswith("_")}

    if task == "classification":
        rows = []
        for name, r in model_results.items():
            rows.append({
                "Model":       name,
                "Accuracy":    r["accuracy"],
                "F1 Weighted": r["f1_weighted"],
                "F1 Macro":    r["f1_macro"]
            })
        df = pd.DataFrame(rows).sort_values("F1 Weighted", ascending=False)

        st.subheader("Leaderboard")
        st.dataframe(df, use_container_width=True)

        # Detect suspicious scores
        for _, row in df.iterrows():
            if row["F1 Weighted"] == 1.0:
                st.warning(f"{row['Model']} shows F1 = 1.0 — this is likely overfitting due to small dataset size, not genuine performance. Test with 200+ rows for reliable results.")

        with st.expander("How to read these metrics"):
            st.markdown("""
| Metric | Best value | Worst value | What it means |
|---|---|---|---|
| **Accuracy** | 1.0 | 0.0 | % of predictions correct |
| **F1 Weighted** | 1.0 | 0.0 | Balance of precision & recall, weighted by class size |
| **F1 Macro** | 1.0 | 0.0 | Same but treats all classes equally — better for imbalanced data |

**What to look for:**
- F1 Weighted > 0.8 — strong performance
- F1 Weighted 0.6–0.8 — acceptable, room to improve
- F1 Weighted < 0.6 — poor, likely needs more data or feature engineering
- Any metric = 1.0 on small data — probably overfitting, not real performance
            """)

        fig = px.bar(df, x="Model", y="F1 Weighted",
                     color="F1 Weighted",
                     color_continuous_scale="Blues",
                     title="F1 Weighted Score by Model")
        st.plotly_chart(fig, use_container_width=True)

        fig2 = px.bar(df.melt(id_vars="Model",
                               value_vars=["Accuracy", "F1 Weighted", "F1 Macro"]),
                      x="Model", y="value", color="variable",
                      color_discrete_sequence=px.colors.qualitative.Safe,
                      barmode="group", title="All Metrics Comparison")
        st.plotly_chart(fig2, use_container_width=True)

    elif task == "regression":
        rows = []
        for name, r in model_results.items():
            rows.append({
                "Model": name,
                "R²":    r["r2"],
                "RMSE":  r["rmse"],
                "MAE":   r["mae"]
            })
        df = pd.DataFrame(rows).sort_values("R²", ascending=False)

        st.subheader("Leaderboard")
        st.dataframe(df, use_container_width=True)

        with st.expander("How to read these metrics"):
            st.markdown("""
| Metric | Best value | Worst value | What it means |
|---|---|---|---|
| **R²** | 1.0 | −∞ | How much variance the model explains. 1.0 = perfect, 0 = no better than mean |
| **RMSE** | 0 (low is best) | ∞ | Average prediction error in the same units as the target |
| **MAE** | 0 (low is best) | ∞ | Similar to RMSE but less sensitive to outliers |

**What to look for:**
- R² > 0.8 — strong performance
- R² 0.5–0.8 — acceptable
- R² < 0.5 — weak, model struggling
- R² negative — model is worse than just predicting the average. Usually means too little data or wrong target column
            """)

        fig = px.bar(df, x="Model", y="R²",
                     color="R²",
                     color_continuous_scale="Blues",
                     title="R² Score by Model")
        st.plotly_chart(fig, use_container_width=True)

        fig2 = px.bar(df.melt(id_vars="Model", value_vars=["RMSE", "MAE"]),
                      x="Model", y="value", color="variable",
                      color_discrete_sequence=px.colors.qualitative.Safe,
                      barmode="group", title="Error Metrics Comparison")
        st.plotly_chart(fig2, use_container_width=True)