import os
import uuid
import time
import hmac
import hashlib
import json
import base64
import secrets
import string
import pyotp
import requests
from datetime import datetime, timedelta, timezone
from typing import List

def generate_app_key(prefix: str = "AnikXCheats") -> str:
    """Generates a license key in the format: {Prefix}-{4_random_chars} (e.g. AnikXCheats-TTgq)"""
    if not prefix or not str(prefix).strip():
        prefix = "AnikXCheats"
    cleaned_prefix = "".join(c for c in str(prefix).strip() if c.isalnum() or c in "-_")
    if not cleaned_prefix:
        cleaned_prefix = "AnikXCheats"
        
    chars = string.ascii_letters + string.digits
    while True:
        suffix = "".join(secrets.choice(chars) for _ in range(4))
        key = f"{cleaned_prefix}-{suffix}"
        if not db.licenses_collection.find_one({"key": key}):
            return key


from fastapi import FastAPI, Request, Response, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import JSONResponse, RedirectResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from dotenv import load_dotenv

import database as db
import models

load_dotenv()

# Initialize FastAPI
app = FastAPI(title="Anik X Cheats Licensing System")

# Enable GZip Compression for High Traffic / Speed Optimization
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# JWT Secret - Read from System Env Vars or generate random secret per boot if not set
JWT_SECRET = os.getenv("JWT_SECRET") or secrets.token_hex(32)

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
    if not payload or payload.get("role") != "admin":
        raise HTTPException(status_code=401, detail="Invalid session token")
    return payload["username"]

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
    logs = list(db.logs_collection.find(query, {"_id": 0}).sort("timestamp", -1).limit(limit))
    return logs

# --- ADMIN LOGIN / LOGOUT / REGISTER ---
@app.post("/api/admin/register")
def admin_register(data: models.AdminRegister):
    if db.users_collection.find_one({"username": data.username, "role": "admin"}):
        raise HTTPException(status_code=400, detail="Username already exists")
        
    user_doc = {
        "username": data.username,
        "password": db.hash_password(data.password),
        "role": "admin",
        "created_at": datetime.utcnow().isoformat()
    }
    db.users_collection.insert_one(user_doc)
    return {"status": "success", "message": "Registered successfully"}

@app.post("/api/admin/login")
def admin_login(data: models.AdminLogin, response: Response):
    user = db.users_collection.find_one({"username": data.username, "role": "admin"})
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
        "role": "admin",
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
    return {"status": "success", "message": "Logged in successfully"}

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
    user = db.users_collection.find_one({"username": username, "role": "admin"})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"is_2fa_enabled": user.get("is_2fa_enabled", False)}

@app.post("/api/admin/2fa/setup")
def setup_2fa(username: str = Depends(get_current_admin)):
    user = db.users_collection.find_one({"username": username, "role": "admin"})
    if user.get("is_2fa_enabled"):
        raise HTTPException(status_code=400, detail="2FA is already enabled")
        
    secret = pyotp.random_base32()
    # Save the pending secret
    db.users_collection.update_one({"username": username}, {"$set": {"totp_secret": secret}})
    
    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(name=username, issuer_name="Auth AXC")
    
    return {"status": "success", "secret": secret, "uri": provisioning_uri}

@app.post("/api/admin/2fa/verify")
def verify_and_enable_2fa(data: Verify2FA, username: str = Depends(get_current_admin)):
    user = db.users_collection.find_one({"username": username, "role": "admin"})
    if not user or not user.get("totp_secret"):
        raise HTTPException(status_code=400, detail="2FA setup not initiated")
        
    totp = pyotp.TOTP(user["totp_secret"])
    if not totp.verify(data.code):
        raise HTTPException(status_code=400, detail="Invalid 2FA code")
        
    db.users_collection.update_one({"username": username}, {"$set": {"is_2fa_enabled": True}})
    return {"status": "success", "message": "2FA successfully enabled"}

@app.post("/api/admin/2fa/disable")
def disable_2fa(data: Verify2FA, username: str = Depends(get_current_admin)):
    user = db.users_collection.find_one({"username": username, "role": "admin"})
    if not user or not user.get("is_2fa_enabled"):
        raise HTTPException(status_code=400, detail="2FA is not enabled")
        
    totp = pyotp.TOTP(user["totp_secret"])
    if not totp.verify(data.code):
        raise HTTPException(status_code=400, detail="Invalid 2FA code")
        
    db.users_collection.update_one({"username": username}, {"$set": {"is_2fa_enabled": False, "totp_secret": None}})
    return {"status": "success", "message": "2FA disabled successfully"}

# --- PLATFORM ADMINS MANAGEMENT ---
@app.get("/api/admin/platform_users")
def list_platform_users(username: str = Depends(get_current_admin)):
    admins = list(db.users_collection.find({"role": "admin"}, {"_id": 0, "password": 0}))
    return admins

