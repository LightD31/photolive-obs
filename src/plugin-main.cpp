#include "plugin-main.h"
#include "photolive-source.h"
#include "node-server.h"
#include <obs-module.h>
#include <obs-frontend-api.h>
#include <util/platform.h>
#include <util/config-file.h>

NodeServerManager* g_server_manager = nullptr;

OBS_DECLARE_MODULE()
OBS_MODULE_USE_DEFAULT_LOCALE(PLUGIN_NAME, "en-US")

extern "C" bool obs_module_load(void)
{
    obs_log(LOG_INFO, "PhotoLive OBS Plugin loading...");
    
    // Initialize server manager
    g_server_manager = new NodeServerManager();
    if (!g_server_manager->start()) {
        obs_log(LOG_ERROR, "Failed to start Node.js server");
        delete g_server_manager;
        g_server_manager = nullptr;
        return false;
    }
    
    // Register the photo slideshow source
    register_photolive_source();
    
    obs_log(LOG_INFO, "PhotoLive OBS Plugin loaded successfully");
    return true;
}

extern "C" void obs_module_unload(void)
{
    obs_log(LOG_INFO, "PhotoLive OBS Plugin unloading...");
    
    // Cleanup source
    unregister_photolive_source();
    
    // Stop server
    if (g_server_manager) {
        g_server_manager->stop();
        delete g_server_manager;
        g_server_manager = nullptr;
    }
    
    obs_log(LOG_INFO, "PhotoLive OBS Plugin unloaded");
}

extern "C" const char *obs_module_name(void)
{
    return "PhotoLive OBS";
}

extern "C" const char *obs_module_description(void)
{
    return "Real-time photo slideshow plugin for OBS Studio with automatic folder monitoring";
}

std::string photolive_get_data_path()
{
    char *data_path = obs_module_get_config_path(obs_current_module(), "");
    std::string result(data_path ? data_path : "");
    bfree(data_path);
    return result;
}

void photolive_load_config()
{
    // Configuration loading will be implemented here
    // For now, use defaults
}

void photolive_save_config()
{
    // Configuration saving will be implemented here
}