from pydantic import BaseModel, Field
from typing import Optional, List

class AdminLogin(BaseModel):
    username: str
    password: str
    totp_code: Optional[str] = None

class AdminRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=20)
    password: str = Field(..., min_length=4)

class AppCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=50)

class LicenseGenerate(BaseModel):
    app_id: str = Field(...)
    duration_days: Optional[float] = Field(default=0, ge=0, description="0 for lifetime, otherwise days (can be fractional)")
    duration_hours: Optional[float] = Field(default=0, ge=0, description="Custom hours")
    duration_minutes: Optional[float] = Field(default=0, ge=0, description="Custom minutes")
    count: int = Field(default=1, ge=1, le=100, description="Number of keys to generate")
    custom_prefix: Optional[str] = Field(default=None, description="Optional custom prefix for keys")
    subscription_id: Optional[str] = None
    note: Optional[str] = None

class LicenseExtend(BaseModel):
    days: Optional[float] = Field(default=0, ge=0)
    hours: Optional[float] = Field(default=0, ge=0)
    minutes: Optional[float] = Field(default=0, ge=0)

class BulkLicenseAction(BaseModel):
    app_id: str = Field(...)
    action: str = Field(..., description="delete, ban, unban, pause, unpause, revoke, reset_hwid, extend")
    keys: List[str] = Field(..., min_items=1)
    extend_days: Optional[float] = Field(default=0, ge=0)
    extend_hours: Optional[float] = Field(default=0, ge=0)
    extend_minutes: Optional[float] = Field(default=0, ge=0)

class SellerKeyGenerate(BaseModel):
    app_id: str = Field(...)
    seller_key: str = Field(..., description="App Secret Key from dashboard")
    duration_days: int = Field(..., ge=0)
    count: int = Field(default=1, ge=1, le=100)
    subscription_id: Optional[str] = None
    note: Optional[str] = None

class SellerUserCreate(BaseModel):
    app_id: str = Field(...)
    seller_key: str = Field(..., description="App Secret Key from dashboard")
    username: str = Field(..., min_length=3, max_length=20)
    password: str = Field(..., min_length=4)
    duration_days: int = Field(..., ge=0)
    subscription_id: Optional[str] = None
    note: Optional[str] = None

class UserCreate(BaseModel):
    app_id: str = Field(...)
    username: str = Field(..., min_length=3, max_length=20)
    password: str = Field(..., min_length=4)
    duration_days: int = Field(..., ge=0)
    subscription_id: Optional[str] = None
    note: Optional[str] = None

class ClientRegister(BaseModel):
    app_id: str = Field(...)
    username: str = Field(..., min_length=3, max_length=20)
    password: str = Field(..., min_length=4)
    license_key: str = Field(...)
    hwid: str = Field(...)

class ClientLogin(BaseModel):
    app_id: str = Field(...)
    username: str
    password: str
    hwid: str

class ClientLicenseLogin(BaseModel):
    app_id: str = Field(...)
    license_key: str
    hwid: str

class AppRename(BaseModel):
    name: str = Field(..., min_length=2, max_length=50)

class VariableCreate(BaseModel):
    app_id: str
    name: str = Field(..., min_length=1, max_length=50)
    value: str

class WebhookCreate(BaseModel):
    app_id: str
    name: str = Field(..., min_length=1, max_length=50)
    url: str = Field(..., min_length=10)

class ClientVariableRequest(BaseModel):
    app_id: str
    name: str

class ClientWebhookRequest(BaseModel):
    app_id: str
    name: str
    payload: dict

class SubscriptionCreate(BaseModel):
    app_id: str
    name: str = Field(..., min_length=2, max_length=50)
    level: int = Field(default=1, ge=1)

class TokenGenerate(BaseModel):
    app_id: str
    duration_days: int = Field(..., ge=1)
    subscription_id: Optional[str] = None
    count: int = Field(default=1, ge=1, le=100)
    note: Optional[str] = None

class ClientRedeemRequest(BaseModel):
    app_id: str
    username: str
    password: str
    token: str
    hwid: str

class AppRulesUpdate(BaseModel):
    hwid_lock: bool = True
    block_vpn: bool = False
    block_dev_mode: bool = False
    key_prefix: Optional[str] = "AnikXCheats"

class ChatMessageCreate(BaseModel):
    app_id: str
    message: str = Field(..., min_length=1, max_length=500)

class ClientChatRequest(BaseModel):
    app_id: str
    username: str
    password: str
    hwid: str
    message: Optional[str] = None # Used for both GET and POST

class ResourceCreate(BaseModel):
    app_id: str
    title: str = Field(..., min_length=2, max_length=100)
    content: str = Field(..., min_length=1)
