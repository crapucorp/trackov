# WARNING: Set your GitHub token as environment variable before running
# Example: $env:GH_TOKEN = "your_token_here"
if (-not $env:GH_TOKEN) {
    Write-Host "ERROR: GH_TOKEN environment variable not set!" -ForegroundColor Red
    Write-Host "Please set it with: `$env:GH_TOKEN = 'your_github_token'" -ForegroundColor Yellow
    exit 1
}

$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
$env:ELECTRON_BUILDER_CACHE = "P:\Project\AI_Project_APP\TarkovTracker\.cache"

Write-Host "Starting Build & Publish Process..." -ForegroundColor Cyan
Write-Host "GH_TOKEN set." -ForegroundColor Green
Write-Host "Code Signing Disabled." -ForegroundColor Yellow
Write-Host "Using built-in 7za." -ForegroundColor Yellow

npm run electron:build:win -- --publish always

if ($LASTEXITCODE -eq 0) {
    Write-Host "SUCCESS! Release published to GitHub." -ForegroundColor Green
}
else {
    Write-Host "BUILD FAILED." -ForegroundColor Red
}
