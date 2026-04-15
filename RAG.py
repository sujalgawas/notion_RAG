#from langchain_text_splitters import RecursiveCharacterTextSplitter #commenting this out since we are not spliting documents
from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings

CHROMA_PATH = "./chroma_db"
COLLECTION_NAME = "notion_rag_collection"
EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"


def get_embeddings():
    return HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)


def build_rag(documents: list):
    """
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=2000, chunk_overlap=400, add_start_index=True
    )
    all_splits = text_splitter.split_documents(documents)
    """ 
    ids = [
        f"{doc.metadata.get('source', 'doc')}_{doc.metadata.get('start_index', i)}"
        for i, doc in enumerate(documents)
    ]

    embeddings = get_embeddings()

    vector_store = Chroma(
        collection_name=COLLECTION_NAME,
        embedding_function=embeddings,
        persist_directory=CHROMA_PATH,
    )

    vector_store.add_documents(documents=documents, ids=ids)

    return vector_store


def query_rag(query: str, k: int = 2):
    embeddings = get_embeddings()

    vector_store = Chroma(
        collection_name=COLLECTION_NAME,
        embedding_function=embeddings,
        persist_directory=CHROMA_PATH,
    )

    similarity_search = vector_store.similarity_search(query, k=k)
    similarity_score = vector_store.similarity_search_with_score(query, k=k)

    return similarity_search, similarity_score