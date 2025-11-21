# TarkovTracker - Complete Clean Reinstall Script
# Run this script to fix the Vite/esbuild corruption issue

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   TarkovTracker Clean Reinstall" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Stop all Node processes
Write-Host "[1/5] Stopping all Node.js processes..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "Done - All Node processes stopped" -ForegroundColor Green

# Step 2: Delete node_modules
Write-Host "`n[2/5] Deleting node_modules folder..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Remove-Item -Path "node_modules" -Recurse -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Write-Host "Done - node_modules deleted" -ForegroundColor Green
}
else {
    Write-Host "Done - node_modules not found (already clean)" -ForegroundColor Green
}

# Step 3: Delete package-lock.json
Write-Host "`n[3/5] Deleting package-lock.json..." -ForegroundColor Yellow
if (Test-Path "package-lock.json") {
    Remove-Item -Path "package-lock.json" -Force -ErrorAction SilentlyContinue
    Write-Host "Done - package-lock.json deleted" -ForegroundColor Green
}
else {
    Write-Host "Done - package-lock.json not found" -ForegroundColor Green
}

# Step 4: Clean npm cache
Write-Host "`n[4/5] Clearing npm cache..." -ForegroundColor Yellow
npm cache clean --force | Out-Null
Write-Host "Done - npm cache cleared" -ForegroundColor Green

# Step 5: Fresh install
Write-Host "`n[5/5] Installing dependencies (this may take 2-3 minutes)..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -eq 0) {
    Write-Host "Done - Dependencies installed successfully!" -ForegroundColor Green
}
else {
    Write-Host "ERROR - Installation failed" -ForegroundColor Red
    exit 1
}

# Final message
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "   Clean Install Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "1. Run: npm run electron:dev" -ForegroundColor Yellow
Write-Host "2. Your Electron app should launch!" -ForegroundColor Yellow
Write-Host ""
