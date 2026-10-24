@echo off
echo ===================================================
echo   Iniciando Tunel Cloudflare para o Back-end Java
echo ===================================================
"%TEMP%\cloudflared.exe" tunnel --url http://localhost:8080
pause
