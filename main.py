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