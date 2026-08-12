import os
import bcrypt
from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    raise ValueError("CRITICAL ERROR: MONGO_URI environment variable is missing! Please add MONGO_URI in your Render Dashboard -> Environment Variables.")

client = MongoClient(
    MONGO_URI,
    maxPoolSize=100,
    minPoolSize=10,
    maxIdleTimeMS=45000,
    connectTimeoutMS=10000,
    socketTimeoutMS=15000,
    retryWrites=True,
    w="majority"
)

try:
    db = client.get_default_database()
except Exception:
    db = client["licensing_db"]

apps_collection = db["apps"]
users_collection = db["users"]
licenses_collection = db["licenses"]
logs_collection = db["logs"]
variables_collection = db["variables"]
webhooks_collection = db["webhooks"]
subscriptions_collection = db["subscriptions"]
tokens_collection = db["tokens"]
sessions_collection = db["sessions"]
files_collection = db["files"]
chats_collection = db["chats"]
resources_collection = db["resources"]

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False

def safe_create_index(collection, keys, **kwargs):
    try:
        collection.create_index(keys, **kwargs)
    except Exception as e:
        pass  # Skip if index with different specs already exists in MongoDB Atlas

# Initialize database indexes and seed admin user if not present
def init_db():
    # Ensure indexes for ultrafast query performance under heavy load
    safe_create_index(apps_collection, "id", unique=True)
    safe_create_index(users_collection, [("username", 1), ("app_id", 1)], unique=True)
    safe_create_index(licenses_collection, "key", unique=True)
    safe_create_index(licenses_collection, [("app_id", 1), ("key", 1)])
    safe_create_index(logs_collection, [("app_id", 1), ("timestamp", -1)])
    safe_create_index(sessions_collection, [("app_id", 1), ("session_id", 1)])
    safe_create_index(tokens_collection, [("app_id", 1), ("token", 1)])
    safe_create_index(variables_collection, [("app_id", 1), ("name", 1)])
    safe_create_index(webhooks_collection, [("app_id", 1), ("name", 1)])
    
    # Seed Admin user ONLY if ADMIN_USERNAME and ADMIN_PASSWORD env vars are explicitly provided
    admin_user = os.getenv("ADMIN_USERNAME")
    admin_pass = os.getenv("ADMIN_PASSWORD")
    
    if admin_user and admin_pass and not users_collection.find_one({"username": admin_user}):
        print(f"[DB] Seeding admin user from Environment Variables: {admin_user}")
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