@app.delete("/api/admin/platform_users/{target_username}")
def delete_platform_user(target_username: str, username: str = Depends(get_current_admin)):
    if target_username == username:
        raise HTTPException(status_code=400, detail="You cannot delete your own admin account")
    
    admin = db.users_collection.find_one({"username": target_username, "role": "admin"})
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
        
    db.users_collection.delete_one({"username": target_username, "role": "admin"})
    return {"status": "success", "message": f"Admin '{target_username}' deleted"}

# --- SYSTEM DB DIAGNOSTICS ---
@app.get("/api/admin/system/db_status")
def get_db_status(username: str = Depends(get_current_admin)):
    cluster_databases = []
    try:
        db_names = [d for d in db.client.list_database_names() if d not in ["admin", "local", "config"]]
        for name in db_names:
            c_db = db.client[name]
            cols = c_db.list_collection_names()
            apps_count = c_db["apps"].count_documents({}) if "apps" in cols else 0
            lic_count = c_db["licenses"].count_documents({}) if "licenses" in cols else 0
            users_count = c_db["users"].count_documents({}) if "users" in cols else 0
            cluster_databases.append({
                "name": name,
                "is_current": name == db.db.name,
                "apps_count": apps_count,
                "licenses_count": lic_count,
                "users_count": users_count
            })
    except Exception as e:
        cluster_databases = [{"error": str(e)}]
        
    return {
        "status": "success",
        "current_database": db.db.name,
        "cluster_databases": cluster_databases
    }

# --- ADMIN APP MANAGEMENT ---
@app.post("/api/admin/apps")
def create_app(data: models.AppCreate, username: str = Depends(get_current_admin)):
    app_id = f"APP-{uuid.uuid4().hex[:8].upper()}"
    app_secret = uuid.uuid4().hex
    
    app_doc = {
        "id": app_id,
        "name": data.name,
        "secret": app_secret,
        "owner_username": username,
        "created_at": datetime.utcnow().isoformat()
    }
    db.apps_collection.insert_one(app_doc)
    log_event(app_id, "App Create", f"Created application '{data.name}'")
    return {"status": "success", "app": {"id": app_id, "name": data.name, "secret": app_secret}}

@app.get("/api/admin/apps")
def list_apps(username: str = Depends(get_current_admin)):
    apps = list(db.apps_collection.find({}, {"_id": 0}))
    return apps

@app.put("/api/admin/apps/{app_id}")
def rename_app(app_id: str, data: models.AppRename, username: str = Depends(get_current_admin)):
    app = db.apps_collection.find_one({"id": app_id})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    db.apps_collection.update_one({"id": app_id}, {"$set": {"name": data.name}})
    log_event(app_id, "App Rename", f"Renamed application from '{app.get('name', '')}' to '{data.name}'")
    return {"status": "success", "message": "Application renamed successfully"}

@app.delete("/api/admin/apps/{app_id}")
def delete_app(app_id: str, username: str = Depends(get_current_admin)):
    app = db.apps_collection.find_one({"id": app_id})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    db.apps_collection.delete_one({"id": app_id})
    db.users_collection.delete_many({"app_id": app_id})
    db.licenses_collection.delete_many({"app_id": app_id})
    db.logs_collection.delete_many({"app_id": app_id})
    return {"status": "success", "message": "Application and all associated data deleted"}

# --- LICENSE STATUS & TIME HELPERS ---
def _parse_iso_datetime(dt_str: str) -> tuple[datetime, datetime]:
    """Returns (exp_time, now_time) both either aware (UTC) or naive."""
    cleaned = dt_str.replace("Z", "+00:00")
    exp_time = datetime.fromisoformat(cleaned)
    if exp_time.tzinfo is not None:
        now_time = datetime.now(timezone.utc)
    else:
        now_time = datetime.utcnow()
    return exp_time, now_time

def get_license_status(lic: dict) -> str:
    if lic.get("is_revoked"):
        return "REVOKED"
    if lic.get("is_banned"):
        return "BANNED"
    if lic.get("is_paused"):
        return "PAUSED"
    if not lic.get("is_used"):
        return "UNUSED"
    expires_at = lic.get("expires_at")
    if expires_at and expires_at != "Lifetime":
        try:
            exp_time, now_time = _parse_iso_datetime(expires_at)
            if now_time > exp_time:
                return "EXPIRED"
        except Exception:
            pass
    return "ACTIVE"

def get_remaining_time_str(expires_at: str, status: str) -> str:
    if status in ["BANNED", "REVOKED"]:
        return status.capitalize()
    if status == "PAUSED":
        return "Paused"
    if not expires_at:
        return "Unused"
    if expires_at == "Lifetime":
        return "Lifetime"
    try:
        exp_time, now_time = _parse_iso_datetime(expires_at)
        if now_time >= exp_time:
            return "Expired"
        diff = exp_time - now_time
        days = diff.days
        hours, rem = divmod(diff.seconds, 3600)
        minutes, _ = divmod(rem, 60)
        if days > 0:
            return f"{days}d {hours:02d}h"
        elif hours > 0:
            return f"{hours}h {minutes:02d}m"
        else:
            return f"{minutes}m"
    except Exception:
        return "N/A"

