import sys
import hashlib
import uuid
import platform
import requests

# Anik X Cheats Server Configuration (Change this to your Render URL in production)
BASE_URL = "http://auth.anikxcheatx.com"
APP_ID = "YOUR_APP_ID"  # Replace with the App ID generated from the dashboard

def get_hwid():
    """Generates a secure, unique Hardware ID (HWID) for this machine."""
    mac = str(uuid.getnode())
    processor = platform.processor()
    os_name = platform.system()
    raw_hwid = f"{mac}-{processor}-{os_name}"
    return hashlib.sha256(raw_hwid.encode('utf-8')).hexdigest()

# ================= AUTH MODE 1: USERNAME & PASSWORD AUTH =================
def register_user(username, password, license_key):
    hwid = get_hwid()
    url = f"{BASE_URL}/api/client/register"
    payload = {
        "app_id": APP_ID,
        "username": username,
        "password": password,
        "license_key": license_key,
        "hwid": hwid
    }
    
    try:
        response = requests.post(url, json=payload)
        data = response.json()
        if response.status_code == 200:
            print(f"[+] Registration Successful! License expires on: {data.get('expires_at')}")
            return True
        else:
            print(f"[-] Registration Failed: {data.get('detail')}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"[-] Connection Error: {e}")
        return False

def login_user(username, password):
    hwid = get_hwid()
    url = f"{BASE_URL}/api/client/login"
    payload = {
        "app_id": APP_ID,
        "username": username,
        "password": password,
        "hwid": hwid
    }
    
    try:
        response = requests.post(url, json=payload)
        data = response.json()
        if response.status_code == 200:
            print(f"[+] Login Successful!")
            print(f"[+] License Expiration: {data.get('expires_at')}")
            return True
        else:
            print(f"[-] Login Failed: {data.get('detail')}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"[-] Connection Error: {e}")
        return False

# ================= AUTH MODE 2: LICENSE KEY ONLY AUTH =================
def login_by_license(license_key):
    hwid = get_hwid()
    url = f"{BASE_URL}/api/client/license_login"
    payload = {
        "app_id": APP_ID,
        "license_key": license_key,
        "hwid": hwid
    }
    
    try:
        response = requests.post(url, json=payload)
        data = response.json()
        if response.status_code == 200:
            print(f"[+] License Login Successful!")
            print(f"[+] License Expiration: {data.get('expires_at')}")
            return True
        else:
            print(f"[-] License Login Failed: {data.get('detail')}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"[-] Connection Error: {e}")
        return False

if __name__ == "__main__":
    print("=== Anik X Cheats AUTHENTICATION CLIENT (PYTHON) ===")
    print(f"[DEBUG] Local HWID: {get_hwid()}\n")
    
    if APP_ID == "YOUR_APP_ID":
        print("[WARNING] Please configure your APP_ID at the top of the file before testing!")
        print("-" * 60)
        
    while True:
        print("Choose Authentication Method:")
        print("1. Username & Password Auth (Register/Login)")
        print("2. License Key Only Auth (Direct License Login)")
        print("3. Exit")
        auth_mode = input("Select mode (1-3): ").strip()
        
        if auth_mode == "1":
            print("\n--- USERNAME & PASSWORD AUTH ---")
            print("1. Register Account")
            print("2. Login")
            sub_choice = input("Select option (1-2): ").strip()
            
            if sub_choice == "1":
                user = input("Enter new username: ").strip()
                pwd = input("Enter password: ").strip()
                key = input("Enter license key: ").strip()
                register_user(user, pwd, key)
                print("-" * 40)
            elif sub_choice == "2":
                user = input("Enter username: ").strip()
                pwd = input("Enter password: ").strip()
                if login_user(user, pwd):
                    print("[*] Access Granted. Starting application...")
                    break
                else:
                    print("[*] Access Denied.")
                print("-" * 40)
                
        elif auth_mode == "2":
            print("\n--- LICENSE KEY ONLY AUTH ---")
            key = input("Enter your License Key: ").strip()
            if login_by_license(key):
                print("[*] Access Granted. Starting application...")
                break
            else:
                print("[*] Access Denied.")
            print("-" * 40)
            
        elif auth_mode == "3":
            print("Goodbye!")
            sys.exit(0)
        else:
            print("[-] Invalid choice. Try again.\n")
