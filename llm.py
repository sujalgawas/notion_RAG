from langchain_ollama import ChatOllama
from langchain_core.prompts import ChatPromptTemplate

llm = ChatOllama(model="gemma3:1b", temperature=0.3)

system_prompt = """
You are a helpful AI assistant.

Use the provided context to answer the user's question.

IMPORTANT:
- The context may contain rough notes, bullet points, or incomplete text.
- You MUST extract and organize the information into a clear answer.
- Do NOT say "I don't have enough information" if relevant data exists.
- If the answer is present in any form, summarize it properly.

Context:
{context}
"""

def chatbot_response(query: str, retrieved_docs: list) -> str:
    if not retrieved_docs:
        return "No relevant documents found in your Notion workspace."
    else:
        print(retrieved_docs)

    context = "\n\n".join(
        [f"[Document {i+1}]\n{doc.page_content}" for i, doc in enumerate(retrieved_docs)]
    )

    qa_prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", (
            "Here is your Notion workspace context (already retrieved for you):\n\n"
            "{context}\n\n"
            "---\n"
            "Using only the context above, answer this question:\n{query}"
        )),
    ])

    chain = qa_prompt | llm
    result = chain.invoke({"query": query, "context": context})
    return result.content