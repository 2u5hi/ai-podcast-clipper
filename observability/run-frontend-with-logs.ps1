# Runs the Next.js dev server and mirrors its output into
# observability/logs/frontend.log, which Promtail tails into Loki.
#
# Use this INSTEAD of `npm run dev` when you want logs in Grafana.
#   ./observability/run-frontend-with-logs.ps1

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
$frontend = Join-Path $repoRoot "ai-podcast-clipper-frontend"
$logFile  = Join-Path $PSScriptRoot "logs\frontend.log"

Write-Host "Starting frontend; logs -> $logFile" -ForegroundColor Cyan
Set-Location $frontend

# 2>&1 folds stderr into stdout; Tee-Object shows it live AND appends to the file
npm run dev 2>&1 | Tee-Object -FilePath $logFile -Append
