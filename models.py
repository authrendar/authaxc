from pydantic import BaseModel, Field
from typing import Optional

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
    duration_days: int = Field(..., ge=0, description="0 for lifetime, otherwise number of days")
    count: int = Field(default=1, ge=1, le=100, description="Number of keys to generate")
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
