@echo off
chcp 65001 >nul
echo ========================================
echo  TarkovTracker - Mise a jour
echo ========================================
echo.

:: Check if git is available
where git >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [INFO] Git non installe - Telechargement direct depuis GitHub...
    goto :download_zip
)

:: Try git pull first
echo [1/2] Telechargement des mises a jour...
git pull origin main
if %ERRORLEVEL% neq 0 (
    echo [WARNING] Git pull echoue, telechargement direct...
    goto :download_zip
)

echo.
echo [2/2] Mise a jour des dependances si necessaire...
call npm install --silent

echo.
echo ========================================
echo  Mise a jour terminee!
echo ========================================
goto :end

:download_zip
echo.
echo Telechargement depuis GitHub...
powershell -Command "Invoke-WebRequest -Uri 'https://github.com/crapucorp/trackov/archive/refs/heads/main.zip' -OutFile 'update.zip'"

echo Extraction des fichiers...
powershell -Command "Expand-Archive -Path 'update.zip' -DestinationPath 'update_temp' -Force"

:: Copy new files (preserve node_modules and python-embed)
echo Mise a jour des fichiers...
xcopy /E /Y /I "update_temp\trackov-main\src" "src"
xcopy /E /Y /I "update_temp\trackov-main\electron" "electron"
xcopy /E /Y /I "update_temp\trackov-main\vision" "vision"
xcopy /Y "update_temp\trackov-main\package.json" "."
xcopy /Y "update_temp\trackov-main\README.md" "."

:: Cleanup
rmdir /S /Q "update_temp"
del "update.zip"

echo.
echo [2/2] Mise a jour des dependances...
call npm install --silent

echo.
echo ========================================
echo  Mise a jour terminee!
echo ========================================

:end
echo.
pause
