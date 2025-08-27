#!/bin/bash

# PhotoLive OBS Plugin Build Script

set -e

echo "Building PhotoLive OBS Plugin..."

# Check for required tools
command -v cmake >/dev/null 2>&1 || { echo "cmake is required but not installed. Aborting." >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed. Aborting." >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm is required but not installed. Aborting." >&2; exit 1; }

# Create build directory
mkdir -p build
cd build

# Install web app dependencies
echo "Installing web application dependencies..."
cd ../web-app
npm install --production
cd ../build

# Configure CMake
echo "Configuring build with CMake..."
cmake .. -DCMAKE_BUILD_TYPE=Release

# Build the plugin
echo "Building plugin..."
make -j$(nproc)

# Create installation package
echo "Creating installation package..."
make install DESTDIR=../dist

echo "Build completed successfully!"
echo "Plugin files are in: $(pwd)/../dist"
echo ""
echo "Installation instructions:"
echo "1. Copy the plugin files to your OBS plugins directory"
echo "2. Restart OBS Studio"
echo "3. Add 'PhotoLive Slideshow' source to your scene"