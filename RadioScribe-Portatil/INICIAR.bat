@echo off
title RadioScribe Pro
color 0A

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

set "NODE_LOCAL=%ROOT%\node\node.exe"
set "NODE_MODULES=%ROOT%\node_modules"
set "SERVIDOR=%ROOT%\radioscribe-server.js"

echo.
echo  ==========================================
echo       RadioScribe Pro  v3.2
echo  ==========================================
echo.

:: ?? 1. Encontrar Node.js ??????????????????????????????
set "NODE_EXE="

:: Verificar Node.js portátil na pasta node\
if exist "%NODE_LOCAL%" (
    set "NODE_EXE=%NODE_LOCAL%"
    echo  Node.js portatil encontrado.
    goto :check_deps
)

:: Verificar Node.js instalado no sistema
where node >nul 2>&1
if %ERRORLEVEL% equ 0 (
    for /f "delims=" %%i in ('where node') do set "NODE_EXE=%%i"
    echo  Node.js do sistema encontrado.
    goto :check_deps
)

:: Node.js nao encontrado ? baixar versao portatil
color 0E
echo  Node.js nao encontrado.
echo  Baixando Node.js portatil (primeira vez apenas)...
echo.

if not exist "%ROOT%\node" mkdir "%ROOT%\node"

:: Tentar baixar com PowerShell
powershell -Command "& {$url='https://nodejs.org/dist/v20.18.0/node-v20.18.0-win-x64.zip'; $zip='%ROOT%\node\node.zip'; Write-Host '  Baixando... (pode demorar conforme a conexao)'; Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing; Write-Host '  Extraindo...'; Expand-Archive -Path $zip -DestinationPath '%ROOT%\node\tmp' -Force; Copy-Item '%ROOT%\node\tmp\node-v20.18.0-win-x64\node.exe' '%ROOT%\node\node.exe'; Remove-Item '%ROOT%\node\tmp' -Recurse -Force; Remove-Item $zip -Force; Write-Host '  Pronto!'}" 2>nul

if exist "%NODE_LOCAL%" (
    set "NODE_EXE=%NODE_LOCAL%"
    color 0A
    echo  Node.js portatil instalado com sucesso!
    goto :check_deps
)

:: Falha no download
color 0C
echo  [ERRO] Nao foi possivel baixar o Node.js automaticamente.
echo.
echo  Opcoes:
echo  1. Instale o Node.js LTS em: https://nodejs.org
echo  2. Ou copie o arquivo node.exe para a pasta:
echo     %ROOT%\node\
echo.
pause
exit /b 1

:: ?? 2. Verificar dependências ?????????????????????????
:check_deps
echo.
if not exist "%NODE_MODULES%\better-sqlite3" (
    echo  Instalando dependencias (primeira vez, aguarde ~2 min)...
    echo.
    cd /d "%ROOT%"
    "%NODE_EXE%" "%NODE_EXE%\..\npm" install --prefix "%ROOT%" 2>nul
    if not exist "%NODE_MODULES%\better-sqlite3" (
        :: Tentar com npm do sistema
        where npm >nul 2>&1
        if %ERRORLEVEL% equ 0 (
            npm install --prefix "%ROOT%"
        )
    )
    if not exist "%NODE_MODULES%\better-sqlite3" (
        color 0C
        echo.
        echo  [ERRO] Falha ao instalar dependencias.
        echo.
        echo  Execute manualmente como Administrador:
        echo  cd %ROOT%
        echo  npm install
        echo.
        pause
        exit /b 1
    )
    echo  Dependencias instaladas!
)

:: ?? 3. Verificar se já está rodando ???????????????????
curl -s http://localhost:3131/api/status >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo  Servidor ja esta rodando!
    echo  Abrindo navegador...
    start http://localhost:3131
    goto :fim
)

:: ?? 4. Iniciar servidor ???????????????????????????????
echo  Iniciando servidor...
echo  Acesse: http://localhost:3131
echo.
echo  [Mantenha esta janela aberta]
echo  [Para fechar: pressione Ctrl+C]
echo.

cd /d "%ROOT%"
"%NODE_EXE%" "%SERVIDOR%"

if %ERRORLEVEL% neq 0 (
    color 0C
    echo.
    echo  [ERRO] O servidor encerrou inesperadamente.
    echo  Veja a mensagem acima para detalhes.
)

:fim
pause
