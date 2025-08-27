#!/bin/bash

# PhotoLive OBS Plugin Validation Script

echo "=== PhotoLive OBS Plugin Validation ==="
echo ""

# Check if we're in the right directory
if [ ! -f "CMakeLists.txt" ]; then
    echo "❌ Error: CMakeLists.txt not found. Please run this script from the plugin root directory."
    exit 1
fi

echo "✅ Found CMakeLists.txt"

# Check for required source files
required_files=(
    "src/plugin-main.cpp"
    "src/plugin-main.h"
    "src/node-server.cpp"
    "src/node-server.h"
    "src/photolive-source.cpp"
    "src/photolive-source.h"
    "src/photolive-config.cpp"
    "src/photolive-config.h"
)

echo ""
echo "Checking plugin source files..."
for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file (missing)"
    fi
done

# Check web application bundle
echo ""
echo "Checking web application bundle..."
if [ -d "web-app" ]; then
    echo "✅ web-app directory exists"
    
    if [ -f "web-app/server.js" ]; then
        echo "✅ web-app/server.js"
    else
        echo "❌ web-app/server.js (missing)"
    fi
    
    if [ -f "web-app/package.json" ]; then
        echo "✅ web-app/package.json"
    else
        echo "❌ web-app/package.json (missing)"
    fi
    
    if [ -d "web-app/public" ]; then
        echo "✅ web-app/public directory"
    else
        echo "❌ web-app/public directory (missing)"
    fi
else
    echo "❌ web-app directory (missing)"
fi

# Check build system
echo ""
echo "Checking build system..."
if [ -f "build.sh" ]; then
    echo "✅ build.sh"
else
    echo "❌ build.sh (missing)"
fi

if [ -f "build.bat" ]; then
    echo "✅ build.bat"
else
    echo "❌ build.bat (missing)"
fi

# Check documentation
echo ""
echo "Checking documentation..."
docs=(
    "PLUGIN_INSTALL.md"
    "PLUGIN_DEV.md"
    "PLUGIN_SUMMARY.md"
)

for doc in "${docs[@]}"; do
    if [ -f "$doc" ]; then
        echo "✅ $doc"
    else
        echo "❌ $doc (missing)"
    fi
done

# Check locale files
echo ""
echo "Checking locale files..."
if [ -f "data/locale/en-US.ini" ]; then
    echo "✅ data/locale/en-US.ini"
else
    echo "❌ data/locale/en-US.ini (missing)"
fi

if [ -f "data/locale/fr-FR.ini" ]; then
    echo "✅ data/locale/fr-FR.ini"
else
    echo "❌ data/locale/fr-FR.ini (missing)"
fi

# Test web application bundle
echo ""
echo "Testing web application bundle..."
cd web-app

if command -v node >/dev/null 2>&1; then
    echo "✅ Node.js is available"
    
    if command -v npm >/dev/null 2>&1; then
        echo "✅ npm is available"
        
        echo "Installing dependencies..."
        if npm install --production --silent; then
            echo "✅ Dependencies installed successfully"
            
            echo "Testing server startup..."
            timeout 5s node server.js > /dev/null 2>&1 &
            sleep 2
            
            if pgrep -f "node server.js" > /dev/null; then
                echo "✅ Server starts successfully"
                pkill -f "node server.js"
            else
                echo "❌ Server failed to start"
            fi
        else
            echo "❌ Failed to install dependencies"
        fi
    else
        echo "❌ npm not available"
    fi
else
    echo "❌ Node.js not available"
fi

cd ..

echo ""
echo "=== Validation Complete ==="
echo ""
echo "Next steps:"
echo "1. Install OBS Studio development libraries"
echo "2. Run './build.sh' (Linux/macOS) or 'build.bat' (Windows)"
echo "3. Install the built plugin to OBS plugins directory"
echo "4. Test in OBS Studio"