def format_license_doc(lic: dict) -> dict:
    status = get_license_status(lic)
    remaining = get_remaining_time_str(lic.get("expires_at"), status)
    doc = dict(lic)
    doc["status"] = status
    doc["remaining_time"] = remaining
    return doc

# --- ADMIN LICENSE MANAGEMENT ---
@app.get("/api/admin/licenses")
def list_licenses(
    app_id: str = None,
    search: str = None,
    status: str = None,
    page: int = None,
    limit: int = None,
    username: str = Depends(get_current_admin)
):
    query = {}
    if app_id:
        query["app_id"] = app_id
        
    raw_licenses = list(db.licenses_collection.find(query, {"_id": 0}).sort("created_at", -1))
    
    formatted = []
    now_iso = datetime.utcnow().isoformat()
    now_dt = datetime.utcnow()
    
    for lic in raw_licenses:
        doc = format_license_doc(lic)
        
        # Search filter (key, user, hwid, note)
        if search and search.strip():
            s = search.strip().lower()
            key_match = s in doc.get("key", "").lower()
            user_match = s in (doc.get("used_by") or "").lower()
            hwid_match = s in (doc.get("hwid") or "").lower()
            note_match = s in (doc.get("note") or "").lower()
            if not (key_match or user_match or hwid_match or note_match):
                continue
                
        # Status filter
        if status and status.lower() != "all":
            stat = status.upper()
            if stat == "ACTIVE":
                if doc["status"] != "ACTIVE":
                    continue
            elif stat == "UNUSED":
                if doc["status"] != "UNUSED":
                    continue
            elif stat == "USED":
                if not doc.get("is_used"):
                    continue
            elif stat == "EXPIRED":
                if doc["status"] != "EXPIRED":
                    continue
            elif stat == "PAUSED":
                if doc["status"] != "PAUSED":
                    continue
            elif stat == "BANNED":
                if doc["status"] != "BANNED":
                    continue
            elif stat == "REVOKED":
                if doc["status"] != "REVOKED":
                    continue
                    
        formatted.append(doc)
        
    total_count = len(formatted)
    
    # If pagination parameters requested
    if page is not None and limit is not None and limit > 0:
        start = (page - 1) * limit
        end = start + limit
        paginated = formatted[start:end]
        import math
        return {
            "licenses": paginated,
            "total": total_count,
            "page": page,
            "limit": limit,
            "total_pages": math.ceil(total_count / limit) if total_count > 0 else 1
        }
        
    return formatted

@app.post("/api/admin/licenses")
def generate_licenses(data: models.LicenseGenerate, username: str = Depends(get_current_admin)):
    app = db.apps_collection.find_one({"id": data.app_id})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
        
    # Calculate duration
    total_days = (data.duration_days or 0) + ((data.duration_hours or 0) / 24.0) + ((data.duration_minutes or 0) / 1440.0)
    total_seconds = int((total_days * 86400))
    
    generated_keys = []
    now = datetime.utcnow()
    sub_id = data.subscription_id if data.subscription_id and data.subscription_id.strip() else None
    
    rules = app.get("rules") or {}
    custom_prefix = data.custom_prefix.strip() if data.custom_prefix and data.custom_prefix.strip() else (rules.get("key_prefix") or "AnikXCheats")
    
    for _ in range(data.count):
        key = generate_app_key(custom_prefix)
        lic_doc = {
            "key": key,
            "app_id": data.app_id,
            "duration_days": round(total_days, 4),
            "duration_seconds": total_seconds,
            "subscription_id": sub_id,
            "is_used": False,
            "used_by": None,
            "expires_at": None,
            "is_banned": False,
            "is_paused": False,
            "is_revoked": False,
            "note": data.note or "",
            "hwid": None,
            "created_at": now.isoformat()
        }
        db.licenses_collection.insert_one(lic_doc)
        generated_keys.append(key)
        
    duration_label = f"{round(total_days, 2)} days" if total_days > 0 else "Lifetime"
    log_event(data.app_id, "License Generate", f"Admin '{username}' generated {data.count} keys (duration: {duration_label}, prefix: {custom_prefix})")
    return {"status": "success", "keys": generated_keys}

