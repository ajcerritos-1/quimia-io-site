#!/usr/bin/env pwsh
# gh wrapper for Quimia IO — always uses the dedicated ajcerritos-1 GitHub account.
#
# The global `gh` CLI stays logged in as JesusCerritos for all other projects.
# This repo pins its own gh config via GH_CONFIG_DIR so every gh invocation
# here (pr create, issue, repo view, ...) runs as ajcerritos-1.
$ErrorActionPreference = 'Stop'
$env:GH_CONFIG_DIR = Join-Path $env:USERPROFILE '.config\gh-ajcerritos1'
& gh @args
exit $LASTEXITCODE
