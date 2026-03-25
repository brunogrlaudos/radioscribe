@echo off
title RadioScribe Pro - Inicio Automatico com Windows
color 0A

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

net session >nul 2>&1
if %ERRORLEVEL% neq 0 (
    color 0C
    echo  [ERRO] Execute como Administrador!
    echo  Clique com botao direito e escolha "Executar como administrador"
    pause
    exit /b 1
)

:: Encontrar Node.js
set "NODE_EXE="
if exist "%ROOT%\node\node.exe" set "NODE_EXE=%ROOT%\node\node.exe"
if "%NODE_EXE%"=="" (
    for /f "delims=" %%i in ('where node 2^>nul') do set "NODE_EXE=%%i"
)
if "%NODE_EXE%"=="" (
    echo  [ERRO] Node.js nao encontrado. Execute INICIAR.bat primeiro.
    pause
    exit /b 1
)

set "SERVIDOR=%ROOT%\radioscribe-server.js"

echo.
echo  Configurando inicio automatico com o Windows...
echo.
echo  Pasta    : %ROOT%
echo  Servidor : %SERVIDOR%
echo.

schtasks /delete /tn "RadioScribePro" /f >nul 2>&1

schtasks /create /tn "RadioScribePro" /tr "\"%NODE_EXE%\" \"%SERVIDOR%\"" /sc ONLOGON /ru "%USERNAME%" /rl HIGHEST /delay 0000:30 /f >nul 2>&1

if %ERRORLEVEL% neq 0 (
    color 0C
    echo  [ERRO] Falha ao criar tarefa.
    pause
    exit /b 1
)

echo  Iniciando servidor agora...
start "" /min "%NODE_EXE%" "%SERVIDOR%"
timeout /t 3 /nobreak >nul

echo.
echo  ==========================================
echo   Inicio automatico ATIVADO!
echo  ==========================================
echo.
echo  O RadioScribe iniciara sozinho ao ligar o PC.
echo  Acesse sempre em: http://localhost:3131
echo.
echo  Para DESATIVAR: REMOVER_AUTOSTART.bat
echo.
start http://localhost:3131
pause
