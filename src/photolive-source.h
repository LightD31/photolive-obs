#pragma once

#include <obs-module.h>
#include <string>

#define PHOTOLIVE_SOURCE_ID "photolive_source"

struct photolive_source {
    obs_source_t *source;
    obs_source_t *browser_source;
    std::string photos_path;
    bool auto_start;
    uint32_t width;
    uint32_t height;
};

// Source callbacks
void register_photolive_source();
void unregister_photolive_source();

// Source implementation
extern "C" {
    const char *photolive_source_get_name(void *type_data);
    void *photolive_source_create(obs_data_t *settings, obs_source_t *source);
    void photolive_source_destroy(void *data);
    void photolive_source_update(void *data, obs_data_t *settings);
    obs_properties_t *photolive_source_get_properties(void *data);
    void photolive_source_get_defaults(obs_data_t *settings);
    uint32_t photolive_source_get_width(void *data);
    uint32_t photolive_source_get_height(void *data);
    void photolive_source_video_render(void *data, gs_effect_t *effect);
}

// Helper functions
void photolive_source_setup_browser(photolive_source *context);
void photolive_source_update_browser_url(photolive_source *context);