@echo off
chcp 65001 >nul
title P2P Node
cd /d "%~dp0"
node index.js %*
pause
