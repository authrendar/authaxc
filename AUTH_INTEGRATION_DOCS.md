# AuthAXC Integration Documentation for AI Agents & Developers

This document provides exact instructions and copy-paste code snippets to integrate **AuthAXC Licensing Engine** into **C#**, **C++**, **C++ ImGui**, and **Python** applications. Any AI Agent or developer can follow this guide to implement authentication and user info retrieval.

---

## 1. Core API Specifications

- **Server Base Host**: `http://auth.anikxcheatx.com` (or your backend domain)
- **App ID**: Obtainable from the AuthAXC Admin Dashboard.

### Endpoints

| Action | Endpoint | Method | Key Request Body Fields | Key Response Fields |
|---|---|---|---|---|
| **Register** | `/api/client/register` | `POST` | `app_id`, `username`, `password`, `license_key`, `hwid` | `status`, `username`, `hwid`, `license_key`, `expires_at`, `subscription_level` |
| **Login** | `/api/client/login` | `POST` | `app_id`, `username`, `password`, `hwid` | `status`, `username`, `hwid`, `license_key`, `expires_at`, `subscription_level` |
| **License Login** | `/api/client/license_login` | `POST` | `app_id`, `license_key`, `hwid` | `status`, `username`, `hwid`, `license_key`, `expires_at`, `subscription_level` |

---

## 2. C# Integration Guide

### User Info Data Structure
```csharp
public class UserInfo
{
    public string Username { get; set; } = "";
    public string HWID { get; set; } = "";
    public string LicenseKey { get; set; } = "";
    public string ExpiresAt { get; set; } = "";
    public int SubscriptionLevel { get; set; } = 1;
    public string CreatedAt { get; set; } = "";
}
```

### Complete Implementation Example
```csharp
using System;
using System.Text;
using System.Net.Http;
using System.Threading.Tasks;
using System.Security.Cryptography;
using Microsoft.Win32;

namespace AuthAXC
{
    public static class AuthManager
    {
        private static readonly string BaseUrl = "http://auth.anikxcheatx.com";
        private static readonly string AppId = "YOUR_APP_ID_HERE";
        private static readonly HttpClient Client = new HttpClient();

        public static UserInfo CurrentUser = null;

        public static string GetHWID()
        {
            string processorId = "";
            try {
                using (RegistryKey key = Registry.LocalMachine.OpenSubKey(@"HARDWARE\DESCRIPTION\System\CentralProcessor\0")) {
                    if (key != null) processorId = key.GetValue("ProcessorNameString")?.ToString() ?? "";
                }
            } catch {}

            string rawHwid = Environment.MachineName + Environment.ProcessorCount + processorId;
            using (SHA256 sha256 = SHA256.Create()) {
                byte[] bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(rawHwid));
                StringBuilder sb = new StringBuilder();
                foreach (byte b in bytes) sb.Append(b.ToString("x2"));
                return sb.ToString();
            }
        }

        public static async Task<bool> Login(string username, string password)
        {
            string hwid = GetHWID();
            string jsonPayload = $"{{\"app_id\":\"{AppId}\",\"username\":\"{username}\",\"password\":\"{password}\",\"hwid\":\"{hwid}\"}}";
            var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");

            HttpResponseMessage response = await Client.PostAsync($"{BaseUrl}/api/client/login", content);
            string json = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode) {
                ParseUserInfo(json, username, hwid, "");
                return true;
            }
            return false;
        }

        private static void ParseUserInfo(string json, string defaultUser, string defaultHwid, string defaultKey)
        {
            CurrentUser = new UserInfo
            {
                Username = ExtractJSONValue(json, "username") ?? defaultUser,
                HWID = ExtractJSONValue(json, "hwid") ?? defaultHwid,
                LicenseKey = ExtractJSONValue(json, "license_key") ?? defaultKey,
                ExpiresAt = ExtractJSONValue(json, "expires_at") ?? "Lifetime",
                SubscriptionLevel = int.TryParse(ExtractJSONValue(json, "subscription_level"), out int sub) ? sub : 1,
                CreatedAt = ExtractJSONValue(json, "created_at") ?? ""
            };
        }

        private static string ExtractJSONValue(string json, string key)
        {
            try {
                string searchToken = $"\"{key}\":\"";
                int index = json.IndexOf(searchToken);
                if (index != -1) {
                    int start = index + searchToken.Length;
                    int end = json.IndexOf("\"", start);
                    if (end != -1) return json.Substring(start, end - start);
                }
            } catch {}
            return null;
        }
    }
}
```

