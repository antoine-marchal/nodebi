@echo off
setlocal EnableExtensions
cd /d "%~dp0"

if "%~1"=="" (
  echo Usage: setversion.bat ^<major.minor.patch[-prerelease]^>
  echo Example: setversion.bat 1.2.0
  exit /b 2
)

set "VERSION=%~1"
where node >nul 2>nul || (echo ERROR: Node.js is not available on PATH. & exit /b 1)
where npm >nul 2>nul || (echo ERROR: npm is not available on PATH. & exit /b 1)
node -e "process.exit(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(process.argv[1]) ? 0 : 1)" "%VERSION%"
if errorlevel 1 (
  echo ERROR: "%VERSION%" is not a valid semantic version.
  exit /b 2
)

call npm version "%VERSION%" --no-git-tag-version --allow-same-version || exit /b 1
call npm version "%VERSION%" --prefix server --no-git-tag-version --allow-same-version || exit /b 1
call npm version "%VERSION%" --prefix client --no-git-tag-version --allow-same-version || exit /b 1
node -e "require('fs').writeFileSync('server/src/version.ts', '// Updated by setversion.bat. Keep this value aligned with the package manifests.\nexport const APP_VERSION = \'' + process.argv[1] + '\';\n')" "%VERSION%" || exit /b 1

echo NodeBI version updated to %VERSION%.
echo Review the changes, run build.bat, then commit the release metadata.
exit /b 0
