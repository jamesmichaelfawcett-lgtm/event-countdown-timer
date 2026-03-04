@echo off
echo ============================================
echo   Event Countdown Timer - Setup
echo ============================================
echo.
echo Checking for Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed!
    echo Please download and install Node.js from https://nodejs.org/
    echo Then run this script again.
    pause
    exit /b 1
)
echo Node.js found!
echo.
echo Installing dependencies...
npm install
if errorlevel 1 (
    echo ERROR: npm install failed!
    pause
    exit /b 1
)
echo.
echo ============================================
echo   Setup complete!
echo ============================================
echo.
echo To RUN the application:    npm start
echo To BUILD the installer:    npm run build
echo.
echo The installer will be created in the 'dist' folder.
echo.
pause
