@echo off
echo Starting FastAPI backend...
cd /d "D:\SEmester 6\Qaudri Internship\Qadriportal\Backend"
.venv\Scripts\uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
pause
