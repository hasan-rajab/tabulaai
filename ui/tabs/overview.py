import streamlit as st
import plotly.express as px
import pandas as pd

def render():
    st.title("🏠 Data Overview")

    if st.session_state.df is None:
        st.info("Upload a CSV file from the sidebar to get started.")
        return

    df   = st.session_state.df
    meta = st.session_state.meta

    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Rows", f"{meta.n_rows:,}")
    col2.metric("Columns", meta.n_cols)
    col3.metric("Tasks", len(meta.suggested_tasks))
    col4.metric("Missing %", f"{sum(c.missing_pct for c in meta.columns.values()) / len(meta.columns):.1f}%")

    st.divider()

    # Column summary table
    st.subheader("Column Summary")
    summary = []
    for col, cmeta in meta.columns.items():
        summary.append({
            "Column": col,
            "Type": cmeta.dtype,
            "Missing %": cmeta.missing_pct,
            "Unique Values": cmeta.n_unique,
            "Sample": str(cmeta.sample_values[:3])
        })
    st.dataframe(pd.DataFrame(summary), use_container_width=True)

    st.divider()

    # EDA charts
    if st.session_state.eda_report:
        report = st.session_state.eda_report
        st.subheader("Distributions")

        numeric_cols = [c for c, m in meta.columns.items()
                        if m.dtype == "numeric" and c in df.columns]

        if numeric_cols:
            selected = st.selectbox("Select column", numeric_cols)
            fig = px.histogram(df, x=selected, nbins=40,
                               title=f"Distribution of {selected}")
            st.plotly_chart(fig, use_container_width=True)

        # Correlation heatmap
        if "_correlations" in report and len(numeric_cols) >= 2:
            st.subheader("Correlation Heatmap")
            import plotly.graph_objects as go
            corr_df = pd.DataFrame(report["_correlations"])
            fig = go.Figure(data=go.Heatmap(
                z=corr_df.values,
                x=corr_df.columns.tolist(),
                y=corr_df.index.tolist(),
                colorscale="RdBu",
                zmid=0
            ))
            fig.update_layout(height=500)
            st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("Click 'Run Analysis' in the sidebar to generate EDA charts.")