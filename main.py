from fastapi import FastAPI, Request, HTTPException
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import aiohttp
import asyncio
from datetime import datetime
import json
import os
from dotenv import load_dotenv

load_dotenv()

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL")
if not OLLAMA_BASE_URL:
    raise RuntimeError("OLLAMA_BASE_URL must be set in .env file")

app = FastAPI(title="Ollama CO₂ - Everything is better carbonated")
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

active_downloads = {}

@app.get("/", response_class=HTMLResponse)
async def ollama_monitor(request: Request):
    """Ollama monitoring dashboard"""
    status_info = await get_ollama_status()
    return templates.TemplateResponse("ollamaco2.html", {
        "request": request,
        "ollama_status": status_info,
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    })


async def get_ollama_status():
    """Get Ollama server status and both available and loaded models"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=aiohttp.ClientTimeout(total=10)) as response:
                if response.status == 200:
                    available_data = await response.json()
                    available_models = available_data.get("models", [])
                else:
                    return {"status": "error", "available_models": [], "loaded_models": [], "error": f"HTTP {response.status}"}
            
            async with session.get(f"{OLLAMA_BASE_URL}/api/ps", timeout=aiohttp.ClientTimeout(total=10)) as response:
                if response.status == 200:
                    loaded_data = await response.json()
                    loaded_models = loaded_data.get("models", [])
                else:
                    loaded_models = []
            
            return {
                "status": "online", 
                "available_models": available_models,
                "loaded_models": loaded_models,
                "error": None
            }
    except asyncio.TimeoutError:
        return {"status": "timeout", "available_models": [], "loaded_models": [], "error": "Connection timeout"}
    except Exception as e:
        return {"status": "offline", "available_models": [], "loaded_models": [], "error": str(e)}

async def get_model_info(model_name):
    """Get detailed model information including runtime parameters"""
    try:
        async with aiohttp.ClientSession() as session:
            payload = {"name": model_name}
            async with session.post(f"{OLLAMA_BASE_URL}/api/show", 
                                  json=payload, 
                                  timeout=aiohttp.ClientTimeout(total=20)) as response:
                if response.status == 200:
                    model_info = await response.json()
                else:
                    return {"error": f"HTTP {response.status}"}
            
            async with session.get(f"{OLLAMA_BASE_URL}/api/ps", 
                                 timeout=aiohttp.ClientTimeout(total=10)) as ps_response:
                if ps_response.status == 200:
                    ps_data = await ps_response.json()
                    loaded_models = ps_data.get("models", [])
                    
                    for loaded_model in loaded_models:
                        if loaded_model.get("name") == model_name:
                            model_info["runtime_info"] = {
                                "context_length": loaded_model.get("context_length"),
                                "size_vram": loaded_model.get("size_vram"),
                                "expires_at": loaded_model.get("expires_at")
                            }
                            break
            
            return model_info
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/ollama/status")
async def ollama_status_api():
    """API endpoint for Ollama status"""
    status_info = await get_ollama_status()
    return JSONResponse(status_info)

@app.get("/api/ollama/model/{model_name}")
async def ollama_model_info_api(model_name: str):
    """API endpoint for specific model information"""
    model_info = await get_model_info(model_name)
    return JSONResponse(model_info)

@app.post("/api/ollama/pull")
async def pull_model_api(request: Request):
    """Download a new model with progress tracking"""
    body = await request.json()
    model_name = body.get("name")
    if not model_name:
        raise HTTPException(status_code=400, detail="Model name is required")
    
    active_downloads[model_name] = {"status": "starting", "percent": 0}
    
    try:
        async with aiohttp.ClientSession() as session:
            payload = {"name": model_name}
            async with session.post(f"{OLLAMA_BASE_URL}/api/pull", 
                                  json=payload, 
                                  timeout=aiohttp.ClientTimeout(total=1200)) as response:
                if response.status == 200:
                    async for line in response.content:
                        if line:
                            try:
                                status_data = json.loads(line.decode().strip())
                                
                                progress_info = {
                                    "status": status_data.get("status", "unknown"),
                                    "completed": status_data.get("completed", 0),
                                    "total": status_data.get("total", 0),
                                    "digest": status_data.get("digest", ""),
                                    "percent": 0
                                }
                                
                                if progress_info["total"] > 0:
                                    progress_info["percent"] = round((progress_info["completed"] / progress_info["total"]) * 100, 1)
                                
                                active_downloads[model_name] = progress_info
                                
                                if status_data.get("status") == "success":
                                    active_downloads[model_name] = {"status": "completed", "percent": 100, "success": True}
                                    return {"success": True, "message": f"Model {model_name} pulled successfully"}
                                    
                            except json.JSONDecodeError:
                                continue
                    
                    active_downloads[model_name] = {"status": "completed", "percent": 100, "success": True}
                    return {"success": True, "message": f"Model {model_name} pulled successfully"}
                else:
                    error_text = await response.text()
                    active_downloads[model_name] = {"status": "error", "error": f"HTTP {response.status}: {error_text}"}
                    return {"success": False, "error": f"HTTP {response.status}: {error_text}"}
    except Exception as e:
        active_downloads[model_name] = {"status": "error", "error": str(e)}
        return {"success": False, "error": str(e)}
    finally:
        asyncio.create_task(cleanup_download_tracking(model_name))

@app.get("/api/ollama/pull/active")
async def get_active_downloads():
    """Get all active downloads with their progress"""
    return {"success": True, "downloads": active_downloads}

@app.get("/api/ollama/pull/{model_name}/progress")
async def get_pull_progress(model_name: str):
    """Get progress of an active download"""
    if model_name in active_downloads:
        progress = active_downloads[model_name]
        return {"success": True, "progress": progress, "completed": progress.get("status") == "completed"}
    else:
        return {"success": False, "error": "No active download found for this model"}

async def cleanup_download_tracking(model_name: str):
    """Clean up download tracking after 5 minutes"""
    await asyncio.sleep(300)
    if model_name in active_downloads:
        del active_downloads[model_name]


@app.post("/api/ollama/load")
async def load_model_api(request: Request):
    """Load a model into memory with custom parameters"""
    body = await request.json()
    model_name = body.get("name")
    if not model_name:
        raise HTTPException(status_code=400, detail="Model name is required")
    
    options = body.get("options", {})
    keep_alive = body.get("keep_alive", "5m")
    
    try:
        async with aiohttp.ClientSession() as session:
            payload = {
                "model": model_name, 
                "prompt": "", 
                "keep_alive": keep_alive,
                "options": options
            }
            async with session.post(f"{OLLAMA_BASE_URL}/api/generate", 
                                  json=payload, 
                                  timeout=aiohttp.ClientTimeout(total=120)) as response:
                if response.status == 200:
                    params_info = ""
                    if options:
                        param_list = [f"{k}={v}" for k, v in options.items()]
                        params_info = f" (params: {', '.join(param_list)})"
                    return {"success": True, "message": f"Model {model_name} loaded into memory{params_info}"}
                else:
                    error_text = await response.text()
                    return {"success": False, "error": f"HTTP {response.status}: {error_text}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/ollama/unload")
async def unload_model_api(request: Request):
    """Unload a model from memory"""
    body = await request.json()
    model_name = body.get("name")
    if not model_name:
        raise HTTPException(status_code=400, detail="Model name is required")
    
    try:
        async with aiohttp.ClientSession() as session:
            payload = {"model": model_name, "keep_alive": 0}
            async with session.post(f"{OLLAMA_BASE_URL}/api/generate", 
                                  json=payload, 
                                  timeout=aiohttp.ClientTimeout(total=60)) as response:
                if response.status == 200:
                    return {"success": True, "message": f"Model {model_name} unloaded from memory"}
                else:
                    error_text = await response.text()
                    return {"success": False, "error": f"HTTP {response.status}: {error_text}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.delete("/api/ollama/delete")
async def delete_model_api(request: Request):
    """Delete a model permanently"""
    body = await request.json()
    model_name = body.get("name")
    if not model_name:
        raise HTTPException(status_code=400, detail="Model name is required")
    
    try:
        async with aiohttp.ClientSession() as session:
            payload = {"name": model_name}
            async with session.delete(f"{OLLAMA_BASE_URL}/api/delete", 
                                    json=payload, 
                                    timeout=aiohttp.ClientTimeout(total=60)) as response:
                if response.status == 200:
                    return {"success": True, "message": f"Model {model_name} deleted successfully"}
                else:
                    error_text = await response.text()
                    return {"success": False, "error": f"HTTP {response.status}: {error_text}"}
    except Exception as e:
        return {"success": False, "error": str(e)}