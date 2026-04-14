from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings

FAISS_PATH = "faiss_index"
EMBEDDING_MODEL = "all-MiniLM-L6-v2"


def build_rag(documents: list):
    """
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=2000, chunk_overlap=400, add_start_index=True
    )
    all_splits = text_splitter.split_documents(documents)
    """
    embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)

    vector_store = FAISS.from_documents(documents, embeddings)
    vector_store.save_local(FAISS_PATH)

    return vector_store


def query_rag(query: str, k: int = 2):
    embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)

    vector_store = FAISS.load_local(
        FAISS_PATH, embeddings, allow_dangerous_deserialization=True
    )

    similarity_search = vector_store.similarity_search(query, k=k)

    query_vector = embeddings.embed_query(query)
    similarity_score = vector_store.similarity_search_with_score_by_vector(query_vector, k=k)

    return similarity_search, similarity_score