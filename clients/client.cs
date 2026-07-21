using System;
using System.Text;
using System.Net.Http;
using System.Threading.Tasks;
using System.Security.Cryptography;
using Microsoft.Win32;

namespace AegisClient
{
    public class UserInfo
    {
        public string Username { get; set; } = "";
        public string HWID { get; set; } = "";
        public string LicenseKey { get; set; } = "";
        public string ExpiresAt { get; set; } = "";
        public int SubscriptionLevel { get; set; } = 1;
        public string CreatedAt { get; set; } = "";
    }

    class Program
    {
        // FastAPI Server base URL (Change this to your Render URL in production)
        private static readonly string BaseUrl = "http://auth.anikxcheatx.com";
        private static readonly string AppId = "YOUR_APP_ID"; // Replace with App ID from dashboard
        private static readonly HttpClient Client = new HttpClient();

        // Holds currently logged in user info
        public static UserInfo CurrentUser = null;

        static async Task Main(string[] args)
        {
            Console.OutputEncoding = Encoding.UTF8;
            Console.WriteLine("=== AEGIS AUTHENTICATION CLIENT (C#) ===");
            Console.WriteLine($"[DEBUG] Local HWID: {GetHWID()}\n");

            if (AppId == "YOUR_APP_ID")
            {
                Console.WriteLine("[WARNING] Please configure your AppId at the top of the file before testing!");
                Console.WriteLine(new string('-', 60));
            }

            while (true)
            {
                Console.WriteLine("Choose Authentication Method:");
                Console.WriteLine("1. Username & Password Auth (Register/Login)");
                Console.WriteLine("2. License Key Only Auth (Direct License Login)");
                Console.WriteLine("3. Exit");
                Console.Write("Select mode (1-3): ");
                string mode = Console.ReadLine()?.Trim();

                if (mode == "1")
                {
                    Console.WriteLine("\n--- USERNAME & PASSWORD AUTH ---");
                    Console.WriteLine("1. Register Account");
                    Console.WriteLine("2. Login");
                    Console.Write("Select option (1-2): ");
                    string subChoice = Console.ReadLine()?.Trim();

                    if (subChoice == "1")
                    {
                        Console.Write("Enter new username: ");
                        string user = Console.ReadLine()?.Trim();
                        Console.Write("Enter password: ");
                        string pwd = Console.ReadLine()?.Trim();
                        Console.Write("Enter license key: ");
                        string key = Console.ReadLine()?.Trim();

                        if (await RegisterUser(user, pwd, key))
                        {
                            PrintUserInfo();
                            break;
                        }
                        Console.WriteLine(new string('-', 40));
                    }
                    else if (subChoice == "2")
                    {
                        Console.Write("Enter username: ");
                        string user = Console.ReadLine()?.Trim();
                        Console.Write("Enter password: ");
                        string pwd = Console.ReadLine()?.Trim();

                        if (await LoginUser(user, pwd))
                        {
                            Console.WriteLine("[*] Access Granted. Starting application...");
                            PrintUserInfo();
                            break;
                        }
                        else
                        {
                            Console.WriteLine("[*] Access Denied.");
                        }
                        Console.WriteLine(new string('-', 40));
                    }
                }
                else if (mode == "2")
                {
                    Console.WriteLine("\n--- LICENSE KEY ONLY AUTH ---");
                    Console.Write("Enter your License Key: ");
                    string key = Console.ReadLine()?.Trim();

                    if (await LoginByLicense(key))
                    {
                        Console.WriteLine("[*] Access Granted. Starting application...");
                        PrintUserInfo();
                        break;
                    }
                    else
                    {
                        Console.WriteLine("[*] Access Denied.");
                    }
                    Console.WriteLine(new string('-', 40));
                }
                else if (mode == "3")
                {
                    Console.WriteLine("Goodbye!");
                    break;
                }
                else
                {
                    Console.WriteLine("[-] Invalid choice. Try again.\n");
                }
            }
        }

        public static void PrintUserInfo()
        {
            if (CurrentUser == null) return;
            Console.WriteLine("\n================ USER INFORMATION ================");
            Console.WriteLine($" Username           : {CurrentUser.Username}");
            Console.WriteLine($" Hardware ID (HWID) : {CurrentUser.HWID}");
            Console.WriteLine($" License Key        : {CurrentUser.LicenseKey}");
            Console.WriteLine($" Expiry Date        : {CurrentUser.ExpiresAt}");
            Console.WriteLine($" Subscription Level : Level {CurrentUser.SubscriptionLevel}");
            Console.WriteLine("==================================================\n");
        }

