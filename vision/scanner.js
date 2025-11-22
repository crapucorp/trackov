// Vision Scanner Module - Optimized with OpenCV.js
// Multi-scale template matching for Kappa item detection

const { desktopCapturer } = require('electron');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

class Scanner {
    constructor() {
        this.templatesCache = new Map();
        this.isScanning = false;
        this.confidenceThreshold = 0.8; // Higher threshold for OpenCV
        this.mainWindow = null;
        this.cvLoaded = false;
    }

    async ensureOpenCV() {
        if (this.cvLoaded && global.cv && global.cv.Mat) return;

        this.log('⏳ Initializing OpenCV...');

        try {
            // @techstark/opencv-js exports a Module factory function
            // We need to call it with proper configuration for Node.js/Electron
            this.log('  Importing OpenCV module factory...');
            const createOpenCVModule = require('@techstark/opencv-js');

            this.log(`  Module factory type: ${typeof createOpenCVModule}`);

            // Create a Promise that resolves when OpenCV is fully initialized
            const openCVPromise = new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(new Error('OpenCV initialization timed out after 10 seconds'));
                }, 10000); // 10 second timeout for initial load

                try {
                    // Call the factory function with configuration
                    const cv = createOpenCVModule({
                        onRuntimeInitialized: () => {
                            clearTimeout(timeoutId);
                            this.log('  ✅ OpenCV runtime initialized');
                            resolve(cv);
                        },
                        onAbort: (error) => {
                            clearTimeout(timeoutId);
                            this.error('  ❌ OpenCV WASM module aborted', error);
                            reject(new Error(`OpenCV WASM abort: ${error}`));
                        }
                    });

                    // Some versions might initialize synchronously
                    if (cv && cv.Mat) {
                        clearTimeout(timeoutId);
                        this.log('  ✅ OpenCV already initialized (synchronous)');
                        resolve(cv);
                    }
                } catch (error) {
                    clearTimeout(timeoutId);
                    reject(error);
                }
            });

            // Wait for initialization to complete
            global.cv = await openCVPromise;

            // Verify Mat is available
            if (!global.cv || !global.cv.Mat) {
                throw new Error('cv.Mat is undefined after initialization');
            }

            this.cvLoaded = true;
            this.log('✅ OpenCV initialized successfully');

        } catch (error) {
            this.error('❌ OpenCV initialization failed', error);
            throw error;
        }
    }



    log(message) {
        console.log(message);
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.executeJavaScript(
                `console.log('[SCANNER] ${String(message).replace(/'/g, "\\'")}')`
            ).catch(() => { });
        }
    }

    error(message, err) {
        console.error(message, err);
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            const errMsg = err ? `: ${String(err.message || err).replace(/'/g, "\\'")}` : '';
            this.mainWindow.webContents.executeJavaScript(
                `console.error('[SCANNER] ${String(message).replace(/'/g, "\\'")}${errMsg}')`
            ).catch(() => { });
        }
    }

    async loadTemplates() {
        await this.ensureOpenCV();

        const templatesDir = path.join(__dirname, '../assets/kappa-icons');
        this.log(`🔍 Looking for templates in: ${templatesDir}`);

        try {
            const files = await fs.readdir(templatesDir);
            const imageFiles = files.filter(f => f.endsWith('.webp') || f.endsWith('.png'));

            if (imageFiles.length === 0) {
                this.log('⚠️ No image files found');
                return 0;
            }

            this.log(`📦 Loading ${imageFiles.length} Kappa item templates...`);

            for (const file of imageFiles) {
                try {
                    const itemId = path.basename(file, path.extname(file));
                    const templatePath = path.join(templatesDir, file);
                    const templateBuffer = await fs.readFile(templatePath);

                    // Convert to raw buffer for OpenCV
                    const { data, info } = await sharp(templateBuffer)
                        .resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                        .ensureAlpha()
                        .raw()
                        .toBuffer({ resolveWithObject: true });

                    // Create Mat and convert to Grayscale
                    const mat = global.cv.matFromImageData({
                        data: new Uint8Array(data),
                        width: info.width,
                        height: info.height
                    });

                    const grayMat = new global.cv.Mat();
                    global.cv.cvtColor(mat, grayMat, global.cv.COLOR_RGBA2GRAY);
                    mat.delete(); // Free RGBA mat

                    this.templatesCache.set(itemId, {
                        mat: grayMat, // Keep grayscale mat in memory
                        width: info.width,
                        height: info.height,
                        name: itemId
                    });

                } catch (err) {
                    this.error(`  ❌ Failed to load ${file}`, err);
                }
            }

            this.log(`✅ Templates loaded: ${this.templatesCache.size} items`);
            return this.templatesCache.size;
        } catch (error) {
            this.error('❌ Error loading templates', error);
            return 0;
        }
    }

    async captureScreen() {
        try {
            const sources = await desktopCapturer.getSources({
                types: ['screen'],
                thumbnailSize: { width: 1920, height: 1080 }
            });

            if (sources.length === 0) {
                throw new Error('No screen sources available');
            }

            const primaryScreen = sources[0];
            const thumbnail = primaryScreen.thumbnail;

            // Convert to raw buffer for OpenCV
            const { data, info } = await sharp(thumbnail.toPNG())
                .ensureAlpha()
                .raw()
                .toBuffer({ resolveWithObject: true });

            return {
                data: new Uint8Array(data),
                width: info.width,
                height: info.height
            };
        } catch (error) {
            this.error('❌ Error capturing screen', error);
            throw error;
        }
    }

    async scanScreen() {
        if (this.isScanning) {
            this.log('⏸️ Scan already in progress...');
            return [];
        }

        this.isScanning = true;
        const startTime = Date.now();

        try {
            this.log('🚀 Starting Smart Scan...');
            await this.ensureOpenCV();

            if (this.templatesCache.size === 0) {
                await this.loadTemplates();
            }

            const screenData = await this.captureScreen();

            // Create Screen Mat
            const screenMat = global.cv.matFromImageData(screenData);
            const screenGray = new global.cv.Mat();
            global.cv.cvtColor(screenMat, screenGray, global.cv.COLOR_RGBA2GRAY);
            screenMat.delete();

            const matches = [];
            const scales = [0.8, 0.9, 1.0, 1.1, 1.2]; // Scale factors to check

            // Iterate over all templates
            for (const [itemId, template] of this.templatesCache) {
                let bestForTemplate = { val: -1 };

                for (const scale of scales) {
                    const scaledWidth = Math.round(template.width * scale);
                    const scaledHeight = Math.round(template.height * scale);

                    if (scaledWidth > screenGray.cols || scaledHeight > screenGray.rows) continue;

                    const scaledTempl = new global.cv.Mat();
                    const dsize = new global.cv.Size(scaledWidth, scaledHeight);
                    global.cv.resize(template.mat, scaledTempl, dsize, 0, 0, global.cv.INTER_AREA);

                    const result = new global.cv.Mat();
                    global.cv.matchTemplate(screenGray, scaledTempl, result, global.cv.TM_CCOEFF_NORMED);

                    const minMax = global.cv.minMaxLoc(result);

                    if (minMax.maxVal > bestForTemplate.val) {
                        bestForTemplate = {
                            val: minMax.maxVal,
                            x: minMax.maxLoc.x,
                            y: minMax.maxLoc.y,
                            width: scaledWidth,
                            height: scaledHeight,
                            scale: scale
                        };
                    }

                    scaledTempl.delete();
                    result.delete();
                }

                if (bestForTemplate.val >= this.confidenceThreshold) {
                    matches.push({
                        itemId: itemId,
                        x: bestForTemplate.x,
                        y: bestForTemplate.y,
                        width: bestForTemplate.width,
                        height: bestForTemplate.height,
                        confidence: bestForTemplate.val
                    });
                    // this.log(`  ✨ Found ${itemId}: ${(bestForTemplate.val * 100).toFixed(1)}% at ${bestForTemplate.x},${bestForTemplate.y}`);
                }
            }

            screenGray.delete();

            const uniqueMatches = this.removeDuplicates(matches);

            const duration = Date.now() - startTime;
            this.log(`🏁 Scan complete in ${duration}ms. Found ${uniqueMatches.length} items.`);

            return uniqueMatches;

        } catch (error) {
            this.error('❌ Scan failed', error);
            return [];
        } finally {
            this.isScanning = false;
        }
    }

    removeDuplicates(matches) {
        const sorted = matches.sort((a, b) => b.confidence - a.confidence);
        const unique = [];

        for (const match of sorted) {
            const overlaps = unique.some(existing => {
                // Check for significant overlap (center distance)
                const dx = Math.abs((existing.x + existing.width / 2) - (match.x + match.width / 2));
                const dy = Math.abs((existing.y + existing.height / 2) - (match.y + match.height / 2));
                return dx < 20 && dy < 20;
            });

            if (!overlaps) {
                unique.push(match);
            }
        }

        return unique;
    }
}

const scanner = new Scanner();
module.exports = { scanner };
