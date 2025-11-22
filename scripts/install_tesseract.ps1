# Install Tesseract OCR for Windows
# Downloads portable version to avoid system-wide installation

Write-Host "Installing Tesseract OCR..." -ForegroundColor Cyan

$tesseractUrl = "https://digi.bib.uni-mannheim.de/tesseract/tesseract-ocr-w64-setup-5.3.3.20231005.exe"
$installerPath = "$env:TEMP\tesseract-installer.exe"
$installDir = "$PSScriptRoot\..\tesseract"

# Download installer
Write-Host "Downloading Tesseract..." -ForegroundColor Yellow
Invoke-WebRequest -Uri $tesseractUrl -OutFile $installerPath

# Install silently
Write-Host "Installing to $installDir..." -ForegroundColor Yellow
Start-Process -FilePath $installerPath -ArgumentList "/S","/D=$installDir" -Wait

# Clean up
Remove-Item $installerPath

Write-Host "✅ Tesseract installed successfully!" -ForegroundColor Green
Write-Host "Location: $installDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "Now run: pip install -r vision/requirements.txt" -ForegroundColor Yellow
