cmake_minimum_required(VERSION 3.16)

project(photolive-obs VERSION 1.0.0)

# Add OBS Studio plugin development files
find_package(libobs REQUIRED)
find_package(obs-frontend-api REQUIRED)

# Plugin configuration
set(PLUGIN_AUTHOR "PhotoLive OBS")
set(PLUGIN_DESCRIPTION "Real-time photo slideshow plugin for OBS Studio with automatic folder monitoring")
set(PLUGIN_EMAIL "support@photolive-obs.com")
set(PLUGIN_WEBSITE "https://github.com/LightD31/photolive-obs")

# Source files
set(photolive-obs_SOURCES
    src/plugin-main.cpp
    src/photolive-source.cpp
    src/photolive-config.cpp
    src/node-server.cpp
)

# Headers
set(photolive-obs_HEADERS
    src/plugin-main.h
    src/photolive-source.h
    src/photolive-config.h
    src/node-server.h
)

# Resource files
set(photolive-obs_DATA
    data/locale/en-US.ini
    data/locale/fr-FR.ini
)

# Add the plugin target
add_library(photolive-obs MODULE
    ${photolive-obs_SOURCES}
    ${photolive-obs_HEADERS}
)

# Link libraries
target_link_libraries(photolive-obs
    OBS::libobs
    OBS::obs-frontend-api
)

# Set plugin properties
set_target_properties(photolive-obs PROPERTIES
    FOLDER "plugins"
    PREFIX ""
)

# Install the plugin
if(OS_WINDOWS)
    install(TARGETS photolive-obs DESTINATION "obs-plugins/64bit")
    install(FILES ${photolive-obs_DATA} DESTINATION "data/obs-plugins/photolive-obs/locale")
elseif(OS_MACOS)
    install(TARGETS photolive-obs DESTINATION "${OBS_PLUGIN_DESTINATION}")
    install(FILES ${photolive-obs_DATA} DESTINATION "${OBS_DATA_DESTINATION}/obs-plugins/photolive-obs/locale")
else()
    install(TARGETS photolive-obs DESTINATION "${CMAKE_INSTALL_FULL_LIBDIR}/obs-plugins")
    install(FILES ${photolive-obs_DATA} DESTINATION "${CMAKE_INSTALL_FULL_DATAROOTDIR}/obs/obs-plugins/photolive-obs/locale")
endif()

# Copy web application files
install(DIRECTORY web-app/ DESTINATION "${CMAKE_INSTALL_FULL_DATAROOTDIR}/obs/obs-plugins/photolive-obs/web-app")