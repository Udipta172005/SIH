@echo off
title AquaGNN Unified Production App
echo ========================================================
echo AquaGNN: AI-Driven Urban Flood Nowcasting System
echo Serving Full Stack (APIs + React SPA) on http://127.0.0.1:8000
echo ========================================================
cd /d "%~dp0"
call "%~dp0backend\.venv\Scripts\activate.bat"
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
pause