        private static string GetHWID()
        {
            string processorId = "";
            try
            {
                using (RegistryKey key = Registry.LocalMachine.OpenSubKey(@"HARDWARE\DESCRIPTION\System\CentralProcessor\0"))
                {
                    if (key != null)
                    {
                        processorId = key.GetValue("ProcessorNameString")?.ToString() ?? "";
                    }
                }
            }
            catch
            {
                // Fallback if registry access fails
            }

            string rawHwid = Environment.MachineName + Environment.ProcessorCount + processorId;
            using (SHA256 sha256 = SHA256.Create())
            {
                byte[] bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(rawHwid));
                StringBuilder sb = new StringBuilder();
                foreach (byte b in bytes)
                {
                    sb.Append(b.ToString("x2"));
                }
                return sb.ToString();
            }
        }

        private static async Task<bool> RegisterUser(string username, string password, string licenseKey)
        {
            string hwid = GetHWID();
            string url = $"{BaseUrl}/api/client/register";
            string jsonPayload = $"{{\"app_id\":\"{AppId}\",\"username\":\"{username}\",\"password\":\"{password}\",\"license_key\":\"{licenseKey}\",\"hwid\":\"{hwid}\"}}";

            try
            {
                var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");
                HttpResponseMessage response = await Client.PostAsync(url, content);
                string responseBody = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                {
                    Console.WriteLine("[+] Registration Successful!");
                    ParseUserInfo(responseBody, username, hwid, licenseKey);
                    return true;
                }
                else
                {
                    Console.WriteLine($"[-] Registration Failed: {ExtractDetail(responseBody)}");
                    return false;
                }
            }
            catch (Exception e)
            {
                Console.WriteLine($"[-] Connection Error: {e.Message}");
                return false;
            }
        }

        private static async Task<bool> LoginUser(string username, string password)
        {
            string hwid = GetHWID();
            string url = $"{BaseUrl}/api/client/login";
            string jsonPayload = $"{{\"app_id\":\"{AppId}\",\"username\":\"{username}\",\"password\":\"{password}\",\"hwid\":\"{hwid}\"}}";

            try
            {
                var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");
                HttpResponseMessage response = await Client.PostAsync(url, content);
                string responseBody = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                {
                    Console.WriteLine("[+] Login Successful!");
                    ParseUserInfo(responseBody, username, hwid, "");
                    return true;
                }
                else
                {
                    Console.WriteLine($"[-] Login Failed: {ExtractDetail(responseBody)}");
                    return false;
                }
            }
            catch (Exception e)
            {
                Console.WriteLine($"[-] Connection Error: {e.Message}");
                return false;
            }
        }

        private static async Task<bool> LoginByLicense(string licenseKey)
        {
            string hwid = GetHWID();
            string url = $"{BaseUrl}/api/client/license_login";
            string jsonPayload = $"{{\"app_id\":\"{AppId}\",\"license_key\":\"{licenseKey}\",\"hwid\":\"{hwid}\"}}";

            try
            {
                var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");
                HttpResponseMessage response = await Client.PostAsync(url, content);
                string responseBody = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                {
                    Console.WriteLine("[+] License Login Successful!");
                    ParseUserInfo(responseBody, "Key-Only", hwid, licenseKey);
                    return true;
                }
                else
                {
                    Console.WriteLine($"[-] License Login Failed: {ExtractDetail(responseBody)}");
                    return false;
                }
            }
            catch (Exception e)
            {
                Console.WriteLine($"[-] Connection Error: {e.Message}");
                return false;
            }
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
            try
            {
                string searchToken = $"\"{key}\":\"";
                int index = json.IndexOf(searchToken);
                if (index != -1)
                {
                    int start = index + searchToken.Length;
                    int end = json.IndexOf("\"", start);
                    if (end != -1) return json.Substring(start, end - start);
                }
            }
            catch { }
            return null;
        }

        private static string ExtractDetail(string json)
        {
            return ExtractJSONValue(json, "detail") ?? json;
        }
    }
}
