/**
 * Fetch Kappa Collector items from Tarkov.dev API
 * and clean the assets/kappa-icons folder
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// GraphQL query to get Collector task items
const query = `
{
  tasks(lang: en) {
    name
    tarkovDataId
    objectives {
      __typename
      ... on TaskObjectiveItem {
        id
        items {
          id
          name
          shortName
        }
      }
    }
  }
}
`;

console.log('🔍 Fetching Kappa Collector items from Tarkov.dev API...\n');

// Make GraphQL request
const data = JSON.stringify({ query });

const options = {
    hostname: 'api.tarkov.dev',
    port: 443,
    path: '/graphql',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = https.request(options, (res) => {
    let responseData = '';

    res.on('data', (chunk) => {
        responseData += chunk;
    });

    res.on('end', () => {
        try {
            const result = JSON.parse(responseData);

            // Find the "Collector" task
            const collectorTask = result.data.tasks.find(task =>
                task.name.toLowerCase().includes('collector')
            );

            if (!collectorTask) {
                console.error('❌ Collector task not found!');
                return;
            }

            console.log(`✅ Found task: ${collectorTask.name}\n`);

            // Extract all item IDs from objectives
            const kappaItemIds = new Set();

            collectorTask.objectives.forEach(obj => {
                if (obj.__typename === 'TaskObjectiveItem' && obj.items) {
                    obj.items.forEach(item => {
                        if (item.id) {
                            kappaItemIds.add(item.id);
                        }
                    });
                }
            });

            console.log(`📦 Found ${kappaItemIds.size} Kappa Collector items\n`);

            // Save the list to a file for reference
            const kappaListPath = path.join(__dirname, '../assets/kappa-item-ids.json');
            fs.writeFileSync(kappaListPath, JSON.stringify(Array.from(kappaItemIds), null, 2));
            console.log(`💾 Saved item IDs to: ${kappaListPath}\n`);

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
                    console.log(`📊 Remaining icons: ${toKeep.length} (Kappa items only)\n`);
                } else {
                    console.log('\n❌ Cleanup cancelled\n');
                }

                readline.close();
            });

        } catch (error) {
            console.error('❌ Error parsing response:', error);
        }
    });
});

req.on('error', (error) => {
    console.error('❌ API request error:', error);
});

req.write(data);
req.end();
