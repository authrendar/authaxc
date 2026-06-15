import os
import uuid
import time
import hmac
import hashlib
import json
import base64
import pyotp
import requests
from datetime import datetime, timedelta
from typing import List

from fastapi import FastAPI, Request, Response, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import JSONResponse, RedirectResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

import database as db
import models

load_dotenv()

# Initialize FastAPI
app = FastAPI(title="Anik X Cheats Licensing System")

templates = Jinja2Templates(directory="static")

import traceback
from fastapi.responses import JSONResponse
@app.middleware("http")
async def catch_exceptions_middleware(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as e:
        print("FATAL ERROR IN REQUEST:")
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"detail": "Internal Server Error"})


# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# JWT Secret
JWT_SECRET = os.getenv("JWT_SECRET", "super_secret_jwt_signing_key_change_me_in_production")

# --- JWT HELPER FUNCTIONS ---
def base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode('utf-8').rstrip('=')

def base64url_decode(data: str) -> bytes:
    padding = '=' * (4 - (len(data) % 4))
    return base64.urlsafe_b64decode(data + padding)

def create_jwt(payload: dict) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    header_b64 = base64url_encode(json.dumps(header).encode('utf-8'))
    payload_b64 = base64url_encode(json.dumps(payload).encode('utf-8'))
    
    signature_data = f"{header_b64}.{payload_b64}".encode('utf-8')
    signature = hmac.new(JWT_SECRET.encode('utf-8'), signature_data, hashlib.sha256).digest()
    signature_b64 = base64url_encode(signature)
    
    return f"{header_b64}.{payload_b64}.{signature_b64}"

def verify_jwt(token: str) -> dict:
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
        header_b64, payload_b64, signature_b64 = parts
        
        signature_data = f"{header_b64}.{payload_b64}".encode('utf-8')
        expected_sig = hmac.new(JWT_SECRET.encode('utf-8'), signature_data, hashlib.sha256).digest()
        expected_sig_b64 = base64url_encode(expected_sig)
        
        if not hmac.compare_digest(signature_b64, expected_sig_b64):
            return None
            
        payload = json.loads(base64url_decode(payload_b64).decode('utf-8'))
        if "exp" in payload and payload["exp"] < time.time():
            return None
        return payload
    except Exception:
        return None