---

## 3. C++ Integration Guide

### User Data Struct
```cpp
struct UserData {
    std::string username;
    std::string hwid;
    std::string license_key;
    std::string expires_at;
    int subscription_level = 1;
    std::string created_at;
    bool is_authenticated = false;
};

extern UserData g_User;
```

### Complete Implementation Example
```cpp
#include <windows.h>
#include <wininet.h>
#include <iostream>
#include <string>
#include <sstream>
#include <vector>
#include <bcrypt.h>
#include <iomanip>

#pragma comment(lib, "wininet.lib")
#pragma comment(lib, "bcrypt.lib")

const std::string API_HOST = "auth.anikxcheatx.com";
const int API_PORT = 80;
const std::string APP_ID = "YOUR_APP_ID_HERE";

UserData g_User;

std::string CalculateSHA256(const std::string& input) {
    BCRYPT_ALG_HANDLE hAlg = NULL;
    BCRYPT_HASH_HANDLE hHash = NULL;
    std::string hashHex = "";

    if (BCryptOpenAlgorithmProvider(&hAlg, BCRYPT_SHA256_ALGORITHM, NULL, 0) >= 0) {
        DWORD cbHashObject = 0, cbData = 0;
        if (BCryptGetProperty(hAlg, BCRYPT_OBJECT_LENGTH, (PBYTE)&cbHashObject, sizeof(DWORD), &cbData, 0) >= 0) {
            std::vector<BYTE> hashObject(cbHashObject);
            DWORD cbHash = 0;
            if (BCryptGetProperty(hAlg, BCRYPT_HASH_LENGTH, (PBYTE)&cbHash, sizeof(DWORD), &cbData, 0) >= 0) {
                std::vector<BYTE> hashVal(cbHash);
                if (BCryptCreateHash(hAlg, &hHash, hashObject.data(), cbHashObject, NULL, 0, 0) >= 0) {
                    if (BCryptHashData(hHash, (PBYTE)input.c_str(), input.length(), 0) >= 0) {
                        if (BCryptFinishHash(hHash, hashVal.data(), cbHash, 0) >= 0) {
                            std::stringstream ss;
                            for (BYTE b : hashVal) ss << std::hex << std::setw(2) << std::setfill('0') << (int)b;
                            hashHex = ss.str();
                        }
                    }
                }
            }
        }
    }
    if (hHash) BCryptDestroyHash(hHash);
    if (hAlg) BCryptCloseAlgorithmProvider(hAlg, 0);
    return hashHex;
}

std::string GetHWID() {
    DWORD volumeSerial = 0;
    GetVolumeInformationW(L"C:\\", NULL, 0, &volumeSerial, NULL, NULL, NULL, 0);
    wchar_t computerName[MAX_COMPUTERNAME_LENGTH + 1];
    DWORD size = sizeof(computerName) / sizeof(computerName[0]);
    GetComputerNameW(computerName, &size);
    std::wstring ws(computerName);
    std::string name(ws.begin(), ws.end());
    std::stringstream ss;
    ss << name << "-" << volumeSerial;
    return CalculateSHA256(ss.str());
}

std::string SendPostRequest(const std::string& path, const std::string& jsonPayload) {
    HINTERNET hSession = InternetOpenA("AuthAXCClient", INTERNET_OPEN_TYPE_PRECONFIG, NULL, NULL, 0);
    if (!hSession) return "";
    HINTERNET hConnect = InternetConnectA(hSession, API_HOST.c_str(), API_PORT, NULL, NULL, INTERNET_SERVICE_HTTP, 0, 0);
    if (!hConnect) { InternetCloseHandle(hSession); return ""; }

    DWORD flags = INTERNET_FLAG_RELOAD | INTERNET_FLAG_NO_CACHE_WRITE;
    if (API_PORT == 443) flags |= INTERNET_FLAG_SECURE;

    HINTERNET hRequest = HttpOpenRequestA(hConnect, "POST", path.c_str(), NULL, NULL, NULL, flags, 0);
    std::string headers = "Content-Type: application/json\r\n";
    HttpSendRequestA(hRequest, headers.c_str(), headers.length(), (LPVOID)jsonPayload.c_str(), jsonPayload.length());

    std::string response = "";
    char buffer[1024];
    DWORD bytesRead = 0;
    while (InternetReadFile(hRequest, buffer, sizeof(buffer) - 1, &bytesRead) && bytesRead > 0) {
        buffer[bytesRead] = '\0';
        response += buffer;
    }

    InternetCloseHandle(hRequest);
    InternetCloseHandle(hConnect);
    InternetCloseHandle(hSession);
    return response;
}

std::string GetJSONValue(const std::string& json, const std::string& key) {
    std::string searchKey = "\"" + key + "\":\"";
    size_t pos = json.find(searchKey);
    if (pos == std::string::npos) return "";
    size_t start = pos + searchKey.length();
    size_t end = json.find("\"", start);
    if (end == std::string::npos) return "";
    return json.substr(start, end - start);
}

bool Login(const std::string& username, const std::string& password) {
    std::stringstream payload;
    payload << "{\"app_id\":\"" << APP_ID << "\",\"username\":\"" << username 
            << "\",\"password\":\"" << password << "\",\"hwid\":\"" << GetHWID() << "\"}";

    std::string response = SendPostRequest("/api/client/login", payload.str());
    if (GetJSONValue(response, "status") == "success") {
        g_User.username = username;
        g_User.hwid = GetHWID();
        g_User.expires_at = GetJSONValue(response, "expires_at");
        g_User.license_key = GetJSONValue(response, "license_key");
        g_User.is_authenticated = true;
        return true;
    }
    return false;
}
```

