@echo off
chcp 65001 >nul
echo ========================================
echo  TarkovTracker - Installation Portable
echo ========================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js n'est pas installe!
    echo Veuillez installer Node.js depuis: https://nodejs.org/
    pause
    exit /b 1
)

echo [1/5] Installation des dependances Node.js...
call npm install
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Echec de npm install
    pause
    exit /b 1
)

echo.
echo [2/5] Telechargement de Python Embeddable...
if not exist "resources\python-embed" (
    mkdir "resources\python-embed"
)

:: Download Python embeddable if not present
if not exist "resources\python-embed\python.exe" (
    echo Telechargement de Python 3.11.9 embeddable...
    powershell -Command "Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip' -OutFile 'python-embed.zip'"
    powershell -Command "Expand-Archive -Path 'python-embed.zip' -DestinationPath 'resources\python-embed' -Force"
    del python-embed.zip

    :: Enable pip
    echo import site>> "resources\python-embed\python311._pth"

    :: Download get-pip.py
    powershell -Command "Invoke-WebRequest -Uri 'https://bootstrap.pypa.io/get-pip.py' -OutFile 'resources\python-embed\get-pip.py'"

    :: Install pip
    echo Installation de pip...
    "resources\python-embed\python.exe" "resources\python-embed\get-pip.py" --no-warn-script-location
)

echo.
echo [3/5] Installation des dependances Python...
"resources\python-embed\python.exe" -m pip install -r vision\requirements.txt --no-warn-script-location -q

:: Install additional dependencies for Florence-2 OCR
echo Installation de Florence-2 OCR dependencies...
"resources\python-embed\python.exe" -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu --no-warn-script-location -q
"resources\python-embed\python.exe" -m pip install transformers einops timm --no-warn-script-location -q

echo.
echo [4/5] Verification de l'installation...
"resources\python-embed\python.exe" -c "import cv2; import numpy; import fastapi; print('[OK] Python dependencies OK')"

echo.
echo [5/5] Creation du lanceur...

:: Create launcher batch file
(
echo @echo off
echo cd /d "%%~dp0"
echo echo Demarrage de TarkovTracker...
echo start "" npm run electron:dev
) > "TarkovTracker.bat"

:: Create VBS script to run without console window
(
echo Set WshShell = CreateObject^("WScript.Shell"^)
echo WshShell.CurrentDirectory = "%~dp0"
echo WshShell.Run "npm run electron:dev", 0, False
) > "TarkovTracker.vbs"

echo.
echo ========================================
echo  Installation terminee!
echo ========================================
echo.
echo Lanceurs crees:
echo   - TarkovTracker.bat  (avec console)
echo   - TarkovTracker.vbs  (sans console)
echo.
echo Double-cliquez sur TarkovTracker.vbs pour lancer!
echo.
pause
