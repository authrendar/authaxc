# 📁 AuthAXC (Anik X Cheats) - Project Structure & Documentation

AuthAXC হলো একটি শক্তিশালী **Software Licensing & HWID Authentication System** যা FastAPI (Python), MongoDB এবং আধুনিক Web Dashboard নিয়ে তৈরি। এতে C++, C#, এবং Python ক্লায়েন্ট SDK অন্তর্ভুক্ত রয়েছে।

---

## 🗂️ Directory Tree (প্রজেক্ট স্ট্রাকচার)

```text
authaxc-main/
│
├── 📄 main.py                 # FastAPI মূল ব্যাকএন্ড সার্ভার (API Routes, Auth Logic, HWID Checking)
├── 📄 database.py             # MongoDB সংযোগ ও কালেকশন ইনিশিয়ালাইজেশন
├── 📄 models.py               # Pydantic ডেটা মডেল ও ভ্যালিডেশন স্কিমা
├── 📄 seed_admin.py           # ডিফল্ট অ্যাডমিন অ্যাকাউন্ট তৈরি করার স্ক্রিপ্ট
├── 📄 requirements.txt        # পাইথন প্যাকেজ ও ডিপেন্ডেন্সি তালিকা
├── 📄 Procfile                # Heroku / Cloud ডিপ্লয়মেন্ট কনফিগারেশন
├── 📄 render.yaml             # Render.com ডিপ্লয়মেন্ট কনফিগারেশন
│
├── 📂 clients/                # ক্লায়েন্ট ইন্টিগ্রেশন সোর্স কোড (SDKs)
│   ├── 📄 client.cpp          # C++ ক্লায়েন্ট লাইব্রেরি (Windows API, HWID, API Request)
│   ├── 📄 client.cs           # C# (.NET) ক্লায়েন্ট লাইব্রেরি
│   └── 📄 client.py           # Python ক্লায়েন্ট লাইব্রেরি
│
└── 📂 static/                 # ফ্রন্টএন্ড স্ট্যাটিক ফাইলস এবং ওয়েব ড্যাশবোর্ড
    ├── 📄 index.html          # পাবলিক ল্যান্ডিং ও লগইন পেজ
    ├── 📄 dashboard.html      # অ্যাডমিন কন্ট্রোল প্যানেল ও ম্যানেজমেন্ট ড্যাশবোর্ড
    ├── 📄 app.js              # ফ্রন্টএন্ড জাভাস্ক্রিপ্ট লজিক (API কল, চার্ট, লাইসেন্স ম্যানেজমেন্ট)
    ├── 📄 styles.css          # ড্যাশবোর্ড কাস্টম স্টাইল ও থিম
    ├── 📄 landing.css         # ল্যান্ডিং পেজের স্টাইল
    └── 📂 sdk/                # ড্যাশবোর্ড থেকে ডাউনলোডের জন্য ক্লায়েন্ট SDK কপি
        ├── 📄 client.cpp      # C++ SDK
        ├── 📄 client.cs       # C# SDK
        └── 📄 client.py       # Python SDK
```

---

## 🔍 বিস্তারিত ফাইল ও কম্পোনেন্ট বিবরণ (Detailed Component Breakdown)

### 1. ⚙️ Backend Core (মূল ব্যাকএন্ড)

