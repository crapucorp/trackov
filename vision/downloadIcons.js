// Download ALL item icons from tasks.json and hideout.json
// Use item ID as filename for easy template matching

const fs = require('fs').promises;
const path = require('path');
const https = require('https');

const TASKS_FILE = path.join(__dirname, '../src/data/tasks.json');
const HIDEOUT_FILE = path.join(__dirname, '../src/data/hideout.json');
const ICONS_DIR = path.join(__dirname, '../assets/kappa-icons');

function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}`));
                return;
            }
            const fileStream = require('fs').createWriteStream(filepath);
            response.pipe(fileStream);
            fileStream.on('finish', () => {
                fileStream.close();
                resolve();
            });
            fileStream.on('error', reject);
        }).on('error', reject);
    });
}

async function main() {
    console.log('📦 Loading data files...');

    // Load data (handle BOM UTF-8)
    const tasksRaw = await fs.readFile(TASKS_FILE, 'utf-8');
    const hideoutRaw = await fs.readFile(HIDEOUT_FILE, 'utf-8');

    // Remove BOM if present
    const tasksData = JSON.parse(tasksRaw.replace(/^\uFEFF/, ''));
    const hideoutData = JSON.parse(hideoutRaw.replace(/^\uFEFF/, ''));

    console.log(`✅ Loaded ${tasksData.length} tasks and ${hideoutData.length} hideout modules`);

    // Extract all unique items
    const itemsMap = new Map();

    // Process tasks
    for (const task of tasksData) {
        if (!task.objectives) continue;
        for (const obj of task.objectives) {
            if (obj.item && obj.item.id && obj.item.iconLink) {
                itemsMap.set(obj.item.id, {
                    id: obj.item.id,
                    name: obj.item.name || 'unknown',
                    iconLink: obj.item.iconLink
                });
            }
        }
    }

    // Process hideout
    for (const module of hideoutData) {
        if (!module.levels) continue;
        for (const level of module.levels) {
            if (!level.require) continue;
            for (const req of level.require) {
                if (req.item && req.item.id && req.item.iconLink) {
                    itemsMap.set(req.item.id, {
                        id: req.item.id,
                        name: req.item.name || 'unknown',
                        iconLink: req.item.iconLink
                    });
                }
            }
        }
    }

    console.log(`\n🎯 Found ${itemsMap.size} unique items with icons`);

    // Ensure directory exists
    await fs.mkdir(ICONS_DIR, { recursive: true });

    // Download icons (limit to first 50 for testing, or remove limit)
    const items = Array.from(itemsMap.values());
    const LIMIT = 50; // Change to items.length for ALL items

    let downloaded = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < Math.min(LIMIT, items.length); i++) {
        const item = items[i];

        // Use ID as filename (webp extension)
        const filename = `${item.id}.webp`;
        const filepath = path.join(ICONS_DIR, filename);

        // Check if exists
        try {
            await fs.access(filepath);
            console.log(`⏭️  [${i + 1}/${LIMIT}] ${item.name} (exists)`);
            skipped++;
            continue;
        } catch { }

        // Download
        try {
            await downloadImage(item.iconLink, filepath);
            console.log(`✅ [${i + 1}/${LIMIT}] ${item.name}`);
            downloaded++;
            await new Promise(r => setTimeout(r, 100)); // Rate limit
        } catch (err) {
            console.error(`❌ [${i + 1}/${LIMIT}] ${item.name}: ${err.message}`);
            failed++;
        }
    }

    console.log(`\n🎉 Complete!`);
    console.log(`   Downloaded: ${downloaded}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Total processed: ${Math.min(LIMIT, items.length)} / ${items.length}`);
    console.log(`\n📁 Icons: ${ICONS_DIR}`);
}

main().catch(console.error);