# --- AUTH DEPENDENCY ---
def get_current_admin(request: Request):
    token = request.cookies.get("admin_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            
    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized access")
        
    payload = verify_jwt(token)
    if not payload or payload.get("role") not in ["admin", "seller"]:
        raise HTTPException(status_code=401, detail="Invalid session token")
    return payload["username"]

def get_super_admin(request: Request):
    token = request.cookies.get("admin_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            
    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized access")
        
    payload = verify_jwt(token)
    if not payload or payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Super Admin access required")
    return payload["username"]


# --- OWNERSHIP HELPERS ---
def get_user_apps(username: str):
    return [app["id"] for app in db.apps_collection.find({"owner": username})]

def verify_app_owner(app_id: str, username: str):
    app = db.apps_collection.find_one({"id": app_id})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    if app.get("owner") != username:
        raise HTTPException(status_code=403, detail="Forbidden: Not your application")
    return app

# --- EVENT LOGGING HELPER ---
def log_event(app_id: str, event: str, details: str):
    try:
        db.logs_collection.insert_one({
            "app_id": app_id,
            "event": event,
            "details": details,
            "timestamp": datetime.utcnow().isoformat()
        })
    except Exception as e:
        print(f"[ERROR] Failed to log event: {e}")

# --- ADMIN LOGS VIEWER ---
@app.get("/api/admin/logs")
def list_logs(app_id: str = None, limit: int = 100, username: str = Depends(get_current_admin)):
    query = {}
    if app_id:
        query["app_id"] = app_id
        verify_app_owner(app_id, username)
    else:
        query["app_id"] = {"$in": get_user_apps(username)}
    logs = list(db.logs_collection.find(query, {"_id": 0}).sort("timestamp", -1).limit(limit))
    return logs

# --- ADMIN LOGIN / LOGOUT / REGISTER ---
@app.post("/api/admin/register")
def admin_register(data: models.AdminRegister):
    raise HTTPException(status_code=403, detail="Public registration is disabled. Contact an administrator.")

@app.post("/api/admin/login")
def admin_login(data: models.AdminLogin, response: Response):
    user = db.users_collection.find_one({"username": data.username, "role": {"$in": ["admin", "seller"]}})
    if not user or not db.verify_password(data.password, user["password"]):
        raise HTTPException(status_code=400, detail="Invalid username or password")
    
    # Check 2FA
    if user.get("is_2fa_enabled"):
        if not data.totp_code:
            raise HTTPException(status_code=403, detail="2FA_REQUIRED")
        
        totp = pyotp.TOTP(user["totp_secret"])
        if not totp.verify(data.totp_code):
            raise HTTPException(status_code=400, detail="Invalid 2FA code")
    
    token = create_jwt({
        "username": data.username,
        "role": user.get("role", "admin"),
        "exp": int(time.time()) + (24 * 3600)
    })
    
    response.set_cookie(
        key="admin_token",
        value=token,
        httponly=True,
        max_age=24 * 3600,
        samesite="lax",
        secure=False
    )
    return {"status": "success", "message": "Logged in successfully", "role": user.get("role", "admin")}

@app.post("/api/admin/logout")
def admin_logout(response: Response, username: str = Depends(get_current_admin)):
    response.delete_cookie("admin_token")
    return {"status": "success", "message": "Logged out successfully"}

# --- 2FA MANAGEMENT ---
from pydantic import BaseModel
class Verify2FA(BaseModel):
    code: str

@app.get("/api/admin/2fa/status")
def check_2fa_status(username: str = Depends(get_current_admin)):
    user = db.users_collection.find_one({"username": username, "role": {"$in": ["admin", "seller"]}})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"is_2fa_enabled": user.get("is_2fa_enabled", False)}

@app.post("/api/admin/2fa/setup")
def setup_2fa(username: str = Depends(get_current_admin)):
    user = db.users_collection.find_one({"username": username, "role": {"$in": ["admin", "seller"]}})
    if user.get("is_2fa_enabled"):
        raise HTTPException(status_code=400, detail="2FA is already enabled")
        
    secret = pyotp.random_base32()
    # Save the pending secret
    db.users_collection.update_one({"username": username}, {"$set": {"totp_secret": secret}})
    
    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(name=username, issuer_name="Anik X Cheats")
    
    return {"status": "success", "secret": secret, "uri": provisioning_uri}

@app.post("/api/admin/2fa/verify")
def verify_and_enable_2fa(data: Verify2FA, username: str = Depends(get_current_admin)):
    user = db.users_collection.find_one({"username": username, "role": {"$in": ["admin", "seller"]}})
    if not user or not user.get("totp_secret"):
        raise HTTPException(status_code=400, detail="2FA setup not initiated")
        
    totp = pyotp.TOTP(user["totp_secret"])
    if not totp.verify(data.code):
        raise HTTPException(status_code=400, detail="Invalid 2FA code")
        
    db.users_collection.update_one({"username": username}, {"$set": {"is_2fa_enabled": True}})
    return {"status": "success", "message": "2FA successfully enabled"}

@app.post("/api/admin/2fa/disable")
def disable_2fa(data: Verify2FA, username: str = Depends(get_current_admin)):
    user = db.users_collection.find_one({"username": username, "role": {"$in": ["admin", "seller"]}})
    if not user or not user.get("is_2fa_enabled"):
        raise HTTPException(status_code=400, detail="2FA is not enabled")
        
    totp = pyotp.TOTP(user["totp_secret"])
    if not totp.verify(data.code):
        raise HTTPException(status_code=400, detail="Invalid 2FA code")
        
    db.users_collection.update_one({"username": username}, {"$set": {"is_2fa_enabled": False, "totp_secret": None}})
    return {"status": "success", "message": "2FA disabled successfully"}

# --- PLATFORM ADMINS MANAGEMENT ---
class DashboardUserCreate(BaseModel):
    username: str
    password: str
    role: str = "seller"

@app.post("/api/admin/platform_users")
def create_platform_user(data: DashboardUserCreate, username: str = Depends(get_super_admin)):
    if db.users_collection.find_one({"username": data.username, "role": {"$in": ["admin", "seller"]}}):
        raise HTTPException(status_code=400, detail="Username already exists")
    db.users_collection.insert_one({
        "username": data.username,
        "password": db.hash_password(data.password),
        "role": data.role,
        "created_at": datetime.utcnow().isoformat()
    })
    return {"status": "success"}

@app.get("/api/admin/platform_users")
def list_platform_users(username: str = Depends(get_super_admin)):
    admins = list(db.users_collection.find({"role": "admin"}, {"_id": 0, "password": 0}))
    return admins

@app.delete("/api/admin/platform_users/{target_username}")
def delete_platform_user(target_username: str, username: str = Depends(get_super_admin)):
    if target_username == username:
        raise HTTPException(status_code=400, detail="You cannot delete your own admin account")
    
    admin = db.users_collection.find_one({"username": target_username, "role": "admin"})
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
        
    db.users_collection.delete_one({"username": target_username, "role": "admin"})
    return {"status": "success", "message": f"Admin '{target_username}' deleted"}

# --- ADMIN APP MANAGEMENT ---
@app.post("/api/admin/apps")
def create_app(data: models.AppCreate, username: str = Depends(get_current_admin)):
    app_id = f"APP-{uuid.uuid4().hex[:8].upper()}"
    app_secret = uuid.uuid4().hex
    
    app_doc = {
        "id": app_id,
        "name": data.name,
        "secret": app_secret,
        "owner": username,
        "created_at": datetime.utcnow().isoformat()
    }
    db.apps_collection.insert_one(app_doc)
    log_event(app_id, "App Create", f"Created application '{data.name}'")
    return {"status": "success", "app": {"id": app_id, "name": data.name, "secret": app_secret}}

@app.get("/api/admin/apps")
def list_apps(username: str = Depends(get_current_admin)):
    apps = list(db.apps_collection.find({"owner": username}, {"_id": 0}))
    return apps

@app.put("/api/admin/apps/{app_id}")
def rename_app(app_id: str, data: models.AppRename, username: str = Depends(get_current_admin)):
    app = verify_app_owner(app_id, username)
    db.apps_collection.update_one({"id": app_id}, {"$set": {"name": data.name}})
    log_event(app_id, "App Rename", f"Renamed application from '{app['name']}' to '{data.name}'")
    return {"status": "success", "message": "Application renamed successfully"}

@app.delete("/api/admin/apps/{app_id}")
def delete_app(app_id: str, username: str = Depends(get_current_admin)):
    app = verify_app_owner(app_id, username)
    db.apps_collection.delete_one({"id": app_id})
    db.users_collection.delete_many({"app_id": app_id})
    db.licenses_collection.delete_many({"app_id": app_id})
    db.logs_collection.delete_many({"app_id": app_id})
    return {"status": "success", "message": "Application and all associated data deleted"}

# --- ADMIN LICENSE MANAGEMENT ---
@app.get("/api/admin/licenses")
def list_licenses(app_id: str = None, username: str = Depends(get_current_admin)):
    query = {}
    if app_id:
        query["app_id"] = app_id
        verify_app_owner(app_id, username)
    else:
        query["app_id"] = {"$in": get_user_apps(username)}
    licenses = list(db.licenses_collection.find(query, {"_id": 0}))
    return licenses

@app.post("/api/admin/licenses")
def generate_licenses(data: models.LicenseGenerate, username: str = Depends(get_current_admin)):
    verify_app_owner(data.app_id, username)
    app = db.apps_collection.find_one({"id": data.app_id})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
        
    generated_keys = []
    now = datetime.utcnow()
    
    for _ in range(data.count):
        key = f"LCN-{uuid.uuid4().hex[:8].upper()}-{uuid.uuid4().hex[:8].upper()}-{uuid.uuid4().hex[:8].upper()}"
        lic_doc = {
            "key": key,
            "app_id": data.app_id,
            "duration_days": data.duration_days,
            "subscription_id": data.subscription_id,
            "is_used": False,
            "used_by": None,
            "expires_at": None,
            "is_banned": False,
            "note": data.note or "",
            "hwid": None,
            "created_at": now.isoformat()
        }
        db.licenses_collection.insert_one(lic_doc)
        generated_keys.append(key)
        
    log_event(data.app_id, "License Generate", f"Generated {data.count} keys (duration: {data.duration_days} days)")
    return {"status": "success", "keys": generated_keys}

@app.delete("/api/admin/licenses/{key}")
def delete_license(key: str, username: str = Depends(get_current_admin)):
    lic = db.licenses_collection.find_one({"key": key})
    if not lic:
        raise HTTPException(status_code=404, detail="License key not found")
    verify_app_owner(lic["app_id"], username)
        
    if lic["used_by"] and lic["used_by"] != "Key-Only":
        db.users_collection.delete_one({"username": lic["used_by"], "app_id": lic["app_id"]})
        
    db.licenses_collection.delete_one({"key": key})
    log_event(lic["app_id"], "License Delete", f"Deleted key '{key}'")
    return {"status": "success", "message": "License and associated user deleted"}

@app.post("/api/admin/licenses/{key}/ban")
def ban_license(key: str, username: str = Depends(get_current_admin)):
    lic = db.licenses_collection.find_one({"key": key})
    if not lic:
        raise HTTPException(status_code=404, detail="License key not found")
    verify_app_owner(lic["app_id"], username)
    db.licenses_collection.update_one({"key": key}, {"$set": {"is_banned": True}})
    log_event(lic["app_id"], "License Ban", f"Banned key '{key}'")
    return {"status": "success", "message": "License banned successfully"}

@app.post("/api/admin/licenses/{key}/unban")
def unban_license(key: str, username: str = Depends(get_current_admin)):
    lic = db.licenses_collection.find_one({"key": key})
    if not lic:
        raise HTTPException(status_code=404, detail="License key not found")
    verify_app_owner(lic["app_id"], username)
    db.licenses_collection.update_one({"key": key}, {"$set": {"is_banned": False}})
    log_event(lic["app_id"], "License Unban", f"Unbanned key '{key}'")
    return {"status": "success", "message": "License unbanned successfully"}

@app.post("/api/admin/licenses/{key}/reset_hwid")
def reset_hwid(key: str, username: str = Depends(get_current_admin)):
    lic = db.licenses_collection.find_one({"key": key})
    if not lic:
        raise HTTPException(status_code=404, detail="License key not found")
    verify_app_owner(lic["app_id"], username)
        
    db.licenses_collection.update_one({"key": key}, {"$set": {"hwid": None}})
    if lic["used_by"] and lic["used_by"] != "Key-Only":
        db.users_collection.update_one({"username": lic["used_by"], "app_id": lic["app_id"]}, {"$set": {"hwid": None}})
        
    log_event(lic["app_id"], "HWID Reset", f"Reset HWID for key '{key}'")
    return {"status": "success", "message": "HWID reset successfully"}

# --- ADMIN USER MANAGEMENT ---
@app.get("/api/admin/users")
def list_users(app_id: str = None, username: str = Depends(get_current_admin)):
    query = {}
    if app_id:
        query["app_id"] = app_id
        verify_app_owner(app_id, username)
    else:
        query["app_id"] = {"$in": get_user_apps(username)}
    users = list(db.users_collection.find(query, {"_id": 0, "password": 0}))
    return users

@app.post("/api/admin/users")
def create_user(data: models.UserCreate, username: str = Depends(get_current_admin)):
    verify_app_owner(data.app_id, username)
    app = db.apps_collection.find_one({"id": data.app_id})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
        
    if db.users_collection.find_one({"username": data.username, "app_id": data.app_id}):
        raise HTTPException(status_code=400, detail="Username already exists in this application")
        
    key = f"LCN-USR-{uuid.uuid4().hex[:8].upper()}-{uuid.uuid4().hex[:8].upper()}"
    
    expiry = None
    if data.duration_days > 0:
        expiry = (datetime.utcnow() + timedelta(days=data.duration_days)).isoformat()
    else:
        expiry = "Lifetime"
        
    lic_doc = {
        "key": key,
        "app_id": data.app_id,
        "duration_days": data.duration_days,
        "subscription_id": data.subscription_id,
        "is_used": True,
        "used_by": data.username,
        "expires_at": expiry,
        "is_banned": False,
        "note": data.note or f"Auto-generated for user {data.username}",
        "hwid": None,
        "created_at": datetime.utcnow().isoformat()
    }
    db.licenses_collection.insert_one(lic_doc)
    
    user_doc = {
        "username": data.username,
        "password": db.hash_password(data.password),
        "role": "user",
        "app_id": data.app_id,
        "license_key": key,
        "subscription_id": data.subscription_id,
        "hwid": None,
        "created_at": datetime.utcnow().isoformat()
    }
    db.users_collection.insert_one(user_doc)
    
    log_event(data.app_id, "User Create", f"Created direct user '{data.username}' with key '{key}'")
    return {"status": "success", "message": "User created successfully", "username": data.username, "license_key": key}

@app.delete("/api/admin/users/{username}")
def delete_user(username: str, app_id: str, admin_user: str = Depends(get_current_admin)):
    user = db.users_collection.find_one({"username": username, "app_id": app_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    db.licenses_collection.delete_one({"key": user["license_key"]})
    db.users_collection.delete_one({"username": username, "app_id": app_id})
    log_event(app_id, "User Delete", f"Deleted user account '{username}'")
    return {"status": "success", "message": "User and associated license deleted"}

@app.post("/api/admin/users/{username}/reset_hwid")
def reset_user_hwid(username: str, app_id: str, admin_user: str = Depends(get_current_admin)):
    user = db.users_collection.find_one({"username": username, "app_id": app_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    db.users_collection.update_one({"username": username, "app_id": app_id}, {"$set": {"hwid": None}})
    db.licenses_collection.update_one({"key": user["license_key"]}, {"$set": {"hwid": None}})
    log_event(app_id, "User HWID Reset", f"Reset HWID for user account '{username}'")
    return {"status": "success", "message": "HWID reset successfully"}

# --- CLIENT API ENDPOINTS ---
@app.post("/api/client/register")
def client_register(data: models.ClientRegister):
    app = db.apps_collection.find_one({"id": data.app_id})
    if not app:
        raise HTTPException(status_code=400, detail="Invalid Application ID")
        
    lic = db.licenses_collection.find_one({"key": data.license_key, "app_id": data.app_id})
    if not lic:
        raise HTTPException(status_code=400, detail="Invalid license key for this application")
        
    if lic["is_used"]:
        raise HTTPException(status_code=400, detail="License key already in use")
        
    if lic["is_banned"]:
        raise HTTPException(status_code=400, detail="License key has been banned")
        
    if db.users_collection.find_one({"username": data.username, "app_id": data.app_id}):
        raise HTTPException(status_code=400, detail="Username already exists in this application")
        
    expiry = None
    if lic["duration_days"] > 0:
        expiry = (datetime.utcnow() + timedelta(days=lic["duration_days"])).isoformat()
    else:
        expiry = "Lifetime"
        
    user_doc = {
        "username": data.username,
        "password": db.hash_password(data.password),
        "role": "user",
        "app_id": data.app_id,
        "license_key": data.license_key,
        "hwid": data.hwid,
        "created_at": datetime.utcnow().isoformat()
    }
    db.users_collection.insert_one(user_doc)
    
    db.licenses_collection.update_one(
        {"key": data.license_key},
        {
            "$set": {
                "is_used": True,
                "used_by": data.username,
                "expires_at": expiry,
                "hwid": data.hwid
            }
        }
    )
    
    # Determine Subscription Level
    sub_level = 1
    if lic.get("subscription_id"):
        sub_doc = db.subscriptions_collection.find_one({"id": lic["subscription_id"], "app_id": data.app_id})
        if sub_doc:
            sub_level = sub_doc["level"]

    log_event(data.app_id, "Register", f"User '{data.username}' registered using key '{data.license_key}'")
    return {
        "status": "success",
        "message": "Registration successful",
        "expires_at": expiry,
        "subscription_level": sub_level
    }

@app.post("/api/client/login")
def client_login(data: models.ClientLogin):
    app = db.apps_collection.find_one({"id": data.app_id})
    if not app:
        raise HTTPException(status_code=400, detail="Invalid Application ID")
        
    user = db.users_collection.find_one({"username": data.username, "app_id": data.app_id})
    if not user:
        raise HTTPException(status_code=400, detail="Invalid username or password")
        
    if not db.verify_password(data.password, user["password"]):
        raise HTTPException(status_code=400, detail="Invalid username or password")
        
    lic = db.licenses_collection.find_one({"key": user["license_key"], "app_id": data.app_id})
    if not lic:
        raise HTTPException(status_code=400, detail="No license linked to this user")
        
    if lic["is_banned"]:
        raise HTTPException(status_code=403, detail="Your license has been banned")
        
    if lic["expires_at"] and lic["expires_at"] != "Lifetime":
        exp_time = datetime.fromisoformat(lic["expires_at"])
        if datetime.utcnow() > exp_time:
            raise HTTPException(status_code=403, detail="Your license has expired")
            
    rules = app.get("rules", {})
    if rules.get("block_dev_mode", False):
        pass # Placeholder for client dev mode check
        
    if rules.get("hwid_lock", True):
        if not user.get("hwid"):
            db.users_collection.update_one({"username": data.username, "app_id": data.app_id}, {"$set": {"hwid": data.hwid}})
            db.licenses_collection.update_one({"key": user["license_key"]}, {"$set": {"hwid": data.hwid}})
        elif user["hwid"] != data.hwid:
            raise HTTPException(status_code=403, detail="HWID mismatch. Please reset HWID on the dashboard")
        
    # Determine Subscription Level
    sub_level = 1
    if user.get("subscription_id"):
        sub_doc = db.subscriptions_collection.find_one({"id": user["subscription_id"], "app_id": data.app_id})
        if sub_doc:
            sub_level = sub_doc["level"]
    elif lic.get("subscription_id"):
        sub_doc = db.subscriptions_collection.find_one({"id": lic["subscription_id"], "app_id": data.app_id})
        if sub_doc:
            sub_level = sub_doc["level"]

    session_id = uuid.uuid4().hex
    db.sessions_collection.insert_one({
        "session_id": session_id,
        "app_id": data.app_id,
        "username": data.username,
        "hwid": data.hwid,
        "login_time": datetime.utcnow().isoformat()
    })

    log_event(data.app_id, "Login", f"User '{data.username}' logged in successfully from HWID '{data.hwid}'")
    return {
        "status": "success",
        "message": "Login successful",
        "expires_at": lic["expires_at"],
        "subscription_level": sub_level
    }

@app.post("/api/client/license_login")
def client_license_login(data: models.ClientLicenseLogin):
    app = db.apps_collection.find_one({"id": data.app_id})
    if not app:
        raise HTTPException(status_code=400, detail="Invalid Application ID")
        
    lic = db.licenses_collection.find_one({"key": data.license_key, "app_id": data.app_id})
    if not lic:
        raise HTTPException(status_code=400, detail="Invalid license key for this application")
        
    if lic["is_banned"]:
        raise HTTPException(status_code=403, detail="Your license has been banned")
        
    if not lic["is_used"]:
        expiry = None
        if lic["duration_days"] > 0:
            expiry = (datetime.utcnow() + timedelta(days=lic["duration_days"])).isoformat()
        else:
            expiry = "Lifetime"
            
        db.licenses_collection.update_one(
            {"key": data.license_key},
            {
                "$set": {
                    "is_used": True,
                    "used_by": "Key-Only",
                    "expires_at": expiry,
                    "hwid": data.hwid
                }
            }
        )
        lic = db.licenses_collection.find_one({"key": data.license_key})
    else:
        if lic["expires_at"] and lic["expires_at"] != "Lifetime":
            exp_time = datetime.fromisoformat(lic["expires_at"])
            if datetime.utcnow() > exp_time:
                raise HTTPException(status_code=403, detail="Your license has expired")
                
        rules = app.get("rules", {})
        if rules.get("hwid_lock", True):
            if not lic.get("hwid"):
                db.licenses_collection.update_one({"key": data.license_key}, {"$set": {"hwid": data.hwid}})
            elif lic["hwid"] != data.hwid:
                raise HTTPException(status_code=403, detail="HWID mismatch. Please reset HWID on the dashboard")
            
    # Determine Subscription Level
    sub_level = 1
    if lic.get("subscription_id"):
        sub_doc = db.subscriptions_collection.find_one({"id": lic["subscription_id"], "app_id": data.app_id})
        if sub_doc:
            sub_level = sub_doc["level"]

    session_id = uuid.uuid4().hex
    db.sessions_collection.insert_one({
        "session_id": session_id,
        "app_id": data.app_id,
        "username": "LicenseOnly",
        "hwid": data.hwid,
        "login_time": datetime.utcnow().isoformat()
    })

    log_event(data.app_id, "License Login", f"License '{data.license_key}' logged in successfully from HWID '{data.hwid}'")
    return {
        "status": "success",
        "message": "License login successful",
        "expires_at": lic["expires_at"],
        "subscription_level": sub_level
    }

# --- VARIABLES ---
@app.get("/api/admin/variables")
def list_variables(app_id: str, username: str = Depends(get_current_admin)):
    verify_app_owner(app_id, username)
    vars = list(db.variables_collection.find({"app_id": app_id}, {"_id": 0}))
    return vars

@app.post("/api/admin/variables")
def create_variable(data: models.VariableCreate, username: str = Depends(get_current_admin)):
    verify_app_owner(data.app_id, username)
    if db.variables_collection.find_one({"app_id": data.app_id, "name": data.name}):
        raise HTTPException(status_code=400, detail="Variable with this name already exists")
    var_doc = {"app_id": data.app_id, "name": data.name, "value": data.value}
    db.variables_collection.insert_one(var_doc)
    log_event(data.app_id, "Variable Create", f"Created variable '{data.name}'")
    return {"status": "success"}

@app.delete("/api/admin/variables/{name}")
def delete_variable(name: str, app_id: str, username: str = Depends(get_current_admin)):
    verify_app_owner(app_id, username)
    db.variables_collection.delete_one({"app_id": app_id, "name": name})
    log_event(app_id, "Variable Delete", f"Deleted variable '{name}'")
    return {"status": "success"}

@app.post("/api/client/variable")
def client_get_variable(data: models.ClientVariableRequest):
    var = db.variables_collection.find_one({"app_id": data.app_id, "name": data.name})
    if not var:
        raise HTTPException(status_code=404, detail="Variable not found")
    return {"status": "success", "value": var["value"]}

# --- WEBHOOKS ---
@app.get("/api/admin/webhooks")
def list_webhooks(app_id: str, username: str = Depends(get_current_admin)):
    verify_app_owner(app_id, username)
    hooks = list(db.webhooks_collection.find({"app_id": app_id}, {"_id": 0}))
    return hooks

@app.post("/api/admin/webhooks")
def create_webhook(data: models.WebhookCreate, username: str = Depends(get_current_admin)):
    verify_app_owner(data.app_id, username)
    if db.webhooks_collection.find_one({"app_id": data.app_id, "name": data.name}):
        raise HTTPException(status_code=400, detail="Webhook with this name already exists")
    hook_doc = {"app_id": data.app_id, "name": data.name, "url": data.url}
    db.webhooks_collection.insert_one(hook_doc)
    log_event(data.app_id, "Webhook Create", f"Created webhook '{data.name}'")
    return {"status": "success"}

@app.delete("/api/admin/webhooks/{name}")
def delete_webhook(name: str, app_id: str, username: str = Depends(get_current_admin)):
    verify_app_owner(app_id, username)
    db.webhooks_collection.delete_one({"app_id": app_id, "name": name})
    log_event(app_id, "Webhook Delete", f"Deleted webhook '{name}'")
    return {"status": "success"}

@app.post("/api/client/webhook")
def client_trigger_webhook(data: models.ClientWebhookRequest):
    hook = db.webhooks_collection.find_one({"app_id": data.app_id, "name": data.name})
    if not hook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    try:
        resp = requests.post(hook["url"], json=data.payload, timeout=5)
        return {"status": "success", "response": resp.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- SUBSCRIPTIONS ---
@app.get("/api/admin/subscriptions")
def list_subscriptions(app_id: str, username: str = Depends(get_current_admin)):
    verify_app_owner(app_id, username)
    subs = list(db.subscriptions_collection.find({"app_id": app_id}, {"_id": 0}))
    return subs

@app.post("/api/admin/subscriptions")
def create_subscription(data: models.SubscriptionCreate, username: str = Depends(get_current_admin)):
    verify_app_owner(data.app_id, username)
    sub_id = f"SUB-{uuid.uuid4().hex[:8]}"
    sub_doc = {
        "id": sub_id,
        "app_id": data.app_id,
        "name": data.name,
        "level": data.level
    }
    db.subscriptions_collection.insert_one(sub_doc)
    log_event(data.app_id, "Subscription Create", f"Created subscription '{data.name}' (Level {data.level})")
    return {"status": "success", "id": sub_id}

@app.delete("/api/admin/subscriptions/{sub_id}")
def delete_subscription(sub_id: str, app_id: str, username: str = Depends(get_current_admin)):
    verify_app_owner(app_id, username)
    db.subscriptions_collection.delete_one({"app_id": app_id, "id": sub_id})
    log_event(app_id, "Subscription Delete", f"Deleted subscription '{sub_id}'")
    return {"status": "success"}

# --- TOKENS ---
@app.get("/api/admin/tokens")
def list_tokens(app_id: str, username: str = Depends(get_current_admin)):
    verify_app_owner(app_id, username)
    tokens = list(db.tokens_collection.find({"app_id": app_id}, {"_id": 0}))
    return tokens

@app.post("/api/admin/tokens")
def generate_tokens(data: models.TokenGenerate, username: str = Depends(get_current_admin)):
    verify_app_owner(data.app_id, username)
    generated_tokens = []
    now = datetime.utcnow()
    
    for _ in range(data.count):
        token_str = f"TKN-{uuid.uuid4().hex[:12].upper()}"
        token_doc = {
            "token": token_str,
            "app_id": data.app_id,
            "duration_days": data.duration_days,
            "subscription_id": data.subscription_id,
            "is_used": False,
            "used_by": None,
            "note": data.note or "",
            "created_at": now.isoformat()
        }
        db.tokens_collection.insert_one(token_doc)
        generated_tokens.append(token_str)
        
    log_event(data.app_id, "Token Generate", f"Generated {data.count} tokens")
    return {"status": "success", "tokens": generated_tokens}

@app.delete("/api/admin/tokens/{token}")
def delete_token(token: str, app_id: str, username: str = Depends(get_current_admin)):
    verify_app_owner(app_id, username)
    db.tokens_collection.delete_one({"app_id": app_id, "token": token})
    log_event(app_id, "Token Delete", f"Deleted token '{token}'")
    return {"status": "success"}

@app.post("/api/client/redeem")
def client_redeem_token(data: models.ClientRedeemRequest):
    user = db.users_collection.find_one({"username": data.username, "app_id": data.app_id})
    if not user or not db.verify_password(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
        
    if user["hwid"] and user["hwid"] != data.hwid:
        raise HTTPException(status_code=403, detail="HWID mismatch")
        
    token_doc = db.tokens_collection.find_one({"token": data.token, "app_id": data.app_id})
    if not token_doc:
        raise HTTPException(status_code=404, detail="Token not found")
        
    if token_doc["is_used"]:
        raise HTTPException(status_code=400, detail="Token has already been used")
        
    lic = db.licenses_collection.find_one({"key": user["license_key"]})
    if not lic:
        raise HTTPException(status_code=404, detail="User license not found")
        
    # Add time
    current_expiry = lic.get("expires_at")
    if current_expiry and current_expiry != "Lifetime":
        exp_time = datetime.fromisoformat(current_expiry)
        if datetime.utcnow() > exp_time:
            exp_time = datetime.utcnow() # Reset if already expired
        new_expiry = (exp_time + timedelta(days=token_doc["duration_days"])).isoformat()
    else:
        new_expiry = (datetime.utcnow() + timedelta(days=token_doc["duration_days"])).isoformat()
        
    update_data = {"expires_at": new_expiry}
    if token_doc.get("subscription_id"):
        update_data["subscription_id"] = token_doc["subscription_id"]
        db.users_collection.update_one({"username": data.username}, {"$set": {"subscription_id": token_doc["subscription_id"]}})
        
    db.licenses_collection.update_one({"key": user["license_key"]}, {"$set": update_data})
    db.tokens_collection.update_one({"token": data.token}, {"$set": {"is_used": True, "used_by": data.username}})
    
    log_event(data.app_id, "Token Redeem", f"User '{data.username}' redeemed token '{data.token}'")
    return {"status": "success", "message": "Token redeemed successfully", "new_expires_at": new_expiry}

# ==========================================
# PHASE 3: SESSIONS, FILES, CHATS, RULES, RESOURCES
# ==========================================
import shutil

@app.get("/api/admin/sessions")
def get_sessions(app_id: str, username: str = Depends(get_current_admin)):
    verify_app_owner(app_id, username)
    sessions = list(db.sessions_collection.find({"app_id": app_id}, {"_id": 0}))
    return sessions

@app.delete("/api/admin/sessions/{session_id}")
def delete_session(session_id: str, app_id: str, username: str = Depends(get_current_admin)):
    verify_app_owner(app_id, username)
    db.sessions_collection.delete_one({"app_id": app_id, "session_id": session_id})
    return {"status": "success"}

@app.post("/api/admin/files")
def upload_file(app_id: str = Form(...), file: UploadFile = File(...), username: str = Depends(get_current_admin)):
    verify_app_owner(app_id, username)
    file_id = uuid.uuid4().hex
    os.makedirs("uploads", exist_ok=True)
    file_path = os.path.join("uploads", f"{file_id}_{file.filename}")
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    db.files_collection.insert_one({
        "id": file_id,
        "app_id": app_id,
        "filename": file.filename,
        "size": os.path.getsize(file_path),
        "uploaded_at": datetime.utcnow().isoformat()
    })
    return {"status": "success"}

@app.get("/api/admin/files")
def get_files(app_id: str, username: str = Depends(get_current_admin)):
    verify_app_owner(app_id, username)
    files = list(db.files_collection.find({"app_id": app_id}, {"_id": 0}))
    return files

@app.delete("/api/admin/files/{file_id}")
def delete_file(file_id: str, app_id: str, username: str = Depends(get_current_admin)):
    verify_app_owner(app_id, username)
    file_doc = db.files_collection.find_one({"id": file_id, "app_id": app_id})
    if file_doc:
        file_path = os.path.join("uploads", f"{file_id}_{file_doc['filename']}")
        if os.path.exists(file_path):
            os.remove(file_path)
        db.files_collection.delete_one({"id": file_id})
    return {"status": "success"}

@app.post("/api/client/files/{file_id}")
def client_download_file(file_id: str, data: models.ClientLogin):
    user = db.users_collection.find_one({"username": data.username, "app_id": data.app_id})
    if not user or not db.verify_password(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if user["hwid"] and user["hwid"] != data.hwid:
        raise HTTPException(status_code=403, detail="HWID mismatch")
        
    file_doc = db.files_collection.find_one({"id": file_id, "app_id": data.app_id})
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
        
    file_path = os.path.join("uploads", f"{file_id}_{file_doc['filename']}")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File missing on server")
        
    return FileResponse(file_path, filename=file_doc['filename'])

@app.get("/api/admin/chats")
def admin_get_chats(app_id: str, username: str = Depends(get_current_admin)):
    verify_app_owner(app_id, username)
    chats = list(db.chats_collection.find({"app_id": app_id}, {"_id": 0}).sort("timestamp", -1).limit(100))
    return chats

@app.delete("/api/admin/chats/{message_id}")
def admin_delete_chat(message_id: str, app_id: str, username: str = Depends(get_current_admin)):
    verify_app_owner(app_id, username)
    db.chats_collection.delete_one({"id": message_id, "app_id": app_id})
    return {"status": "success"}

@app.post("/api/client/chat")
def client_send_chat(data: models.ClientChatRequest):
    user = db.users_collection.find_one({"username": data.username, "app_id": data.app_id})
    if not user or not db.verify_password(data.password, user["password"]) or user["hwid"] != data.hwid:
        raise HTTPException(status_code=401, detail="Unauthorized")
        
    msg_id = uuid.uuid4().hex
    db.chats_collection.insert_one({
        "id": msg_id, "app_id": data.app_id, "username": data.username,
        "message": data.message, "timestamp": datetime.utcnow().isoformat()
    })
    return {"status": "success"}

@app.post("/api/client/chat/fetch")
def client_get_chats(data: models.ClientChatRequest):
    user = db.users_collection.find_one({"username": data.username, "app_id": data.app_id})
    if not user or not db.verify_password(data.password, user["password"]) or user["hwid"] != data.hwid:
        raise HTTPException(status_code=401, detail="Unauthorized")
        
    chats = list(db.chats_collection.find({"app_id": data.app_id}, {"_id": 0}).sort("timestamp", 1).limit(50))
    return {"status": "success", "messages": chats}

@app.put("/api/admin/apps/{app_id}/rules")
def update_app_rules(app_id: str, rules: models.AppRulesUpdate, username: str = Depends(get_current_admin)):
    verify_app_owner(app_id, username)
    db.apps_collection.update_one({"id": app_id}, {"$set": {"rules": rules.dict()}})
    return {"status": "success"}

@app.post("/api/admin/resources")
def create_resource(data: models.ResourceCreate, username: str = Depends(get_current_admin)):
    verify_app_owner(data.app_id, username)
    res_id = uuid.uuid4().hex
    db.resources_collection.insert_one({
        "id": res_id, "app_id": data.app_id, "title": data.title,
        "content": data.content, "created_at": datetime.utcnow().isoformat()
    })
    return {"status": "success"}

@app.get("/api/admin/resources")
def get_resources(app_id: str, username: str = Depends(get_current_admin)):
    verify_app_owner(app_id, username)
    resources = list(db.resources_collection.find({"app_id": app_id}, {"_id": 0}))
    return resources

@app.delete("/api/admin/resources/{res_id}")
def delete_resource(res_id: str, app_id: str, username: str = Depends(get_current_admin)):
    verify_app_owner(app_id, username)
    db.resources_collection.delete_one({"id": res_id, "app_id": app_id})
    return {"status": "success"}

@app.post("/api/client/resources")
def client_get_resources(data: models.ClientLogin):
    user = db.users_collection.find_one({"username": data.username, "app_id": data.app_id})
    if not user or not db.verify_password(data.password, user["password"]) or user["hwid"] != data.hwid:
        raise HTTPException(status_code=401, detail="Unauthorized")
    resources = list(db.resources_collection.find({"app_id": data.app_id}, {"_id": 0}))
    return {"status": "success", "resources": resources}

# --- PAGE ROUTING ---
@app.get("/")
def home(request: Request):
    return FileResponse("static/index.html")

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/dashboard")
def dashboard_page(request: Request):
    return templates.TemplateResponse(request=request, name="dashboard.html", context={})

@app.get("/login")
def login_redirect(request: Request):
    return RedirectResponse(url="/dashboard")

# Serve static files
app.mount("/static", StaticFiles(directory="static"), name="static")
