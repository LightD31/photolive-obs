#pragma once

#include <obs-module.h>
#include <obs-frontend-api.h>
#include <string>

#define PLUGIN_NAME "photolive-obs"
#define PLUGIN_VERSION "1.0.0"

// Plugin lifecycle functions
extern "C" {
bool obs_module_load(void);
void obs_module_unload(void);
const char *obs_module_name(void);
const char *obs_module_description(void);
}

// Source registration
void register_photolive_source();
void unregister_photolive_source();

// Configuration
void photolive_load_config();
void photolive_save_config();
std::string photolive_get_data_path();

// Server management
class NodeServerManager;
extern NodeServerManager* g_server_manager;