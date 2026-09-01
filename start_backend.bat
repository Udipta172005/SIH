@echo off
title AquaGNN Backend
echo Starting AquaGNN FastAPI Backend on http://127.0.0.1:8000 ...
cd /d "%~dp0"
call "%~dp0backend\.venv\Scripts\activate.bat"
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
pause
