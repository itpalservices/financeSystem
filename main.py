from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import os

from app.database import engine, Base
from app.routes import auth, invoices, quotes, users

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Invoice & Quote System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(invoices.router, prefix="/api/invoices", tags=["Invoices"])
app.include_router(quotes.router, prefix="/api/quotes", tags=["Quotes"])

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def read_index():
    return FileResponse("static/index.html")

@app.get("/login")
async def read_login():
    return FileResponse("static/login.html")

@app.get("/register")
async def read_register():
    return FileResponse("static/register.html")

@app.get("/dashboard")
async def read_dashboard():
    return FileResponse("static/dashboard.html")

@app.get("/invoices")
async def read_invoices():
    return FileResponse("static/invoices.html")

@app.get("/quotes")
async def read_quotes():
    return FileResponse("static/quotes.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