* **[`main.py`](file:///c:/Users/veltrixanik/Downloads/authaxc-main/authaxc-main/main.py)**:
  - সম্পূর্ণ ব্যাকএন্ডের প্রাণকেন্দ্র।
  - **FastAPI** অ্যাপ সেটআপ, CORS মিডলওয়্যার, GZip কম্প্রেশন।
  - **Admin APIs**: অ্যাডমিন রেজিস্ট্রেশন, লগইন, 2FA (TOTP), ড্যাশবোর্ড অ্যানালিটিক্স।
  - **App & License APIs**: অ্যাপ তৈরি/ম্যানেজ, লাইসেন্স কি তৈরি (Bulk/Single), লাইসেন্স পজ/আনপজ, ডিলিট, এক্সটেন্ড।
  - **Client Authentication APIs**: ক্লায়েন্ট রেজিস্টার, লগইন, লাইসেন্স রিডিম, HWID ভ্যালিডেশন ও রিসেট।
  - **Seller APIs**: সেলারদের জন্য লাইসেন্স তৈরি ও ইউজার ম্যানেজমেন্ট এন্ডপয়েন্ট।
  - **Security & Integrity**: রিকোয়েস্ট সিগনেচার ভ্যালিডেশন, সেশন ট্র্যাকিং, ব্ল্যাকলিস্ট (IP/HWID)।

* **[`database.py`](file:///c:/Users/veltrixanik/Downloads/authaxc-main/authaxc-main/database.py)**:
  - **MongoDB** কানেকশন স্ট্রিং হ্যান্ডলিং (`MONGO_URI` থেকে কানেক্ট হয়)।
  - কালেকশনসমূহ: `admins`, `apps`, `licenses`, `users`, `sessions`, `logs`, `blacklist`, `variables`, `files` ইত্যাদি।
  - ইন্ডেক্সিং (Indexing) এবং অপ্টিমাইজড কুয়েরি ফাংশন।

* **[`models.py`](file:///c:/Users/veltrixanik/Downloads/authaxc-main/authaxc-main/models.py)**:
  - **Pydantic** ডেটা মডেল যা ইনকামিং API রিকোয়েস্টের ভ্যালিডেশন নিশ্চিত করে।
  - উদাহরণ: `AdminLogin`, `AppCreate`, `LicenseGenerate`, `ClientLogin`, `ClientRegister`, `SellerKeyGenerate` ইত্যাদি।

* **[`seed_admin.py`](file:///c:/Users/veltrixanik/Downloads/authaxc-main/authaxc-main/seed_admin.py)**:
  - প্রাথমিক সেটআপের সময় ডাটাবেসে ডিফল্ট অ্যাডমিন ইউজার তৈরি করতে ব্যবহৃত স্ক্রিপ্ট।

---

### 2. 💻 Client SDKs (ক্লায়েন্ট লাইব্রেরিসমূহ)

* **`client.cpp`** (C++):
  - গেম চিট বা উইন্ডোজ সফটওয়্যারের জন্য C++ SDK।
  - হার্ডওয়্যার আইডি (HWID) ডিটেকশন (CPU, GPU, Motherboard UUID)।
  - উইন্ডোজ সকেট/WinINet দিয়ে API এর সাথে সিকিউর যোগাযোগ।

* **`client.cs`** (C# / .NET):
  - .NET অ্যাপ্লিকেশনের জন্য SDK।
  - WMI এবং রেজিস্ট্রি ব্যবহার করে নিরাপদ HWID জেনারেশন এবং সার্ভার কমিউনিকেশন।

* **`client.py`** (Python):
  - পাইথন অ্যাপ্লিকেশনের জন্য লাইসেন্সিং SDK।
  - WMI / `hashlib` দিয়ে HWID জেনারেট ও `requests` লাইব্রেরির মাধ্যমে ভ্যালিডেশন।

---

### 3. 🌐 Frontend & Web Dashboard (ওয়েব ইন্টারফেস)

* **[`static/index.html`](file:///c:/Users/veltrixanik/Downloads/authaxc-main/authaxc-main/static/index.html)**:
  - ওয়েব ল্যান্ডিং পেজ এবং অ্যাডমিন লগইন পোর্টাল।

* **[`static/dashboard.html`](file:///c:/Users/veltrixanik/Downloads/authaxc-main/authaxc-main/static/dashboard.html)**:
  - সম্পূর্ণ ফিচারড অ্যাডমিন কন্ট্রোল প্যানেল।
  - অ্যাপ ম্যানেজমেন্ট, লাইসেন্স কি জেনারেশন, একটিভ ইউজার ট্র্যাকিং, HWID রিসেট, অ্যানালিটিক্স চার্ট, সিকিউরিটি লগ ও ভ্যারিয়েবল ডিক্লেয়ারেশন।

* **[`static/app.js`](file:///c:/Users/veltrixanik/Downloads/authaxc-main/authaxc-main/static/app.js)**:
  - ড্যাশবোর্ডের সমস্ত ফ্রন্টএন্ড ইন্টারেকশন ও AJAX/Fetch API কমিউনিকেশন হ্যান্ডলার।

* **[`static/styles.css`](file:///c:/Users/veltrixanik/Downloads/authaxc-main/authaxc-main/static/styles.css)** & **`landing.css`**:
  - ডার্ক থিম, গ্লাস মরফিজম ও মডার্ন রেসপন্সিভ UI ডিজাইন।

---

## 🚀 ডিপ্লয়মেন্ট ও কনফিগারেশন ফাইলস

* **`requirements.txt`**: পাইথন প্যাকেজ তালিকা (`fastapi`, `uvicorn`, `pymongo`, `bcrypt`, `pyotp`, ইত্যাদি)।
* **`Procfile`**: Heroku বা অন্যান্য PaaS প্ল্যাটফর্মে সার্ভার চালানোর কমান্ড (`uvicorn main:app`).
* **`render.yaml`**: Render ক্লাউডে সহজে ওয়েব সার্ভিস ডিপ্লয় করার ব্লুপ্রিন্ট।

---

## 🔑 পরিবেশ ভেরিয়েবল (.env) রিকোয়ারমেন্টস

সার্ভার রান করার জন্য নিচের ভেরিয়েবলগুলো প্রয়োজন:

```env
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/authaxc?retryWrites=true&w=majority
JWT_SECRET=your_super_secret_random_key
PORT=8000
```
