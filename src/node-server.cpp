#include "node-server.h"
#include "plugin-main.h"
#include <obs-module.h>
#include <util/platform.h>
#include <util/dstr.h>
#include <filesystem>
#include <fstream>

#ifdef _WIN32
#include <windows.h>
#include <process.h>
#else
#include <unistd.h>
#include <sys/wait.h>
#include <signal.h>
#endif

NodeServerManager::NodeServerManager() 
    : running_(false), port_(3001)
#ifdef _WIN32
    , process_handle_(nullptr), thread_handle_(nullptr)
#else
    , process_id_(-1)
#endif
{
}

NodeServerManager::~NodeServerManager()
{
    stop();
}

bool NodeServerManager::start()
{
    if (running_) {
        return true;
    }
    
    obs_log(LOG_INFO, "Starting PhotoLive web server...");
    
    // Setup web application files
    if (!setup_web_app()) {
        obs_log(LOG_ERROR, "Failed to setup web application");
        return false;
    }
    
    // Find available port
    for (int port = 3001; port <= 3010; ++port) {
        port_ = port;
        if (run_server()) {
            running_ = true;
            obs_log(LOG_INFO, "PhotoLive server started on port %d", port_);
            return true;
        }
    }
    
    obs_log(LOG_ERROR, "Could not find available port for PhotoLive server");
    return false;
}

void NodeServerManager::stop()
{
    if (!running_) {
        return;
    }
    
    obs_log(LOG_INFO, "Stopping PhotoLive web server...");
    running_ = false;
    
#ifdef _WIN32
    if (process_handle_) {
        TerminateProcess(process_handle_, 0);
        CloseHandle(process_handle_);
        process_handle_ = nullptr;
    }
    if (thread_handle_) {
        CloseHandle(thread_handle_);
        thread_handle_ = nullptr;
    }
#else
    if (process_id_ > 0) {
        kill(process_id_, SIGTERM);
        waitpid(process_id_, nullptr, 0);
        process_id_ = -1;
    }
#endif
    
    obs_log(LOG_INFO, "PhotoLive web server stopped");
}

bool NodeServerManager::run_server()
{
    std::string node_path = get_node_executable();
    if (node_path.empty()) {
        obs_log(LOG_ERROR, "Node.js not found on system");
        return false;
    }
    
    std::string server_js = web_app_path_ + "/server.js";
    std::string command = "\"" + node_path + "\" \"" + server_js + "\"";
    
    obs_log(LOG_INFO, "Executing: %s", command.c_str());
    
#ifdef _WIN32
    STARTUPINFOA si = {};
    PROCESS_INFORMATION pi = {};
    si.cb = sizeof(si);
    si.dwFlags = STARTF_USESHOWWINDOW;
    si.wShowWindow = SW_HIDE;
    
    // Set environment variable for port
    std::string env_port = "PORT=" + std::to_string(port_);
    putenv(env_port.c_str());
    
    if (CreateProcessA(nullptr, (LPSTR)command.c_str(), nullptr, nullptr, 
                      FALSE, CREATE_NO_WINDOW, nullptr, web_app_path_.c_str(), &si, &pi)) {
        process_handle_ = pi.hProcess;
        thread_handle_ = pi.hThread;
        return true;
    }
    return false;
#else
    process_id_ = fork();
    if (process_id_ == 0) {
        // Child process
        setenv("PORT", std::to_string(port_).c_str(), 1);
        chdir(web_app_path_.c_str());
        execl("/bin/sh", "sh", "-c", command.c_str(), (char*)nullptr);
        exit(1);
    }
    return process_id_ > 0;
#endif
}

bool NodeServerManager::setup_web_app()
{
    web_app_path_ = get_web_app_path();
    
    // Check if web app directory exists
    if (!std::filesystem::exists(web_app_path_)) {
        obs_log(LOG_ERROR, "Web app directory not found: %s", web_app_path_.c_str());
        return false;
    }
    
    // Check if package.json exists
    std::string package_json = web_app_path_ + "/package.json";
    if (!std::filesystem::exists(package_json)) {
        obs_log(LOG_ERROR, "package.json not found in web app directory");
        return false;
    }
    
    // Check if node_modules exists, if not run npm install
    std::string node_modules = web_app_path_ + "/node_modules";
    if (!std::filesystem::exists(node_modules)) {
        obs_log(LOG_INFO, "Installing Node.js dependencies...");
        
        std::string npm_install = "cd \"" + web_app_path_ + "\" && npm install";
        int result = system(npm_install.c_str());
        if (result != 0) {
            obs_log(LOG_ERROR, "Failed to install Node.js dependencies");
            return false;
        }
    }
    
    return true;
}

std::string NodeServerManager::get_web_app_path()
{
    char *module_path = obs_module_get_config_path(obs_current_module(), "web-app");
    std::string result(module_path ? module_path : "");
    bfree(module_path);
    return result;
}

std::string NodeServerManager::get_node_executable()
{
#ifdef _WIN32
    // Try common Node.js installation paths on Windows
    const char* paths[] = {
        "C:\\Program Files\\nodejs\\node.exe",
        "C:\\Program Files (x86)\\nodejs\\node.exe",
        nullptr
    };
    
    for (int i = 0; paths[i]; ++i) {
        if (std::filesystem::exists(paths[i])) {
            return paths[i];
        }
    }
    
    // Try PATH
    return "node.exe";
#else
    // On Unix systems, try common paths
    const char* paths[] = {
        "/usr/bin/node",
        "/usr/local/bin/node",
        "/opt/homebrew/bin/node",
        nullptr
    };
    
    for (int i = 0; paths[i]; ++i) {
        if (std::filesystem::exists(paths[i])) {
            return paths[i];
        }
    }
    
    // Try PATH
    return "node";
#endif
}

std::string NodeServerManager::get_slideshow_url() const
{
    return "http://localhost:" + std::to_string(port_);
}

std::string NodeServerManager::get_control_url() const
{
    return "http://localhost:" + std::to_string(port_) + "/control";
}