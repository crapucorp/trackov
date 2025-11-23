# Download and setup portable Tesseract OCR
Write-Host "Setting up portable Tesseract OCR..." -ForegroundColor Cyan

$tesseractDir = "$PSScriptRoot\..\tesseract-portable"
$downloadUrl = "https://digi.bib.uni-mannheim.de/tesseract/tesseract-ocr-w64-setup-5.3.3.20231005.exe"

if (-not (Test-Path $tesseractDir)) {
    New-Item -ItemType Directory -Path $tesseractDir -Force | Out-Null
}

Write-Host "Downloading Tesseract..." -ForegroundColor Yellow
$installerPath = "$env:TEMP\tesseract-installer.exe"
Invoke-WebRequest -Uri $downloadUrl -OutFile $installerPath

Write-Host "Installing..." -ForegroundColor Yellow
Start-Process -FilePath $installerPath -ArgumentList "/S","/D=$tesseractDir" -Wait -NoNewWindow

Remove-Item $installerPath -Force

$tesseractExe = Join-Path $tesseractDir "tesseract.exe"
if (Test-Path $tesseractExe) {
    Write-Host "Success! Tesseract installed at: $tesseractDir" -ForegroundColor Green
    & $tesseractExe --version
} else {
    Write-Host "Installation failed!" -ForegroundColor Red
    exit 1
}
