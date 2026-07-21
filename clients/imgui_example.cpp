/*
================================================================================
  AEGIS AUTHENTICATION - DEAR IMGUI INTEGRATION EXAMPLE (C++)
================================================================================
  This header/source file demonstrates how to render the Aegis Auth Login panel 
  and User Information Overlay directly inside your DirectX 9 / 11 / OpenGL ImGui application.

  Features Included:
  - User Login / License Login Modal Window
  - Authenticated User Info Dashboard Overlay (Username, HWID, Expiry, Subscription Level)
  - Copy-to-clipboard buttons for HWID and License Key
================================================================================
*/

#include <string>
#include <iostream>

// Include your Dear ImGui headers here:
// #include "imgui.h"

struct ImGuiUserData {
    std::string username = "";
    std::string hwid = "";
    std::string license_key = "";
    std::string expires_at = "";
    int subscription_level = 1;
    bool is_logged_in = false;
};

// Global instance of authenticated user data
static ImGuiUserData g_ImGuiUser;

// Render ImGui User Info Overlay Window
void RenderAegisUserInfoOverlay() {
    if (!g_ImGuiUser.is_logged_in) return;

    /*
    // Example Dear ImGui implementation:
    ImGui::SetNextWindowSize(ImVec2(360, 240), ImGuiCond_FirstUseEver);
    ImGui::Begin("Aegis User Information", NULL, ImGuiWindowFlags_NoCollapse);

    ImGui::TextColored(ImVec4(0.2f, 0.8f, 1.0f, 1.0f), "WELCOME BACK, %s", g_ImGuiUser.username.c_str());
    ImGui::Separator();

    ImGui::Spacing();
    ImGui::Text("Username     : %s", g_ImGuiUser.username.c_str());
    ImGui::Text("Subscription : Level %d", g_ImGuiUser.subscription_level);
    ImGui::Text("Expires At   : %s", g_ImGuiUser.expires_at.c_str());

    ImGui::Spacing();
    ImGui::Separator();
    ImGui::Spacing();

    ImGui::Text("Hardware ID (HWID):");
    ImGui::PushItemWidth(-1);
    char hwidBuf[128];
    strncpy(hwidBuf, g_ImGuiUser.hwid.c_str(), sizeof(hwidBuf));
    ImGui::InputText("##hwid", hwidBuf, sizeof(hwidBuf), ImGuiInputTextFlags_ReadOnly);
    ImGui::PopItemWidth();

    if (ImGui::Button("Copy HWID", ImVec2(120, 0))) {
        ImGui::SetClipboardText(g_ImGuiUser.hwid.c_str());
    }

    ImGui::End();
    */
}

// Render ImGui Authentication / Login Window
void RenderAegisLoginPanel() {
    if (g_ImGuiUser.is_logged_in) {
        RenderAegisUserInfoOverlay();
        return;
    }

    /*
    static char usernameInput[64] = "";
    static char passwordInput[64] = "";
    static char licenseKeyInput[64] = "";
    static char statusMsg[128] = "";
    static int authTab = 0; // 0 = User/Pass, 1 = License Key Only

    ImGui::SetNextWindowSize(ImVec2(340, 280), ImGuiCond_FirstUseEver);
    ImGui::Begin("Aegis Auth Login", NULL, ImGuiWindowFlags_NoResize);

    if (ImGui::Button("Account Login", ImVec2(150, 25))) authTab = 0;
    ImGui::SameLine();
    if (ImGui::Button("License Key", ImVec2(150, 25))) authTab = 1;

    ImGui::Separator();
    ImGui::Spacing();

    if (authTab == 0) {
        ImGui::Text("Username:");
        ImGui::InputText("##user", usernameInput, sizeof(usernameInput));

        ImGui::Text("Password:");
        ImGui::InputText("##pass", passwordInput, sizeof(passwordInput), ImGuiInputTextFlags_Password);

        ImGui::Spacing();
        if (ImGui::Button("LOGIN", ImVec2(-1, 35))) {
            // Call Login API function from client.cpp
            // if successful:
            // g_ImGuiUser.is_logged_in = true;
        }
    } else {
        ImGui::Text("License Key:");
        ImGui::InputText("##key", licenseKeyInput, sizeof(licenseKeyInput));

        ImGui::Spacing();
        if (ImGui::Button("ACTIVATE LICENSE", ImVec2(-1, 35))) {
            // Call LicenseLogin API function from client.cpp
            // if successful:
            // g_ImGuiUser.is_logged_in = true;
        }
    }

    if (strlen(statusMsg) > 0) {
        ImGui::TextColored(ImVec4(1.0f, 0.3f, 0.3f, 1.0f), "%s", statusMsg);
    }

    ImGui::End();
    */
}
