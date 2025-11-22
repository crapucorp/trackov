// Fetch all Tarkov items from Tarkov.dev GraphQL API
// Saves to vision/tarkov_items.json for OCR fuzzy matching

const fs = require('fs');
const path = require('path');

const TARKOV_API = 'https://api.tarkov.dev/graphql';

const query = `
{
  items(lang: en) {
    id
    name
    shortName
    width
    height
    avg24hPrice
    types
  }
}
`;

async function fetchTarkovItems() {
    console.log('🔍 Fetching Tarkov items from API...');

    try {
        const response = await fetch(TARKOV_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });

        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json();
        const items = data.data.items;

        console.log(`✅ Fetched ${items.length} items`);

        // Save to JSON file
        const outputPath = path.join(__dirname, '../vision/tarkov_items.json');
        fs.writeFileSync(outputPath, JSON.stringify(items, null, 2));

        console.log(`📁 Saved to: ${outputPath}`);
        console.log('');
        console.log('Sample items:');
        items.slice(0, 5).forEach(item => {
            console.log(`  - ${item.shortName} (${item.name})`);
        });

    } catch (error) {
        console.error('❌ Error fetching items:', error.message);
        process.exit(1);
    }
}

fetchTarkovItems();
