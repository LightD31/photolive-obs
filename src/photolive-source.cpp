#include "photolive-source.h"
#include "plugin-main.h"
#include "node-server.h"
#include <obs-module.h>
#include <util/platform.h>

static struct obs_source_info photolive_source_info;

void register_photolive_source()
{
    memset(&photolive_source_info, 0, sizeof(photolive_source_info));
    
    photolive_source_info.id = PHOTOLIVE_SOURCE_ID;
    photolive_source_info.type = OBS_SOURCE_TYPE_INPUT;
    photolive_source_info.output_flags = OBS_SOURCE_VIDEO | OBS_SOURCE_CUSTOM_DRAW;
    photolive_source_info.get_name = photolive_source_get_name;
    photolive_source_info.create = photolive_source_create;
    photolive_source_info.destroy = photolive_source_destroy;
    photolive_source_info.update = photolive_source_update;
    photolive_source_info.get_properties = photolive_source_get_properties;
    photolive_source_info.get_defaults = photolive_source_get_defaults;
    photolive_source_info.get_width = photolive_source_get_width;
    photolive_source_info.get_height = photolive_source_get_height;
    photolive_source_info.video_render = photolive_source_video_render;
    
    obs_register_source(&photolive_source_info);
}

void unregister_photolive_source()
{
    // OBS handles source cleanup automatically
}

const char *photolive_source_get_name(void *type_data)
{
    UNUSED_PARAMETER(type_data);
    return obs_module_text("PhotoLive Slideshow");
}

void *photolive_source_create(obs_data_t *settings, obs_source_t *source)
{
    photolive_source *context = (photolive_source*)bzalloc(sizeof(photolive_source));
    context->source = source;
    context->width = 1920;
    context->height = 1080;
    
    // Setup browser source
    photolive_source_setup_browser(context);
    
    // Update with initial settings
    photolive_source_update(context, settings);
    
    obs_log(LOG_INFO, "PhotoLive source created");
    return context;
}

void photolive_source_destroy(void *data)
{
    photolive_source *context = (photolive_source*)data;
    
    if (context->browser_source) {
        obs_source_release(context->browser_source);
    }
    
    bfree(context);
    obs_log(LOG_INFO, "PhotoLive source destroyed");
}

void photolive_source_update(void *data, obs_data_t *settings)
{
    photolive_source *context = (photolive_source*)data;
    
    const char *photos_path = obs_data_get_string(settings, "photos_path");
    context->photos_path = photos_path ? photos_path : "";
    context->auto_start = obs_data_get_bool(settings, "auto_start");
    context->width = (uint32_t)obs_data_get_int(settings, "width");
    context->height = (uint32_t)obs_data_get_int(settings, "height");
    
    // Update browser source with new settings
    photolive_source_update_browser_url(context);
    
    obs_log(LOG_INFO, "PhotoLive source updated - Photos: %s, Size: %dx%d", 
            context->photos_path.c_str(), context->width, context->height);
}

obs_properties_t *photolive_source_get_properties(void *data)
{
    UNUSED_PARAMETER(data);
    
    obs_properties_t *props = obs_properties_create();
    
    // Photos folder path
    obs_properties_add_path(props, "photos_path", 
                           obs_module_text("Photos Folder"),
                           OBS_PATH_DIRECTORY, "", nullptr);
    
    // Auto-start option
    obs_properties_add_bool(props, "auto_start", 
                           obs_module_text("Auto-start slideshow"));
    
    // Dimensions
    obs_properties_add_int(props, "width", obs_module_text("Width"), 
                          320, 7680, 1);
    obs_properties_add_int(props, "height", obs_module_text("Height"), 
                          240, 4320, 1);
    
    // Open control interface button
    obs_properties_add_button(props, "open_control", 
                             obs_module_text("Open Control Interface"),
                             [](obs_properties_t *props, obs_property_t *property, void *data) -> bool {
                                 if (g_server_manager && g_server_manager->is_running()) {
                                     std::string url = g_server_manager->get_control_url();
                                     os_shell_open(url.c_str());
                                 }
                                 return false;
                             });
    
    return props;
}

void photolive_source_get_defaults(obs_data_t *settings)
{
    char *default_path = obs_module_get_config_path(obs_current_module(), "photos");
    obs_data_set_default_string(settings, "photos_path", default_path);
    obs_data_set_default_bool(settings, "auto_start", true);
    obs_data_set_default_int(settings, "width", 1920);
    obs_data_set_default_int(settings, "height", 1080);
    bfree(default_path);
}

uint32_t photolive_source_get_width(void *data)
{
    photolive_source *context = (photolive_source*)data;
    return context->width;
}

uint32_t photolive_source_get_height(void *data)
{
    photolive_source *context = (photolive_source*)data;
    return context->height;
}

void photolive_source_video_render(void *data, gs_effect_t *effect)
{
    photolive_source *context = (photolive_source*)data;
    
    if (context->browser_source) {
        obs_source_video_render(context->browser_source);
    }
}

void photolive_source_setup_browser(photolive_source *context)
{
    if (!g_server_manager || !g_server_manager->is_running()) {
        obs_log(LOG_WARNING, "PhotoLive server not running, cannot setup browser source");
        return;
    }
    
    // Create browser source
    obs_data_t *browser_settings = obs_data_create();
    std::string url = g_server_manager->get_slideshow_url();
    
    obs_data_set_string(browser_settings, "url", url.c_str());
    obs_data_set_int(browser_settings, "width", context->width);
    obs_data_set_int(browser_settings, "height", context->height);
    obs_data_set_bool(browser_settings, "shutdown", true);
    obs_data_set_bool(browser_settings, "restart_when_active", false);
    
    context->browser_source = obs_source_create("browser_source", "PhotoLive Browser", 
                                               browser_settings, nullptr);
    
    obs_data_release(browser_settings);
    
    if (context->browser_source) {
        obs_log(LOG_INFO, "Browser source created with URL: %s", url.c_str());
    } else {
        obs_log(LOG_ERROR, "Failed to create browser source");
    }
}

void photolive_source_update_browser_url(photolive_source *context)
{
    if (!context->browser_source || !g_server_manager || !g_server_manager->is_running()) {
        return;
    }
    
    obs_data_t *browser_settings = obs_data_create();
    std::string url = g_server_manager->get_slideshow_url();
    
    obs_data_set_string(browser_settings, "url", url.c_str());
    obs_data_set_int(browser_settings, "width", context->width);
    obs_data_set_int(browser_settings, "height", context->height);
    
    obs_source_update(context->browser_source, browser_settings);
    obs_data_release(browser_settings);
}