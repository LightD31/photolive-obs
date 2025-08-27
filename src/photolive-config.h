#pragma once

#include <obs-module.h>
#include <string>

struct photolive_config {
    std::string photos_path;
    bool auto_start;
    int server_port;
    std::string language;
};

extern photolive_config g_config;

void photolive_config_load();
void photolive_config_save();
void photolive_config_set_defaults();