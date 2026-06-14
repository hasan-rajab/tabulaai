import streamlit as st
import pandas as pd
import numpy as np

def render():
    st.title("🔍 What-If Analysis")

    if st.session_state.results is None:
        st.info("Run analysis from the sidebar first.")
        return

    df          = st.session_state.df
    meta        = st.session_state.meta
    results     = st.session_state.results
    target_col  = st.session_state.target_col
    task        = st.session_state.task

    # Pick best model
    model_results = {k: v for k, v in results.items() if not k.startswith("_")}
    if task == "classification":
        reliable = {k: v for k, v in model_results.items()
                    if v["f1_weighted"] < 1.0}
        pool = reliable if reliable else model_results
        best_name = max(pool, key=lambda k: pool[k]["f1_weighted"])
    else:
        reliable = {k: v for k, v in model_results.items()
                    if 0 <= v["r2"] <= 0.99}
        pool = reliable if reliable else model_results
        best_name = max(pool, key=lambda k: pool[k]["r2"])

    best_model = model_results[best_name]["model"]
    st.caption(f"Using best model: **{best_name}**")

    st.subheader("Adjust input values and see predictions change live")

    # Build input sliders from numeric columns
    input_vals = {}
    feature_cols = [c for c in df.columns
                if c != target_col
                and meta.columns[c].dtype == "numeric"
                and c != target_col]

    cols = st.columns(3)
    for i, col in enumerate(feature_cols[:12]):  # cap at 12 features
        with cols[i % 3]:
            min_v = float(df[col].min())
            max_v = float(df[col].max())
            mean_v = float(df[col].mean())
            input_vals[col] = st.slider(
                col, min_value=min_v, max_value=max_v, value=mean_v
            )

    # Build input row
    input_row = pd.DataFrame([input_vals])

    # Align to 200 features
    if input_row.shape[1] < 200:
        pad = pd.DataFrame(
            np.zeros((1, 200 - input_row.shape[1])),
            columns=[f"pad_{i}" for i in range(200 - input_row.shape[1])]
        )
        input_row = pd.concat([input_row.reset_index(drop=True), pad], axis=1)
    else:
        input_row = input_row.iloc[:, :200]
    input_row.columns = [f"f_{i}" for i in range(200)]

    # Predict
    try:
        if task == "classification":
            pred = best_model.predict(input_row)[0]
            pred_display = int(pred) if hasattr(pred, '__int__') else predst.metric("Prediction", str(pred_display))
            proba = best_model.predict_proba(input_row)[0]
            st.divider()
            st.metric("Prediction", str(pred))
            st.subheader("Class Probabilities")
            proba_df = pd.DataFrame({
                "Class": list(range(len(proba))),
                "Probability": proba
            }).sort_values("Probability", ascending=False)
            import plotly.express as px
            fig = px.bar(proba_df, x="Class", y="Probability",
                         color="Probability", color_continuous_scale="Teal")
            st.plotly_chart(fig, use_container_width=True)
        else:
            pred = best_model.predict(input_row)[0]
            st.divider()
            st.metric("Predicted Value", f"{pred:.4f}")
    except Exception as e:
        st.error(f"Prediction error: {e}")