@echo off
title Reception colis - test
cd /d "%~dp0"

set "NODE="
if exist "%USERPROFILE%\nodejs-portable\node-v24.18.0-win-x64\node.exe" set "NODE=%USERPROFILE%\nodejs-portable\node-v24.18.0-win-x64\node.exe"
if not defined NODE where node >nul 2>nul && set "NODE=node"

start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:8781/"

if defined NODE (
  "%NODE%" serveur-test.js
) else (
  where python >nul 2>nul
  if errorlevel 1 (
    echo.
    echo Ni Node ni Python ne sont installes : ouverture directe du fichier index.html.
    start "" "%~dp0index.html"
  ) else (
    echo Test sur http://localhost:8781/  ^(fermez cette fenetre pour arreter^)
    python -m http.server 8781
  )
)
echo.
pause
