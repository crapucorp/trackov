/**
 * Clean kappa-icons folder using the saved kappa-item-ids.json list
 */

const fs = require('fs');
const path = require('path');

// Load the Kappa item IDs
const kappaIdsPath = path.join(__dirname, '../assets/kappa-item-ids.json');
const kappaIds = JSON.parse(fs.readFileSync(kappaIdsPath, 'utf8'));

console.log(`📦 Loaded ${kappaIds.length} Kappa Collector item IDs\n`);

const kappaItemIds = new Set(kappaIds);

// Read kappa-icons directory
const iconsDir = path.join(__dirname, '../assets/kappa-icons');
const iconFiles = fs.readdirSync(iconsDir);

console.log(`🖼️  Total icons in folder: ${iconFiles.length}\n`);

// Identify files to keep and remove
const toKeep = [];
const toRemove = [];

iconFiles.forEach(file => {
    const itemId = path.basename(file, path.extname(file));

    if (kappaItemIds.has(itemId)) {
        toKeep.push(file);
    } else {
        toRemove.push(file);
    }
});

console.log(`✅ Icons to KEEP: ${toKeep.length}`);
console.log(`❌ Icons to REMOVE: ${toRemove.length}\n`);

// Show files to be removed
if (toRemove.length > 0) {
    console.log('Files that will be DELETED:');
    toRemove.forEach(file => console.log(`  - ${file}`));
    console.log('');
}

// Ask for confirmation
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

readline.question('⚠️  Delete these files? (yes/no): ', (answer) => {
    if (answer.toLowerCase() === 'yes') {
        let deletedCount = 0;
        toRemove.forEach(file => {
            try {
                fs.unlinkSync(path.join(iconsDir, file));
                deletedCount++;
                console.log(`🗑️  Deleted: ${file}`);
            } catch (err) {
                console.error(`❌ Error deleting ${file}:`, err.message);
            }
        });

        console.log(`\n✅ Cleanup complete! Deleted ${deletedCount}/${toRemove.length} files`);
        console.log(`📊 Remaining icons: ${toKeep.length} (Kappa Collector items only)\n`);
    } else {
        console.log('\n❌ Cleanup cancelled\n');
    }

    readline.close();
});