---

## 4. Dear ImGui C++ Overlay Snippet

Add this to your DirectX/OpenGL ImGui render loop:

```cpp
void RenderAuthAXCOverlay() {
    if (!g_User.is_authenticated) return;

    ImGui::SetNextWindowSize(ImVec2(340, 220), ImGuiCond_FirstUseEver);
    ImGui::Begin("User Info", NULL, ImGuiWindowFlags_NoCollapse);

    ImGui::TextColored(ImVec4(0.4f, 0.8f, 1.0f, 1.0f), "User: %s", g_User.username.c_str());
    ImGui::Text("Subscription: Level %d", g_User.subscription_level);
    ImGui::Text("Expires Date : %s", g_User.expires_at.c_str());
    ImGui::Separator();

    ImGui::Text("HWID:");
    ImGui::PushItemWidth(-1);
    ImGui::InputText("##hwid", (char*)g_User.hwid.c_str(), g_User.hwid.length(), ImGuiInputTextFlags_ReadOnly);
    ImGui::PopItemWidth();

    if (ImGui::Button("Copy HWID", ImVec2(120, 0))) {
        ImGui::SetClipboardText(g_User.hwid.c_str());
    }

    ImGui::End();
}
```

---

## 5. Python Integration Guide

```python
import hashlib
import subprocess
import requests

BASE_URL = "http://auth.anikxcheatx.com"
APP_ID = "YOUR_APP_ID_HERE"

def get_hwid():
    try:
        cmd = 'wmic csproduct get uuid'
        uuid = subprocess.check_output(cmd).decode().split('\n')[1].strip()
        return hashlib.sha256(uuid.encode()).hexdigest()
    except Exception:
        return hashlib.sha256(b"fallback_hwid").hexdigest()

class AuthClient:
    def __init__(self):
        self.user_info = None

    def login(self, username, password):
        url = f"{BASE_URL}/api/client/login"
        payload = {
            "app_id": APP_ID,
            "username": username,
            "password": password,
            "hwid": get_hwid()
        }
        res = requests.post(url, json=payload)
        data = res.json()

        if res.status_code == 200 and data.get("status") == "success":
            self.user_info = {
                "username": data.get("username", username),
                "hwid": data.get("hwid", get_hwid()),
                "license_key": data.get("license_key", ""),
                "expires_at": data.get("expires_at", "Lifetime"),
                "subscription_level": data.get("subscription_level", 1)
            }
            return True, "Login successful"
        return False, data.get("detail", "Login failed")

# Usage Example
if __name__ == "__main__":
    auth = AuthClient()
    success, msg = auth.login("testuser", "1")
    if success:
        print("[+] Logged In Successfully!")
        print("User Details:", auth.user_info)
    else:
        print("[-] Error:", msg)
```
