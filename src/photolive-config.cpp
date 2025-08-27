#include "photolive-config.h"
#include "plugin-main.h"
#include <obs-module.h>
#include <util/config-file.h>
#include <util/platform.h>

photolive_config g_config;

void photolive_config_set_defaults()
{
    char *default_photos = obs_module_get_config_path(obs_current_module(), "photos");
    g_config.photos_path = default_photos ? default_photos : "";
    g_config.auto_start = true;
    g_config.server_port = 3001;
    g_config.language = "en";
    bfree(default_photos);
}

void photolive_config_load()
{
    photolive_config_set_defaults();
    
    char *config_file = obs_module_get_config_path(obs_current_module(), "config.ini");
    if (!config_file) {
        return;
    }
    
    config_t *config = nullptr;
    if (config_open(&config, config_file, CONFIG_OPEN_EXISTING) == CONFIG_SUCCESS) {
        const char *photos_path = config_get_string(config, "photolive", "photos_path");
        if (photos_path) {
            g_config.photos_path = photos_path;
        }
        
        g_config.auto_start = config_get_bool(config, "photolive", "auto_start");
        g_config.server_port = (int)config_get_int(config, "photolive", "server_port");
        
        const char *language = config_get_string(config, "photolive", "language");
        if (language) {
            g_config.language = language;
        }
        
        config_close(config);
    }
    
    bfree(config_file);
}

void photolive_config_save()
{
    char *config_file = obs_module_get_config_path(obs_current_module(), "config.ini");
    if (!config_file) {
        return;
    }
    
    config_t *config = nullptr;
    if (config_open(&config, config_file, CONFIG_OPEN_ALWAYS) == CONFIG_SUCCESS) {
        config_set_string(config, "photolive", "photos_path", g_config.photos_path.c_str());
        config_set_bool(config, "photolive", "auto_start", g_config.auto_start);
        config_set_int(config, "photolive", "server_port", g_config.server_port);
        config_set_string(config, "photolive", "language", g_config.language.c_str());
        
        config_save(config);
        config_close(config);
    }
    
    bfree(config_file);
}