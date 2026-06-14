import streamlit as st
from intelligence.narrator import answer_question
from intelligence.router import route_question

def render():
    st.title("💬 Ask")

    if st.session_state.results is None:
        st.info("Run analysis from the sidebar first.")
        return

    st.caption("Ask anything about your data in plain English.")

    # Example questions
    with st.expander("💡 Example questions"):
        st.markdown("""
- Which model performed best and why?
- What are the most important patterns in this dataset?
- Is there anything unusual about the data?
- What does the target column distribution look like?
- How confident should I be in these predictions?
        """)

    question = st.text_input("Your question", placeholder="e.g. Which features matter most?")

    if question and st.button("Ask", type="primary"):
        with st.spinner("Thinking..."):
            try:
                answer = answer_question(
                    question=question,
                    eda_report=st.session_state.eda_report,
                    results=st.session_state.results,
                    task=st.session_state.task,
                    target_col=st.session_state.target_col
                )
                st.divider()
                st.markdown(answer)
            except Exception as e:
                st.error(f"Error: {e}")

    # Chat history
    if "chat_history" not in st.session_state:
        st.session_state.chat_history = []

    if question and st.session_state.get("last_answer"):
        st.session_state.chat_history.append({
            "q": question,
            "a": st.session_state.last_answer
        })

    if st.session_state.chat_history:
        st.divider()
        st.subheader("Previous questions")
        for item in reversed(st.session_state.chat_history[-5:]):
            st.markdown(f"**Q:** {item['q']}")
            st.markdown(f"**A:** {item['a']}")
            st.divider()