# --- BULK, EXPIRED CLEANUP, EXPIRING SOON & STATS (Exact Routes First) ---
@app.post("/api/admin/licenses/bulk")
def bulk_license_action(data: models.BulkLicenseAction, username: str = Depends(get_current_admin)):
    keys = list(set(data.keys))
    if not keys:
        raise HTTPException(status_code=400, detail="No licenses provided")
        
    action = data.action.lower()
    updated = 0
    skipped = 0
    failed = 0
    
    if action == "delete":
        for k in keys:
            lic = db.licenses_collection.find_one({"key": k, "app_id": data.app_id})
            if lic:
                if lic.get("used_by") and lic["used_by"] not in ["Key-Only", "LicenseOnly"]:
                    db.users_collection.delete_one({"username": lic["used_by"], "app_id": data.app_id})
                db.licenses_collection.delete_one({"key": k, "app_id": data.app_id})
                updated += 1
            else:
                skipped += 1
        log_event(data.app_id, "Bulk Delete", f"Admin '{username}' bulk deleted {updated} licenses")
        
    elif action == "ban":
        res = db.licenses_collection.update_many(
            {"key": {"$in": keys}, "app_id": data.app_id},
            {"$set": {"is_banned": True}}
        )
        updated = res.modified_count
        log_event(data.app_id, "Bulk Ban", f"Admin '{username}' bulk banned {updated} licenses")
        
    elif action == "unban":
        res = db.licenses_collection.update_many(
            {"key": {"$in": keys}, "app_id": data.app_id},
            {"$set": {"is_banned": False, "is_revoked": False}}
        )
        updated = res.modified_count
        log_event(data.app_id, "Bulk Unban", f"Admin '{username}' bulk unbanned {updated} licenses")
        
    elif action == "pause":
        res = db.licenses_collection.update_many(
            {"key": {"$in": keys}, "app_id": data.app_id},
            {"$set": {"is_paused": True}}
        )
        updated = res.modified_count
        log_event(data.app_id, "Bulk Pause", f"Admin '{username}' bulk paused {updated} licenses")
        
    elif action == "unpause":
        res = db.licenses_collection.update_many(
            {"key": {"$in": keys}, "app_id": data.app_id},
            {"$set": {"is_paused": False}}
        )
        updated = res.modified_count
        log_event(data.app_id, "Bulk Unpause", f"Admin '{username}' bulk unpaused {updated} licenses")
        
    elif action == "revoke":
        res = db.licenses_collection.update_many(
            {"key": {"$in": keys}, "app_id": data.app_id},
            {"$set": {"is_revoked": True, "is_banned": True}}
        )
        updated = res.modified_count
        log_event(data.app_id, "Bulk Revoke", f"Admin '{username}' bulk revoked {updated} licenses")
        
    elif action == "reset_hwid":
        for k in keys:
            lic = db.licenses_collection.find_one({"key": k, "app_id": data.app_id})
            if lic:
                db.licenses_collection.update_one({"key": k}, {"$set": {"hwid": None}})
                if lic.get("used_by") and lic["used_by"] not in ["Key-Only", "LicenseOnly"]:
                    db.users_collection.update_one({"username": lic["used_by"], "app_id": data.app_id}, {"$set": {"hwid": None}})
                updated += 1
        log_event(data.app_id, "Bulk HWID Reset", f"Admin '{username}' bulk reset HWID for {updated} licenses")
        
    elif action == "extend":
        total_seconds = int(((data.extend_days or 0) * 86400) + ((data.extend_hours or 0) * 3600) + ((data.extend_minutes or 0) * 60))
        if total_seconds <= 0:
            raise HTTPException(status_code=400, detail="Extension duration must be greater than 0")
        now = datetime.utcnow()
        for k in keys:
            lic = db.licenses_collection.find_one({"key": k, "app_id": data.app_id})
            if not lic or lic.get("expires_at") == "Lifetime":
                skipped += 1
                continue
            if lic.get("is_used") and lic.get("expires_at"):
                try:
                    cur_exp = datetime.fromisoformat(lic["expires_at"])
                    base_time = max(cur_exp, now)
                except Exception:
                    base_time = now
                new_exp = base_time + timedelta(seconds=total_seconds)
                db.licenses_collection.update_one({"key": k}, {"$set": {"expires_at": new_exp.isoformat()}})
                updated += 1
            else:
                new_days = (lic.get("duration_days") or 0) + (total_seconds / 86400.0)
                db.licenses_collection.update_one({"key": k}, {"$set": {"duration_days": round(new_days, 4)}})
                updated += 1
        ext_label = f"{data.extend_days or 0}d {data.extend_hours or 0}h {data.extend_minutes or 0}m"
        log_event(data.app_id, "Bulk Extend", f"Admin '{username}' bulk extended {updated} licenses by {ext_label}")
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported bulk action: {action}")
        
    return {
        "status": "success",
        "action": action,
        "updated": updated,
        "skipped": skipped,
        "failed": failed,
        "message": f"Successfully performed {action} on {updated} licenses"
    }

@app.delete("/api/admin/licenses/cleanup/expired")
@app.delete("/api/admin/licenses/expired")
def delete_expired_licenses(app_id: str, username: str = Depends(get_current_admin)):
    now_iso = datetime.utcnow().isoformat()
    # Find expired licenses
    expired_licenses = list(db.licenses_collection.find({
        "app_id": app_id,
        "expires_at": {"$ne": "Lifetime", "$exists": True, "$ne": None, "$lt": now_iso}
    }))
    
    count = 0
    for lic in expired_licenses:
        if lic.get("used_by") and lic["used_by"] not in ["Key-Only", "LicenseOnly"]:
            db.users_collection.delete_one({"username": lic["used_by"], "app_id": app_id})
        db.licenses_collection.delete_one({"key": lic["key"], "app_id": app_id})
        count += 1
        
    log_event(app_id, "Expired Cleanup", f"Admin '{username}' cleaned up {count} expired licenses")
    return {"success": True, "deleted": count, "message": f"Deleted {count} expired licenses"}

