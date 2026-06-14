import streamlit as st
from intelligence.narrator import narrate_eda, narrate_results

def render():
    st.title("📖 Insights")

    if st.session_state.df is None:
        st.info("Upload a CSV file from the sidebar first.")
        return

    tab1, tab2 = st.tabs(["📊 Data Insights", "🤖 Model Insights"])

    with tab1:
        st.subheader("What does this data tell us?")
        if st.session_state.eda_report is None:
            st.info("Run analysis from the sidebar first.")
        else:
            if "eda_narrative" not in st.session_state or st.button("🔄 Regenerate", key="regen_eda"):
                with st.spinner("Generating insights..."):
                    try:
                        narrative = narrate_eda(
                            eda_report=st.session_state.eda_report,
                            n_rows=st.session_state.meta.n_rows,
                            n_cols=st.session_state.meta.n_cols
                        )
                        st.session_state.eda_narrative = narrative
                    except Exception as e:
                        st.error(f"Error: {e}")

            if "eda_narrative" in st.session_state:
                st.markdown(st.session_state.eda_narrative)

    with tab2:
        st.subheader("What do the model results mean?")
        if st.session_state.results is None:
            st.info("Run analysis from the sidebar first.")
        else:
            if "model_narrative" not in st.session_state or st.button("🔄 Regenerate", key="regen_model"):
                with st.spinner("Generating insights..."):
                    try:
                        narrative = narrate_results(
                            results=st.session_state.results,
                            task=st.session_state.task,
                            target_col=st.session_state.target_col
                        )
                        st.session_state.model_narrative = narrative
                    except Exception as e:
                        st.error(f"Error: {e}")

            if "model_narrative" in st.session_state:
                st.markdown(st.session_state.model_narrative)