from langchain_ollama import ChatOllama
from langchain_core.prompts import ChatPromptTemplate

llm = ChatOllama(model="gemma:2b")

system_prompt = """You are a helpful assistant that answers questions based on the user's Notion workspace.
Use the following retrieved context to answer. If the answer isn't in the context, say you don't know.

Context:
{context}"""


def chatbot_response(query: str, retrieved_docs: list) -> str:
    context = "\n\n".join(
        [f"Document {i+1}:\n{doc}" for i, doc in enumerate(retrieved_docs)]
    )

    qa_prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "{query}"),
    ])

    chain = qa_prompt | llm
    result = chain.invoke({"query": query, "context": context})

    return result.content

