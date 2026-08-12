import database as db
from datetime import datetime

username = "xdanik700"
password = "xdanik700"

if not db.users_collection.find_one({"username": username, "role": "admin"}):
    print(f"Creating admin user: {username}")
    hashed = db.hash_password(password)
    db.users_collection.insert_one({
        "username": username,
        "password": hashed,
        "role": "admin",
        "created_at": datetime.utcnow().isoformat(),
        "is_2fa_enabled": False,
        "totp_secret": None
    })
    print("User created successfully!")
else:
    print(f"User {username} already exists.")
