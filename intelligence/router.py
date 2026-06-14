import json
from intelligence.groq_client import ask_groq

SYSTEM_PROMPT = """You are a data science assistant. Given a question about a dataset, 
identify what ML analysis is needed and return ONLY a JSON object with no other text.

Return this exact format:
{
  "task": "classification" | "regression" | "anomaly_detection" | "clustering" | "eda",
  "target_col": "column_name or null",
  "question_type": "prediction" | "explanation" | "exploration" | "comparison",
  "rephrased": "cleaner version of the question"
}"""

def route_question(question: str, available_columns: list, available_tasks: list) -> dict:
    user_msg = f"""
Question: {question}
Available columns: {available_columns}
Available tasks: {available_tasks}

Return only the JSON object.
"""
    try:
        response = ask_groq(SYSTEM_PROMPT, user_msg, max_tokens=200)
        # Strip any markdown if present
        clean = response.strip().replace("```json", "").replace("```", "").strip()
        return json.loads(clean)
    except Exception as e:
        return {
            "task": "eda",
            "target_col": None,
            "question_type": "exploration",
            "rephrased": question
        }