from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from notion_client import Client, APIErrorCode, APIResponseError
import os

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


@app.get("/query/{database_id}")
def query_database(database_id: str):
    try:
        results = notion.databases.query(database_id=database_id)
        return results

    except APIResponseError as e:
        if e.code == APIErrorCode.ObjectNotFound:
            raise HTTPException(status_code=404, detail=f"Database '{database_id}' not found. Check the ID and that the integration has access.")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/query/{database_id}/filter")
def query_database_filtered(database_id: str, property: str, contains: str):
    try:
        results = notion.databases.query(
            database_id=database_id,
            filter={
                "property": property,
                "rich_text": {
                    "contains": contains
                }
            }
        )
        return results

    except APIResponseError as e:
        if e.code == APIErrorCode.ObjectNotFound:
            raise HTTPException(status_code=404, detail=f"Database '{database_id}' not found.")
        raise HTTPException(status_code=500, detail=str(e))
    
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
   
    
@app.get("/search")
def search():
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

    return {
        "message": "api working",
        "database_ids": database_ids,
        "standalone_page_ids": list(page_ids),     
        "db_to_page": dic_db_to_page
    }