@app.get("/api/admin/licenses/expiring_soon")
def list_expiring_soon(app_id: str, days: int = 7, username: str = Depends(get_current_admin)):
    now = datetime.utcnow()
    limit_time = (now + timedelta(days=days)).isoformat()
    now_iso = now.isoformat()
    
    licenses = list(db.licenses_collection.find({
        "app_id": app_id,
        "is_banned": False,
        "is_revoked": False,
        "expires_at": {
            "$ne": "Lifetime",
            "$exists": True,
            "$ne": None,
            "$gte": now_iso,
            "$lte": limit_time
        }
    }, {"_id": 0}).sort("expires_at", 1))
    
    formatted = [format_license_doc(lic) for lic in licenses]
    return {"status": "success", "licenses": formatted, "count": len(formatted)}

@app.get("/api/admin/stats")
def get_dashboard_stats(app_id: str = None, username: str = Depends(get_current_admin)):
    query = {}
    if app_id:
        query["app_id"] = app_id
        
    now = datetime.utcnow()
    now_iso = now.isoformat()
    today_start = datetime(now.year, now.month, now.day).isoformat()
    expiring_soon_limit = (now + timedelta(days=7)).isoformat()
    
    all_lics = list(db.licenses_collection.find(query, {"_id": 0}))
    total_licenses = len(all_lics)
    
    active_licenses = 0
    unused_licenses = 0
    expired_licenses = 0
    banned_licenses = 0
    paused_licenses = 0
    expiring_soon = 0
    
    for lic in all_lics:
        status = get_license_status(lic)
        if status == "ACTIVE":
            active_licenses += 1
            exp_at = lic.get("expires_at")
            if exp_at and exp_at != "Lifetime" and now_iso <= exp_at <= expiring_soon_limit:
                expiring_soon += 1
        elif status == "UNUSED":
            unused_licenses += 1
        elif status == "EXPIRED":
            expired_licenses += 1
        elif status == "BANNED" or status == "REVOKED":
            banned_licenses += 1
        elif status == "PAUSED":
            paused_licenses += 1
            
    # Active sessions query
    sess_query = {}
    if app_id:
        sess_query["app_id"] = app_id
    active_sessions = db.sessions_collection.count_documents(sess_query)
    
    # Today's activations
    today_activations_query = {"created_at": {"$gte": today_start}}
    if app_id:
        today_activations_query["app_id"] = app_id
    today_activations = db.licenses_collection.count_documents(today_activations_query)
    
    total_apps = db.apps_collection.count_documents({})
    
    return {
        "status": "success",
        "stats": {
            "total_apps": total_apps,
            "total_licenses": total_licenses,
            "active_licenses": active_licenses,
            "unused_licenses": unused_licenses,
            "expired_licenses": expired_licenses,
            "banned_licenses": banned_licenses,
            "paused_licenses": paused_licenses,
            "active_sessions": active_sessions,
            "today_activations": today_activations,
            "expiring_soon": expiring_soon
        }
    }

# --- SINGLE LICENSE ROUTES ---
@app.get("/api/admin/licenses/detail/{key}")
@app.get("/api/admin/licenses/{key}")
def get_license_detail(key: str, username: str = Depends(get_current_admin)):
    lic = db.licenses_collection.find_one({"key": key}, {"_id": 0})
    if not lic:
        raise HTTPException(status_code=404, detail="License key not found")
        
    formatted = format_license_doc(lic)
    user_info = None
    if lic.get("used_by") and lic["used_by"] != "Key-Only" and lic["used_by"] != "LicenseOnly":
        user_info = db.users_collection.find_one({"username": lic["used_by"], "app_id": lic["app_id"]}, {"_id": 0, "password": 0})
        
    recent_sessions = list(db.sessions_collection.find({"app_id": lic["app_id"], "$or": [{"username": lic.get("used_by")}, {"hwid": lic.get("hwid")}]}, {"_id": 0}).sort("login_time", -1).limit(5))
    
    return {
        "status": "success",
        "license": formatted,
        "user": user_info,
        "sessions": recent_sessions
    }

@app.post("/api/admin/licenses/{key}/extend")
def extend_license(key: str, data: models.LicenseExtend, username: str = Depends(get_current_admin)):
    lic = db.licenses_collection.find_one({"key": key})
    if not lic:
        raise HTTPException(status_code=404, detail="License key not found")
        
    total_seconds = int(((data.days or 0) * 86400) + ((data.hours or 0) * 3600) + ((data.minutes or 0) * 60))
    if total_seconds <= 0:
        raise HTTPException(status_code=400, detail="Extension duration must be greater than 0")
        
    if lic.get("expires_at") == "Lifetime":
        return {"status": "success", "message": "License is Lifetime, no extension needed", "expires_at": "Lifetime"}
        
    now = datetime.utcnow()
    new_expiry_str = None
    
    if lic.get("is_used") and lic.get("expires_at"):
        try:
            cur_exp = datetime.fromisoformat(lic["expires_at"])
            base_time = max(cur_exp, now)
        except Exception:
            base_time = now
        new_exp = base_time + timedelta(seconds=total_seconds)
        new_expiry_str = new_exp.isoformat()
        db.licenses_collection.update_one({"key": key}, {"$set": {"expires_at": new_expiry_str}})
    else:
        # Unused license: increase duration_days
        new_days = (lic.get("duration_days") or 0) + (total_seconds / 86400.0)
        db.licenses_collection.update_one({"key": key}, {"$set": {"duration_days": round(new_days, 4)}})
        
    ext_label = f"{data.days or 0}d {data.hours or 0}h {data.minutes or 0}m"
    log_event(lic["app_id"], "License Extend", f"Admin '{username}' extended key '{key}' by {ext_label}")
    return {"status": "success", "message": "License extended successfully", "new_expires_at": new_expiry_str}

