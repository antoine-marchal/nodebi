@echo off
setlocal EnableExtensions
cd /d "%~dp0"

where node >nul 2>nul || (echo ERROR: Node.js 20 or later is required. & exit /b 1)
where npm >nul 2>nul || (echo ERROR: npm is not available on PATH. & exit /b 1)

for /f "delims=" %%V in ('node -p "process.versions.node"') do set "NODE_VERSION=%%V"
for /f "tokens=1 delims=." %%M in ("%NODE_VERSION%") do if %%M LSS 20 (
  echo ERROR: Node.js 20 or later is required; found %NODE_VERSION%.
  exit /b 1
)

if /i "%~1"=="--skip-install" (
  echo [1/4] Using installed dependencies...
) else (
  echo [1/4] Installing locked dependencies...
  call npm run ci:all || (
    echo ERROR: Dependency installation failed. Stop NodeBI development servers and retry.
    exit /b 1
  )
)

echo [2/4] Running lint, tests, and production builds...
call npm run check || exit /b 1

echo [3/4] Packaging release\nodebi.exe...
if not exist release mkdir release
if exist release\nodebi.exe del /q release\nodebi.exe
call npm run package:win:binary || exit /b 1

echo [4/4] Preparing release configuration...
if exist release\.env (
  echo Keeping existing release\.env.
) else if exist .env.production (
  copy /y .env.production release\.env >nul || exit /b 1
) else (
  copy /y .env.production.example release\.env >nul || exit /b 1
  echo WARNING: release\.env contains placeholder secrets and must be edited before startup.
)

echo.
echo Build complete: %CD%\release\nodebi.exe
echo Configuration: %CD%\release\.env
echo Run release\nodebi.exe after setting production secrets in release\.env.
exit /b 0
