@echo off
REM Pizza Day & Night — starts the receipt print agent.
REM
REM Double-click to run it, or point Task Scheduler at this file with
REM "Run whether user is logged on or not" so receipts print after a reboot
REM without anyone touching the PC. See README.md.

cd /d "%~dp0"

:loop
REM The agent handles a dropped connection itself; this loop only covers the
REM cases it cannot — a crash, or Windows killing the process.
node print-agent.mjs
echo.
echo Print agent stopped. Restarting in 10 seconds. Close this window to stop.
timeout /t 10 /nobreak >nul
goto loop
