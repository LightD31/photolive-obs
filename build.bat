@echo off
REM PhotoLive OBS Plugin Build Script for Windows

echo Building PhotoLive OBS Plugin...

REM Check for required tools
where cmake >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo cmake is required but not found in PATH. Please install CMake.
    exit /b 1
)

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Node.js is required but not found in PATH. Please install Node.js.
    exit /b 1
)

where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo npm is required but not found in PATH. Please install Node.js.
    exit /b 1
)

REM Create build directory
if not exist build mkdir build
cd build

REM Install web app dependencies
echo Installing web application dependencies...
cd ..\web-app
npm install --production
cd ..\build

REM Configure CMake
echo Configuring build with CMake...
cmake .. -DCMAKE_BUILD_TYPE=Release -G "Visual Studio 16 2019" -A x64

REM Build the plugin
echo Building plugin...
cmake --build . --config Release

REM Create installation package
echo Creating installation package...
cmake --install . --prefix ..\dist

echo Build completed successfully!
echo Plugin files are in: %CD%\..\dist
echo.
echo Installation instructions:
echo 1. Copy the plugin files to your OBS plugins directory
echo 2. Restart OBS Studio
echo 3. Add 'PhotoLive Slideshow' source to your scene

pause