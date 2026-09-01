@echo off
title AquaGNN Frontend (Dev Server)
echo Starting AquaGNN Vite React Dev Server on http://localhost:5173 ...
set "PATH=C:\Users\Jayati\.gemini\antigravity\scratch\tools\nodejs;%PATH%"
cd /d "%~dp0frontend"
npm run dev
pause
