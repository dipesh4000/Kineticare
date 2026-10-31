@echo off
setlocal EnableExtensions DisableDelayedExpansion
set "projectPushed="
pushd "%~dp0"
if errorlevel 1 (
  echo [ERROR] Cannot open the Kineticare project folder.
  goto :failed
)
set "projectPushed=1"
if not exist "scripts\launch.mjs" (
  echo [ERROR] Keep this launcher in the project folder beside package.json.
  goto :failed
)
where node.exe >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found. Install Node.js 22.12+ and reopen this launcher.
  goto :failed
)
node.exe -e "var v=process.versions.node.split('.').map(Number); if(v[0]<22||(v[0]===22&&v[1]<12)){console.error('[ERROR] Node.js 22.12+ is required; found '+process.version);process.exit(1);}"
if errorlevel 1 goto :failed
node.exe "scripts\launch.mjs"
set "launchExit=%errorlevel%"
goto :finish

:failed
set "launchExit=1"

:finish
if defined projectPushed popd
if not "%launchExit%"=="0" if not defined KINETICARE_NO_PAUSE pause
exit /b %launchExit%
