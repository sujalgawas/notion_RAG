from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from notion_client import Client, APIErrorCode, APIResponseError
import os
from RAG import build_rag,query_rag
from pydantic import BaseModel
from llm import chatbot_response
from langchain_core.documents import Document


load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

notion = Client(auth=os.getenv("NOTION_TOKEN"))

@app.get("/")
def home():
    return {"message": "Notion backend running"}

def clean_database_id(data):
    database_ids = set()

    for item in data.get("results", []):
        if item.get("object") == "database":
            db_id = item.get("id")
            if db_id:
                database_ids.add(db_id)
                
    return list(database_ids)

def clean_page_id(data):
    page_ids = set()
    
    for item in data.get("results", []):
        if item.get("object") == "page":
            page_id = item.get("id")
            if page_id:
                page_ids.add(page_id)

    return list(page_ids)

def database_page_id(database_id):
    try:
        results = notion.databases.query(database_id=database_id)
        if results:
            page_ids = clean_page_id(results)    
        
        return page_ids

    except APIResponseError as e:
        if e.code == APIErrorCode.ObjectNotFound:
            raise HTTPException(status_code=404, detail=f"Database '{database_id}' not found. Check the ID and that the integration has access.")
        raise HTTPException(status_code=500, detail=str(e))
   
def extract_text_from_block(block: dict) -> str:
    block_type = block.get("type")
    if not block_type:
        return ""

    block_content = block.get(block_type, {})
    rich_text = block_content.get("rich_text", [])

    return " ".join(rt.get("plain_text", "") for rt in rich_text)


def get_page_content(page_id: str) -> list[str]:
    try:
        response = notion.blocks.children.list(block_id=page_id)
        blocks = response.get("results", [])
        
        content = []
        for block in blocks:
            text = extract_text_from_block(block)
            if text.strip():
                content.append({
                    "type": block.get("type"),
                    "text": text
                })
        
        return content

    except APIResponseError as e:
        print(f"Error fetching page {page_id}: {e}")
        return []


def page_id_to_document(page_ids: list, dic_db_to_page: dict) -> dict:
    document = {}

    for page_id in page_ids:
        document[page_id] = get_page_content(page_id)

    for database_id, pages in dic_db_to_page.items():   
        temp = {}
        for page_id in pages:                            
            temp[page_id] = get_page_content(page_id)
        document[database_id] = temp

    return document

class ChatbotQuery(BaseModel):             
    query: str
    
def documents_to_langchain(documents_pages: dict) -> list[Document]:
    langchain_docs = []
    
    print(documents_pages)

    for key, value in documents_pages.items():
        if isinstance(value, list):
            text = "\n".join(block["text"] or block["header"] for block in value if "text" in block)
            if text.strip():
                langchain_docs.append(Document(
                    page_content=text,
                    metadata={"page_id": key}
                ))
        elif isinstance(value, dict):
            for page_id, blocks in value.items():
                text = "\n".join(block["text"] for block in blocks if "text" in block)
                if text.strip():
                    langchain_docs.append(Document(
                        page_content=text,
                        metadata={"page_id": page_id, "database_id": key}
                    ))

    return langchain_docs

@app.get("/build_rag")
def build_rag_database():
    try:
        response = notion.search()
    except APIResponseError as e:
        if e.code == APIErrorCode.ObjectNotFound:
            raise HTTPException(status_code=404, detail="Search not working.")
        raise HTTPException(status_code=500, detail=str(e))

    database_ids = clean_database_id(response)
    page_ids = set(clean_page_id(response))

    dic_db_to_page = {}
    for db in database_ids:
        db_page_ids = database_page_id(db)
        for pid in db_page_ids:
            page_ids.discard(pid)
        dic_db_to_page[db] = db_page_ids

    documents_pages = page_id_to_document(list(page_ids), dic_db_to_page)
    langchain_docs = documents_to_langchain(documents_pages)
    build_rag(langchain_docs)

    return {"message": f"RAG index built — {len(langchain_docs)} pages indexed"}

@app.post("/chatbot")
def chatbot(body: ChatbotQuery):
    search, scores = query_rag(body.query,k=3)

    return {
        "response": chatbot_response(body.query, search),
        "retrieved_docs": [doc for doc in search],
        "similarity_scores": [float(score) for _, score in scores]
    }