@app.post("/api/admin/licenses/{key}/pause")
def pause_license(key: str, username: str = Depends(get_current_admin)):
    lic = db.licenses_collection.find_one({"key": key})
    if not lic:
        raise HTTPException(status_code=404, detail="License key not found")
    db.licenses_collection.update_one({"key": key}, {"$set": {"is_paused": True}})
    log_event(lic["app_id"], "License Pause", f"Admin '{username}' paused key '{key}'")
    return {"status": "success", "message": "License paused successfully"}

@app.post("/api/admin/licenses/{key}/unpause")
def unpause_license(key: str, username: str = Depends(get_current_admin)):
    lic = db.licenses_collection.find_one({"key": key})
    if not lic:
        raise HTTPException(status_code=404, detail="License key not found")
    db.licenses_collection.update_one({"key": key}, {"$set": {"is_paused": False}})
    log_event(lic["app_id"], "License Unpause", f"Admin '{username}' unpaused key '{key}'")
    return {"status": "success", "message": "License unpaused successfully"}

@app.post("/api/admin/licenses/{key}/revoke")
def revoke_license(key: str, username: str = Depends(get_current_admin)):
    lic = db.licenses_collection.find_one({"key": key})
    if not lic:
        raise HTTPException(status_code=404, detail="License key not found")
    db.licenses_collection.update_one({"key": key}, {"$set": {"is_revoked": True, "is_banned": True}})
    log_event(lic["app_id"], "License Revoke", f"Admin '{username}' revoked key '{key}'")
    return {"status": "success", "message": "License revoked successfully"}

# --- SELLER / PUBLIC API ENDPOINTS ---
@app.post("/api/seller/generate")
def seller_generate_licenses(data: models.SellerKeyGenerate):
    app = db.apps_collection.find_one({"id": data.app_id})
    if not app:
        raise HTTPException(status_code=404, detail="Invalid Application ID")
    if app.get("secret") != data.seller_key:
        raise HTTPException(status_code=401, detail="Invalid Seller Secret Key")
        
    generated_keys = []
    now = datetime.utcnow()
    sub_id = data.subscription_id if data.subscription_id and data.subscription_id.strip() else None
    
    rules = app.get("rules") or {}
    custom_prefix = rules.get("key_prefix") or "AnikXCheats"
    
    for _ in range(data.count):
        key = generate_app_key(custom_prefix)
        lic_doc = {
            "key": key,
            "app_id": data.app_id,
            "duration_days": data.duration_days,
            "subscription_id": sub_id,
            "is_used": False,
            "used_by": None,
            "expires_at": None,
            "is_banned": False,
            "is_paused": False,
            "is_revoked": False,
            "note": data.note or "API Generated",
            "hwid": None,
            "created_at": now.isoformat()
        }
        db.licenses_collection.insert_one(lic_doc)
        generated_keys.append(key)
        
    log_event(data.app_id, "Seller API Generate", f"Generated {data.count} keys via Seller API")
    return {"status": "success", "keys": generated_keys}

@app.post("/api/seller/user/create")
def seller_create_user(data: models.SellerUserCreate):
    app = db.apps_collection.find_one({"id": data.app_id})
    if not app:
        raise HTTPException(status_code=404, detail="Invalid Application ID")
    if app.get("secret") != data.seller_key:
        raise HTTPException(status_code=401, detail="Invalid Seller Secret Key")
        
    if db.users_collection.find_one({"username": data.username, "app_id": data.app_id}):
        raise HTTPException(status_code=400, detail="Username already exists")
        
    rules = app.get("rules") or {}
    custom_prefix = rules.get("key_prefix") or "AnikXCheats"
    key = generate_app_key(custom_prefix)
    
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
        "is_paused": False,
        "is_revoked": False,
        "note": data.note or "Seller API Created",
        "hwid": None,
        "created_at": datetime.utcnow().isoformat()
    }
    db.licenses_collection.insert_one(lic_doc)
    
    user_doc = {
        "app_id": data.app_id,
        "username": data.username,
        "password": db.hash_password(data.password),
        "license_key": key,
        "hwid": None,
        "subscription_id": data.subscription_id,
        "created_at": datetime.utcnow().isoformat()
    }
    db.users_collection.insert_one(user_doc)
    
    log_event(data.app_id, "Seller API User Create", f"User '{data.username}' created via Seller API")
    return {"status": "success", "username": data.username, "license_key": key, "expires_at": expiry}

