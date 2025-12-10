# TarkovTracker

Kappa Item Tracker for Escape from Tarkov with AI-powered item scanner.

## Features

- Track Kappa container quest items
- AI-powered item scanner with Florence-2 OCR
- Gear zone scanning (F3) - Scan entire equipment area
- Single item scanning (F4) - Scan item under cursor
- Real-time flea market prices via Google Sheets
- TerraGroup aesthetic UI
- Auto-update system
- Progress saved locally

## Installation (Portable)

### Option 1: Quick Install Script (Recommended)

1. Clone or download this repository
2. Run `INSTALL.bat`
3. Wait for all dependencies to install
4. Run `npm run electron:dev` to start

### Option 2: Manual Installation

#### Prerequisites
- Node.js 18+ ([Download](https://nodejs.org/))
- Python 3.11+ ([Download](https://www.python.org/downloads/))

#### Steps

```bash
# Install Node dependencies
npm install

# Install Python dependencies
cd vision
pip install -r requirements.txt
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
pip install transformers einops timm
```

## Usage

### Tracking Kappa Items

- Click items to mark them as found
- Progress saves automatically to `Documents/TarkovTracker/`

### Gear Scanner (F3)

1. Open your inventory in Tarkov
2. Press **F3** to scan the equipment zone
3. All detected items will be highlighted with prices

### Single Item Scanner (F4)

1. Hover over any item in Tarkov
2. Press **F4**
3. View item info and prices

### Keybind Configuration

Keybinds can be customized in Settings (gear icon).

## Configuration

### Google Sheet Prices (Recommended)

Create `vision/.env` file with:
```
GOOGLE_SHEET_ID=your_sheet_id_here
```

## Development

```bash
npm run dev              # Start Vite dev server
npm run electron:dev     # Run Electron app in dev mode
npm run build           # Build production version
npm run electron:build  # Build installer
```

## Troubleshooting

### Scanner not working

1. Check if Python is running: Look for "Scanner service ready" in console
2. Verify Florence-2 model downloaded (first run takes longer)
3. Make sure Tarkov is visible on screen

### "Missing Python dependencies"

Run in `vision/` folder:
```bash
pip install -r requirements.txt
pip install torch torchvision transformers einops timm
```

## License

MIT
