/**
 * Download Kappa Collector icons from Tarkov.dev API
 * This will fetch the official 40 Kappa items and download their icons
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const query = `
{
  tasks(lang: en) {
    name
    objectives {
      __typename
      ... on TaskObjectiveItem {
        items {
          id
          name
          shortName
          iconLink
        }
      }
    }
  }
}
`;

console.log('🔍 Fetching Kappa Collector items from Tarkov.dev API...\n');

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

    res.on('end', async () => {
        try {
            const result = JSON.parse(responseData);

            const collectorTask = result.data.tasks.find(task =>
                task.name.toLowerCase().includes('collector')
            );

            if (!collectorTask) {
                console.error('❌ Collector task not found!');
                return;
            }

            console.log(`✅ Found task: ${collectorTask.name}\n`);

            // Extract all items
            const kappaItems = [];
            collectorTask.objectives.forEach(obj => {
                if (obj.__typename === 'TaskObjectiveItem' && obj.items) {
                    kappaItems.push(...obj.items);
                }
            });

            console.log(`📦 Found ${kappaItems.length} Kappa Collector items\n`);

            // Create backup of current icons
            const iconsDir = path.join(__dirname, '../assets/kappa-icons');
            const backupDir = path.join(__dirname, '../assets/kappa-icons-backup');

            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
                console.log('📁 Created backup directory\n');
            }

            // Backup existing icons
            const existingIcons = fs.readdirSync(iconsDir);
            existingIcons.forEach(file => {
                const src = path.join(iconsDir, file);
                const dst = path.join(backupDir, file);
                fs.copyFileSync(src, dst);
            });
            console.log(`💾 Backed up ${existingIcons.length} existing icons to kappa-icons-backup\n`);

            // Clear current icons directory
            existingIcons.forEach(file => {
                fs.unlinkSync(path.join(iconsDir, file));
            });
            console.log('🗑️  Cleared icons directory\n');

            // Download each icon
            console.log('⬇️  Downloading Kappa icons...\n');
            let downloaded = 0;
            let failed = 0;

            for (const item of kappaItems) {
                try {
                    const iconUrl = item.iconLink.replace('https://assets.tarkov.dev/', '');
                    const fileName = `${item.id}.webp`;
                    const filePath = path.join(iconsDir, fileName);

                    await downloadFile(item.iconLink, filePath);
                    console.log(`  ✅ ${item.shortName} (${item.id})`);
                    downloaded++;
                } catch (err) {
                    console.error(`  ❌ Failed to download ${item.shortName}: ${err.message}`);
                    failed++;
                }
            }

            console.log(`\n✨ Download complete!`);
            console.log(`   Downloaded: ${downloaded}`);
            console.log(`   Failed: ${failed}`);
            console.log(`\n📊 Total Kappa icons: ${downloaded}\n`);

        } catch (error) {
            console.error('❌ Error:', error);
        }
    });
});

req.on('error', (error) => {
    console.error('❌ Request error:', error);
});

req.write(data);
req.end();

// Helper function to download a file
function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => { }); // Delete the file on error
            reject(err);
        });
    });
}
