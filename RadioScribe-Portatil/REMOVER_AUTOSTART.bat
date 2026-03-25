@echo off
title RadioScribe Pro - Remover Inicio Automatico
color 0E

net session >nul 2>&1
if %ERRORLEVEL% neq 0 (
    color 0C
    echo  [ERRO] Execute como Administrador!
    pause
    exit /b 1
)

taskkill /f /fi "WINDOWTITLE eq RadioScribe Pro*" >nul 2>&1
schtasks /delete /tn "RadioScribePro" /f >nul 2>&1

echo.
echo  Inicio automatico REMOVIDO com sucesso.
echo  Para reativar: INSTALAR_AUTOSTART.bat
echo.
pause
