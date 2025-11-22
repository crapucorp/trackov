const sharp = require('sharp');
const path = require('path');

let cv;

async function ensureOpenCV() {
    console.log('⏳ Initializing OpenCV...');
    try {
        const cvModule = require('@techstark/opencv-js');
        console.log(`  Module imported. Type: ${typeof cvModule}`);

        if (cvModule.Mat) {
            cv = cvModule;
        } else if (cvModule.cv && cvModule.cv.Mat) {
            cv = cvModule.cv;
        } else if (typeof cvModule.then === 'function') {
            console.log('  Waiting for Promise...');
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('OpenCV load timed out')), 2000)
            );
            try {
                cv = await Promise.race([cvModule, timeoutPromise]);
            } catch (e) {
                console.log(`  ⚠️ Promise wait failed: ${e.message}`);
                if (cvModule.Mat) cv = cvModule;
                else if (cvModule.cv && cvModule.cv.Mat) cv = cvModule.cv;
            }
        } else {
            cv = cvModule;
        }

        if (cv.onRuntimeInitialized && !cv.Mat) {
            await new Promise(resolve => { cv.onRuntimeInitialized = resolve; });
        } else if (!cv.Mat) {
            await new Promise(r => setTimeout(r, 1000));
        }

        if (!cv.Mat && cv.cv && cv.cv.Mat) cv = cv.cv;

        if (!cv.Mat) throw new Error('cv.Mat is undefined');
        console.log('✅ OpenCV loaded');
    } catch (e) {
        console.error('❌ OpenCV Init Failed:', e);
        process.exit(1);
    }
}

const { templateBuffer, screenshotBuffer } = await createTestImages();

console.log('🚀 Starting Multi-Scale Template Matching Test');
const startTime = Date.now();

// Decode images to Mat
const img = cv.matFromImageData(await decodeImage(screenshotBuffer));
const templ = cv.matFromImageData(await decodeImage(templateBuffer));

// Convert to Grayscale
const imgGray = new cv.Mat();
const templGray = new cv.Mat();
cv.cvtColor(img, imgGray, cv.COLOR_RGBA2GRAY);
cv.cvtColor(templ, templGray, cv.COLOR_RGBA2GRAY);

// Multi-scale logic
let bestMatch = { val: -1 };

// Scales to search: 0.5 to 1.5
const scales = [0.8, 0.9, 1.0, 1.1, 1.2, 1.3];

for (const scale of scales) {
    // Resize template
    const scaledWidth = Math.round(templGray.cols * scale);
    const scaledHeight = Math.round(templGray.rows * scale);

    if (scaledWidth > imgGray.cols || scaledHeight > imgGray.rows) continue;

    const scaledTempl = new cv.Mat();
    const dsize = new cv.Size(scaledWidth, scaledHeight);
    cv.resize(templGray, scaledTempl, dsize, 0, 0, cv.INTER_AREA);

    // Match
    const result = new cv.Mat();
    cv.matchTemplate(imgGray, scaledTempl, result, cv.TM_CCOEFF_NORMED);

    const minMax = cv.minMaxLoc(result);
    const maxVal = minMax.maxVal;
    const maxLoc = minMax.maxLoc;

    // console.log(`Scale ${scale}: MaxVal=${maxVal.toFixed(4)} at (${maxLoc.x}, ${maxLoc.y})`);

    if (maxVal > bestMatch.val) {
        bestMatch = {
            val: maxVal,
            loc: maxLoc,
            scale: scale,
            width: scaledWidth,
            height: scaledHeight
        };
    }

    scaledTempl.delete();
    result.delete();
}

const endTime = Date.now();
console.log(`\n🏁 Result:`);
console.log(`   Confidence: ${bestMatch.val.toFixed(4)}`);
console.log(`   Location:   x=${bestMatch.loc.x}, y=${bestMatch.loc.y}`);
console.log(`   Size:       ${bestMatch.width}x${bestMatch.height} (Scale: ${bestMatch.scale}x)`);
console.log(`   Time:       ${endTime - startTime}ms`);

// Cleanup
img.delete(); templ.delete();
imgGray.delete(); templGray.delete();

if (bestMatch.val > 0.8) {
    console.log('✅ TEST PASSED: Match found with high confidence.');
} else {
    console.error('❌ TEST FAILED: No good match found.');
}

    } catch (err) {
    console.error('❌ Error:', err);
}
}

// Helper to decode buffer to ImageData-like object for OpenCV
async function decodeImage(buffer) {
    const { data, info } = await sharp(buffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    return {
        data: new Uint8Array(data),
        width: info.width,
        height: info.height
    };
}

runTest();