@app.delete("/api/admin/licenses/{key}")
def delete_license(key: str, username: str = Depends(get_current_admin)):
    lic = db.licenses_collection.find_one({"key": key})
    if not lic:
        raise HTTPException(status_code=404, detail="License key not found")
        
    if lic.get("used_by") and lic["used_by"] not in ["Key-Only", "LicenseOnly"]:
        db.users_collection.delete_one({"username": lic["used_by"], "app_id": lic["app_id"]})
        
    db.licenses_collection.delete_one({"key": key})
    log_event(lic["app_id"], "License Delete", f"Deleted key '{key}'")
    return {"status": "success", "message": "License and associated user deleted"}

@app.post("/api/admin/licenses/{key}/ban")
def ban_license(key: str, username: str = Depends(get_current_admin)):
    lic = db.licenses_collection.find_one({"key": key})
    if not lic:
        raise HTTPException(status_code=404, detail="License key not found")
    db.licenses_collection.update_one({"key": key}, {"$set": {"is_banned": True}})
    log_event(lic["app_id"], "License Ban", f"Banned key '{key}'")
    return {"status": "success", "message": "License banned successfully"}

@app.post("/api/admin/licenses/{key}/unban")
def unban_license(key: str, username: str = Depends(get_current_admin)):
    lic = db.licenses_collection.find_one({"key": key})
    if not lic:
        raise HTTPException(status_code=404, detail="License key not found")
    db.licenses_collection.update_one({"key": key}, {"$set": {"is_banned": False, "is_revoked": False}})
    log_event(lic["app_id"], "License Unban", f"Unbanned key '{key}'")
    return {"status": "success", "message": "License unbanned successfully"}

@app.post("/api/admin/licenses/{key}/reset_hwid")
def reset_hwid(key: str, username: str = Depends(get_current_admin)):
    lic = db.licenses_collection.find_one({"key": key})
    if not lic:
        raise HTTPException(status_code=404, detail="License key not found")
        
    db.licenses_collection.update_one({"key": key}, {"$set": {"hwid": None}})
    if lic.get("used_by") and lic["used_by"] not in ["Key-Only", "LicenseOnly"]:
        db.users_collection.update_one({"username": lic["used_by"], "app_id": lic["app_id"]}, {"$set": {"hwid": None}})
        
    log_event(lic["app_id"], "HWID Reset", f"Reset HWID for key '{key}'")
    return {"status": "success", "message": "HWID reset successfully"}

# --- ADMIN USER MANAGEMENT ---
@app.get("/api/admin/users")
def list_users(app_id: str = None, username: str = Depends(get_current_admin)):
    query = {}
    if app_id:
        query["app_id"] = app_id
    users = list(db.users_collection.find(query, {"_id": 0, "password": 0}))
    return users

@app.post("/api/admin/users")
def create_user(data: models.UserCreate, username: str = Depends(get_current_admin)):
    app = db.apps_collection.find_one({"id": data.app_id})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
        
    if db.users_collection.find_one({"username": data.username, "app_id": data.app_id}):
        raise HTTPException(status_code=400, detail="Username already exists in this application")
        
    rules = app.get("rules") or {}
    custom_prefix = rules.get("key_prefix") or "AnikXCheats"
    key = generate_app_key(custom_prefix)
    
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
        
    if lic.get("is_banned") or lic.get("is_revoked"):
        raise HTTPException(status_code=400, detail="License key has been banned or revoked")
        
    if lic.get("is_paused"):
        raise HTTPException(status_code=400, detail="License key is currently paused by administrator")
        
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
        
    if lic.get("is_banned") or lic.get("is_revoked"):
        raise HTTPException(status_code=403, detail="Your license has been banned or revoked")
        
    if lic.get("is_paused"):
        raise HTTPException(status_code=403, detail="Your license is currently paused by administrator")
        
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
        "username": data.username,
        "license_key": user.get("license_key", ""),
        "expires_at": lic["expires_at"],
        "subscription_level": sub_level,
        "rules": rules
    }

@app.post("/api/client/license_login")
def client_license_login(data: models.ClientLicenseLogin):
    app = db.apps_collection.find_one({"id": data.app_id})
    if not app:
        raise HTTPException(status_code=400, detail="Invalid Application ID")
        
    lic = db.licenses_collection.find_one({"key": data.license_key, "app_id": data.app_id})
    if not lic:
        raise HTTPException(status_code=400, detail="Invalid license key for this application")
        
    if lic.get("is_banned") or lic.get("is_revoked"):
        raise HTTPException(status_code=403, detail="Your license has been banned or revoked")
        
    if lic.get("is_paused"):
        raise HTTPException(status_code=403, detail="Your license is currently paused by administrator")
        
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
        "username": lic.get("used_by") or "LicenseOnly",
        "license_key": data.license_key,
        "expires_at": lic["expires_at"],
        "subscription_level": sub_level,
        "rules": rules
    }

