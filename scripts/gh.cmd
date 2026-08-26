@echo off
rem gh wrapper for Quimia IO — uses the dedicated ajcerritos-1 GitHub account.
rem Global gh stays as JesusCerritos; this repo pins GH_CONFIG_DIR to its own config.
set "GH_CONFIG_DIR=%USERPROFILE%\.config\gh-ajcerritos1"
gh %*
exit /b %errorlevel%
