import os
import bcrypt
from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    # Fallback to local MongoDB or warning message if not set
    print("[WARNING] MONGO_URI not found in environment variables. Falling back to localhost.")
    MONGO_URI = "mongodb://localhost:27017/licensing_db"

client = MongoClient(MONGO_URI)
try:
    db = client.get_default_database()
except Exception:
    db = client["licensing_db"]

apps_collection = db["apps"]
users_collection = db["users"]
licenses_collection = db["licenses"]
logs_collection = db["logs"]

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False

# Initialize database indexes and seed admin user if not present
def init_db():
    # Ensure indexes
    apps_collection.create_index("id", unique=True)
    
    try:
        users_collection.drop_index("username_1")
    except Exception:
        pass
        
    users_collection.create_index([("username", 1), ("app_id", 1)], unique=True)
    licenses_collection.create_index("key", unique=True)
    licenses_collection.create_index("app_id")
    logs_collection.create_index([("app_id", 1), ("timestamp", -1)])
    
    # Seed default Admin user if none exists
    admin_user = os.getenv("ADMIN_USERNAME", "admin")
    admin_pass = os.getenv("ADMIN_PASSWORD", "admin12345")
    
    if not users_collection.find_one({"username": admin_user}):
        print(f"[DB] Seeding default admin user: {admin_user}")
        hashed = hash_password(admin_pass)
        users_collection.insert_one({
            "username": admin_user,
            "password": hashed,
            "role": "admin"
        })

# Run db initialization on import
try:
    init_db()
except Exception as e:
    print(f"[ERROR] Failed to initialize database: {e}")
