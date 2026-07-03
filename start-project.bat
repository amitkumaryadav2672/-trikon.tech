@echo off
echo ========================================================
echo   Starting Trikon AI Voice Assistant Project
echo ========================================================

echo.
echo [1/3] Starting Express Backend Server...
start cmd /k "cd server && npm run dev"

echo.
echo [2/3] Starting React Frontend Client...
start cmd /k "cd client && npm run dev"

echo.
echo [3/3] Starting LiveKit Python Voice Agent...
echo Please ensure Python environment is activated and keys are configured in .env
start cmd /k "cd voice && python agent.py dev"

echo.
echo All services started! Check the newly opened terminal windows.
echo Frontend: http://localhost:3000
echo Backend: http://localhost:5000
echo ========================================================
pause
