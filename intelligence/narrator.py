from intelligence.groq_client import ask_groq

def narrate_eda(eda_report: dict, n_rows: int, n_cols: int) -> str:
    # Build a clean summary of EDA for the LLM
    col_summaries = []
    for col, info in eda_report.items():
        if col.startswith("_"):
            continue
        if info["dtype"] == "numeric":
            col_summaries.append(
                f"- {col} (numeric): mean={info.get('mean')}, "
                f"std={info.get('std')}, missing={info['missing_pct']}%"
            )
        elif info["dtype"] == "categorical":
            top = list(info.get("top_values", {}).keys())[:3]
            col_summaries.append(
                f"- {col} (categorical): {info['n_unique']} unique values, "
                f"top: {top}, missing={info['missing_pct']}%"
            )

    system_prompt = """You are a senior data scientist explaining findings to a non-technical audience.
Write clear, concise, insightful observations. Be specific with numbers. 
Highlight what's interesting or unusual. Use plain English, no jargon.
Format as 3-5 short paragraphs."""

    user_msg = f"""Dataset: {n_rows} rows, {n_cols} columns.

Column summaries:
{chr(10).join(col_summaries)}

Write a data insight narrative about this dataset."""

    return ask_groq(system_prompt, user_msg, max_tokens=600)


def narrate_results(results: dict, task: str, target_col: str) -> str:
    model_results = {k: v for k, v in results.items() if not k.startswith("_")}

    if task == "classification":
        summary = "\n".join([
            f"- {name}: Accuracy={r['accuracy']}, F1 Weighted={r['f1_weighted']}, F1 Macro={r['f1_macro']}"
            for name, r in model_results.items()
        ])
    else:
        summary = "\n".join([
            f"- {name}: R²={r['r2']}, RMSE={r['rmse']}, MAE={r['mae']}"
            for name, r in model_results.items()
        ])

    system_prompt = """You are a senior data scientist explaining model results to a non-technical audience.
Explain what the numbers mean in plain English. Say which model performed best and why it matters.
Be specific. Write 2-3 short paragraphs."""

    user_msg = f"""Task: {task}
Target column: {target_col}

Model results:
{summary}

Explain these results in plain English."""

    return ask_groq(system_prompt, user_msg, max_tokens=400)


def answer_question(question: str, eda_report: dict, results: dict,
                    task: str, target_col: str) -> str:
    model_results = {k: v for k, v in results.items() if not k.startswith("_")}

    if task == "classification":
        perf = "\n".join([
            f"- {name}: Accuracy={r['accuracy']}, F1={r['f1_weighted']}"
            for name, r in model_results.items()
        ])
    else:
        perf = "\n".join([
            f"- {name}: R²={r['r2']}, RMSE={r['rmse']}"
            for name, r in model_results.items()
        ])

    col_info = "\n".join([
        f"- {col}: {info['dtype']}, missing={info['missing_pct']}%"
        for col, info in eda_report.items()
        if not col.startswith("_")
    ])

    system_prompt = """You are a data science assistant answering questions about a dataset.
Be direct, specific, and helpful. Use the data provided to give accurate answers.
If you can't answer from the data, say so honestly."""

    user_msg = f"""Question: {question}

Dataset columns:
{col_info}

Model performance ({task} on {target_col}):
{perf}

Answer the question based on this data."""

    return ask_groq(system_prompt, user_msg, max_tokens=400)