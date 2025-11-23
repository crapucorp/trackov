# TarkovTracker

Kappa Item Tracker for Escape from Tarkov with real-time price scanner.

## Features

- ✅ Track Kappa container quest items
- ✅ Real-time item price scanner (Shift+F5)
- ✅ TerraGroup aesthetic UI
- ✅ Auto-update system
- ✅ Progress saved locally

## Installation

### 1. Download & Install

Download the latest `.exe` from [Releases](https://github.com/crapucorp/trackov/releases)

### 2. Setup Scanner Feature (Required for Shift+F5)

The scanner feature requires Python 3.9+ to be installed:

#### Install Python

1. Download Python from https://www.python.org/downloads/
2. **IMPORTANT**: Check "Add Python to PATH" during installation
3. Restart your computer after installation

#### Install Dependencies

1. Navigate to the application folder
2. Open `vision` folder
3. Right-click in the folder → "Open in Terminal" (or Command Prompt)
4. Run:
   ```bash
   pip install -r requirements.txt
   ```

#### Verify Installation

Launch TarkovTracker. Check the console for:
- ✅ "Python found"
- ✅ "Scanner service ready"

If you see errors, make sure Python is in your PATH and dependencies are installed.

## Usage

### Tracking Kappa Items

- Click items to mark them as found
- Progress saves automatically
- Data stored in `Documents/TarkovTracker/`

### Price Scanner (Shift+F5)

1. Hover over any item in Tarkov
2. Press **Shift+F5**
3. View real-time prices:
   - Flea Market
   - Therapist
   - Mechanic

## Troubleshooting

### "Python not found"

- Install Python from python.org
- Make sure "Add to PATH" was checked
- Restart computer
- Restart TarkovTracker

### "Missing Python dependencies"

Open terminal in `vision/` folder and run:
```bash
pip install -r requirements.txt
```

### Scanner not working

1. Check if Python is installed: `python --version`
2. Check if dependencies are installed
3. Launch app and check console for errors
4. Make sure you're hovering over an item when pressing Shift+F5

## Configuration

### Tarkov Market API (Optional)

For faster, real-time prices with Tarkov Market Pro:

1. Get your API key from https://tarkov-market.com/dev/api
2. Create `vision/.env` file with:
   ```
   TARKOV_MARKET_API_KEY=your_key_here
   ```
3. Restart app

Without this, the app uses tarkov.dev API (free, slightly slower).

## Development

```bash
npm install
npm run dev              # Start development server
npm run electron:dev     # Run Electron app
npm run build           # Build production version
```

## License

MIT
