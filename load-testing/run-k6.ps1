param (
    [string]$Test = "smoke",
    [string]$Target = "http://localhost:3001"
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$K6Bin = Join-Path $ScriptDir "bin\k6.exe"

$TestFile = switch ($Test.ToLower()) {
    "smoke"   { Join-Path $ScriptDir "smoke-test.js" }
    "load"    { Join-Path $ScriptDir "load-test.js" }
    "stress"  { Join-Path $ScriptDir "stress-test.js" }
    "soak"    { Join-Path $ScriptDir "soak-test.js" }
    default   { Join-Path $ScriptDir "$Test.js" }
}

if (-not (Test-Path $TestFile)) {
    Write-Error "Test file not found: $TestFile"
    exit 1
}

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "🚀 Running SnipLink k6 Load Test: $Test" -ForegroundColor Cyan
Write-Host "🎯 Target: $Target" -ForegroundColor Cyan
Write-Host "📜 Script: $TestFile" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan

if (Test-Path $K6Bin) {
    & $K6Bin run $TestFile --env SHORTENER_URL=$Target
} else {
    Write-Host "Local k6 binary not found, running via node benchmark..." -ForegroundColor Yellow
    $env:TARGET_URL = "$Target/healthz"
    node "$ScriptDir\benchmark-node.js"
}
