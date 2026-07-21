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

// API Host and Port Configuration
const std::string API_HOST = "auth.anikxcheatx.com";
const int API_PORT = 80;
const std::string APP_ID = "YOUR_APP_ID"; // Replace with App ID from dashboard

struct UserData {
    std::string username;
    std::string hwid;
    std::string license_key;
    std::string expires_at;
    int subscription_level = 1;
    std::string created_at;
    bool is_authenticated = false;
};

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
    HINTERNET hSession = InternetOpenA("AegisClient", INTERNET_OPEN_TYPE_PRECONFIG, NULL, NULL, 0);
    if (!hSession) return "{\"detail\":\"Failed to open internet session.\"}";

    HINTERNET hConnect = InternetConnectA(hSession, API_HOST.c_str(), API_PORT, NULL, NULL, INTERNET_SERVICE_HTTP, 0, 0);
    if (!hConnect) {
        InternetCloseHandle(hSession);
        return "{\"detail\":\"Failed to connect to server.\"}";
    }

    DWORD flags = INTERNET_FLAG_RELOAD | INTERNET_FLAG_NO_CACHE_WRITE;
    if (API_PORT == 443) flags |= INTERNET_FLAG_SECURE;

    HINTERNET hRequest = HttpOpenRequestA(hConnect, "POST", path.c_str(), NULL, NULL, NULL, flags, 0);
    if (!hRequest) {
        InternetCloseHandle(hConnect);
        InternetCloseHandle(hSession);
        return "{\"detail\":\"Failed to open HTTP request.\"}";
    }

    std::string headers = "Content-Type: application/json\r\n";
    BOOL sent = HttpSendRequestA(hRequest, headers.c_str(), headers.length(), (LPVOID)jsonPayload.c_str(), jsonPayload.length());

    std::string response = "";
    if (sent) {
        char buffer[1024];
        DWORD bytesRead = 0;
        while (InternetReadFile(hRequest, buffer, sizeof(buffer) - 1, &bytesRead) && bytesRead > 0) {
            buffer[bytesRead] = '\0';
            response += buffer;
        }
    } else {
        response = "{\"detail\":\"Failed to send request.\"}";
    }

    InternetCloseHandle(hRequest);
    InternetCloseHandle(hConnect);
    InternetCloseHandle(hSession);
    return response;
}

std::string GetJSONValue(const std::string& json, const std::string& key) {
    std::string searchKey = "\"" + key + "\":\"";
    size_t pos = json.find(searchKey);
    if (pos == std::string::npos) {
        std::string searchKeyNum = "\"" + key + "\":";
        pos = json.find(searchKeyNum);
        if (pos == std::string::npos) return "";
        size_t start = pos + searchKeyNum.length();
        size_t end = json.find_first_of(",}", start);
        if (end == std::string::npos) return "";
        return json.substr(start, end - start);
    }
    
    size_t start = pos + searchKey.length();
    size_t end = json.find("\"", start);
    if (end == std::string::npos) return "";
    
    return json.substr(start, end - start);
}

void ParseAndSetUserData(const std::string& response, const std::string& defaultUser, const std::string& defaultKey) {
    g_User.username = GetJSONValue(response, "username");
    if (g_User.username.empty()) g_User.username = defaultUser;

    g_User.hwid = GetJSONValue(response, "hwid");
    if (g_User.hwid.empty()) g_User.hwid = GetHWID();

    g_User.license_key = GetJSONValue(response, "license_key");
    if (g_User.license_key.empty()) g_User.license_key = defaultKey;

    g_User.expires_at = GetJSONValue(response, "expires_at");
    if (g_User.expires_at.empty()) g_User.expires_at = "Lifetime";

    std::string subStr = GetJSONValue(response, "subscription_level");
    g_User.subscription_level = subStr.empty() ? 1 : std::atoi(subStr.c_str());

    g_User.created_at = GetJSONValue(response, "created_at");
    g_User.is_authenticated = true;
}

void PrintUserInfo() {
    if (!g_User.is_authenticated) return;
    std::cout << "\n================ USER INFORMATION ================\n";
    std::cout << " Username           : " << g_User.username << "\n";
    std::cout << " Hardware ID (HWID) : " << g_User.hwid << "\n";
    std::cout << " License Key        : " << g_User.license_key << "\n";
    std::cout << " Expiry Date        : " << g_User.expires_at << "\n";
    std::cout << " Subscription Level : Level " << g_User.subscription_level << "\n";
    std::cout << "==================================================\n\n";
}

bool Register() {
    std::string username, password, key;
    std::cout << "Enter username: "; std::cin >> username;
    std::cout << "Enter password: "; std::cin >> password;
    std::cout << "Enter license key: "; std::cin >> key;

    std::stringstream payload;
    payload << "{\"app_id\":\"" << APP_ID << "\",\"username\":\"" << username << "\",\"password\":\"" << password 
            << "\",\"license_key\":\"" << key << "\",\"hwid\":\"" << GetHWID() << "\"}";

    std::string response = SendPostRequest("/api/client/register", payload.str());
    if (GetJSONValue(response, "status") == "success") {
        std::cout << "[+] Registration Successful!\n";
        ParseAndSetUserData(response, username, key);
        PrintUserInfo();
        return true;
    }
    std::cout << "[-] Registration Failed.\n";
    return false;
}

bool Login() {
    std::string username, password;
    std::cout << "Enter username: "; std::cin >> username;
    std::cout << "Enter password: "; std::cin >> password;

    std::stringstream payload;
    payload << "{\"app_id\":\"" << APP_ID << "\",\"username\":\"" << username << "\",\"password\":\"" << password 
            << "\",\"hwid\":\"" << GetHWID() << "\"}";

    std::string response = SendPostRequest("/api/client/login", payload.str());
    if (GetJSONValue(response, "status") == "success") {
        std::cout << "[+] Login Successful!\n";
        ParseAndSetUserData(response, username, "");
        PrintUserInfo();
        return true;
    }
    std::cout << "[-] Login Failed.\n";
    return false;
}

bool LoginByLicense() {
    std::string key;
    std::cout << "Enter your License Key: "; std::cin >> key;

    std::stringstream payload;
    payload << "{\"app_id\":\"" << APP_ID << "\",\"license_key\":\"" << key << "\",\"hwid\":\"" << GetHWID() << "\"}";

    std::string response = SendPostRequest("/api/client/license_login", payload.str());
    if (GetJSONValue(response, "status") == "success") {
        std::cout << "[+] License Login Successful!\n";
        ParseAndSetUserData(response, "Key-Only", key);
        PrintUserInfo();
        return true;
    }
    std::cout << "[-] License Login Failed.\n";
    return false;
}

int main() {
    std::cout << "=== AEGIS AUTHENTICATION CLIENT (C++) ===\n";
    std::cout << "[DEBUG] HWID: " << GetHWID() << "\n\n";

    if (Login()) {
        std::cout << "[*] Running application...\n";
    }
    return 0;
}