# --- VARIABLES ---
@app.get("/api/admin/variables")
def list_variables(app_id: str, username: str = Depends(get_current_admin)):
    vars = list(db.variables_collection.find({"app_id": app_id}, {"_id": 0}))
    return vars

@app.post("/api/admin/variables")
def create_variable(data: models.VariableCreate, username: str = Depends(get_current_admin)):
    if db.variables_collection.find_one({"app_id": data.app_id, "name": data.name}):
        raise HTTPException(status_code=400, detail="Variable with this name already exists")
    var_doc = {"app_id": data.app_id, "name": data.name, "value": data.value}
    db.variables_collection.insert_one(var_doc)
    log_event(data.app_id, "Variable Create", f"Created variable '{data.name}'")
    return {"status": "success"}

@app.delete("/api/admin/variables/{name}")
def delete_variable(name: str, app_id: str, username: str = Depends(get_current_admin)):
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
    hooks = list(db.webhooks_collection.find({"app_id": app_id}, {"_id": 0}))
    return hooks

@app.post("/api/admin/webhooks")
def create_webhook(data: models.WebhookCreate, username: str = Depends(get_current_admin)):
    if db.webhooks_collection.find_one({"app_id": data.app_id, "name": data.name}):
        raise HTTPException(status_code=400, detail="Webhook with this name already exists")
    hook_doc = {"app_id": data.app_id, "name": data.name, "url": data.url}
    db.webhooks_collection.insert_one(hook_doc)
    log_event(data.app_id, "Webhook Create", f"Created webhook '{data.name}'")
    return {"status": "success"}

@app.delete("/api/admin/webhooks/{name}")
def delete_webhook(name: str, app_id: str, username: str = Depends(get_current_admin)):
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
    subs = list(db.subscriptions_collection.find({"app_id": app_id}, {"_id": 0}))
    return subs

@app.post("/api/admin/subscriptions")
def create_subscription(data: models.SubscriptionCreate, username: str = Depends(get_current_admin)):
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
    db.subscriptions_collection.delete_one({"app_id": app_id, "id": sub_id})
    log_event(app_id, "Subscription Delete", f"Deleted subscription '{sub_id}'")
    return {"status": "success"}

# --- TOKENS ---
@app.get("/api/admin/tokens")
def list_tokens(app_id: str, username: str = Depends(get_current_admin)):
    tokens = list(db.tokens_collection.find({"app_id": app_id}, {"_id": 0}))
    return tokens

@app.post("/api/admin/tokens")
def generate_tokens(data: models.TokenGenerate, username: str = Depends(get_current_admin)):
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
    sessions = list(db.sessions_collection.find({"app_id": app_id}, {"_id": 0}))
    return sessions

@app.delete("/api/admin/sessions/{session_id}")
def delete_session(session_id: str, app_id: str, username: str = Depends(get_current_admin)):
    db.sessions_collection.delete_one({"app_id": app_id, "session_id": session_id})
    return {"status": "success"}

@app.post("/api/admin/files")
def upload_file(app_id: str = Form(...), file: UploadFile = File(...), username: str = Depends(get_current_admin)):
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
    files = list(db.files_collection.find({"app_id": app_id}, {"_id": 0}))
    return files

@app.delete("/api/admin/files/{file_id}")
def delete_file(file_id: str, app_id: str, username: str = Depends(get_current_admin)):
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
    chats = list(db.chats_collection.find({"app_id": app_id}, {"_id": 0}).sort("timestamp", -1).limit(100))
    return chats

@app.delete("/api/admin/chats/{message_id}")
def admin_delete_chat(message_id: str, app_id: str, username: str = Depends(get_current_admin)):
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
    app = db.apps_collection.find_one({"id": app_id})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    rules_dict = rules.dict()
    db.apps_collection.update_one({"id": app_id}, {"$set": {"rules": rules_dict}})
    log_event(app_id, "Rules Update", f"Updated security rules and key prefix to '{rules.key_prefix}'")
    return {"status": "success", "rules": rules_dict}

@app.post("/api/admin/resources")
def create_resource(data: models.ResourceCreate, username: str = Depends(get_current_admin)):
    res_id = uuid.uuid4().hex
    db.resources_collection.insert_one({
        "id": res_id, "app_id": data.app_id, "title": data.title,
        "content": data.content, "created_at": datetime.utcnow().isoformat()
    })
    return {"status": "success"}

@app.get("/api/admin/resources")
def get_resources(app_id: str, username: str = Depends(get_current_admin)):
    resources = list(db.resources_collection.find({"app_id": app_id}, {"_id": 0}))
    return resources

@app.delete("/api/admin/resources/{res_id}")
def delete_resource(res_id: str, app_id: str, username: str = Depends(get_current_admin)):
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
    return FileResponse("static/dashboard.html")

@app.get("/login")
def login_redirect(request: Request):
    return RedirectResponse(url="/dashboard")

# Serve static files
app.mount("/static", StaticFiles(directory="static"), name="static")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
