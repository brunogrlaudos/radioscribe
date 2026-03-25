@echo off
title RadioScribe Pro - Backup
color 0B

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

set "DB=%ROOT%\dados\radioscribe.db"
set "BACKUP_DIR=%ROOT%\dados\backups"

if not exist "%DB%" (
    echo  Banco de dados nao encontrado.
    echo  Abra o RadioScribe primeiro para criar o banco.
    pause
    exit /b 1
)

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

:: Nome do backup com data e hora
for /f "tokens=1-3 delims=/" %%a in ("%date%") do set "DT=%%c-%%b-%%a"
for /f "tokens=1-2 delims=:" %%a in ("%time: =0%") do set "HR=%%a%%b"
set "BACKUP_FILE=%BACKUP_DIR%\radioscribe_%DT%_%HR%.db"

copy "%DB%" "%BACKUP_FILE%" >nul

echo.
echo  ==========================================
echo   Backup criado com sucesso!
echo  ==========================================
echo.
echo  Arquivo: %BACKUP_FILE%
echo.
pause
