@echo off
echo ==========================================
echo  Build .exe via GitHub (free, ~3 minutes)
echo ==========================================
echo.
echo STEPS:
echo  1. Install Git: https://git-scm.com
echo  2. Create free GitHub account: https://github.com
echo  3. Create empty repo at: https://github.com/new
echo     Name it: event-countdown-timer
echo     Leave it completely empty (no README)
echo.
pause
echo.
set /p GITHUB_USER=Enter your GitHub username: 
echo.
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/%GITHUB_USER%/event-countdown-timer.git
git push -u origin main
echo.
echo Done! Visit:
echo https://github.com/%GITHUB_USER%/event-countdown-timer/actions
echo.
echo Wait 3 minutes, click the workflow run,
echo then download EventCountdownTimer-Windows-Installer
echo.
pause