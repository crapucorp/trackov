/**
 * Test script to see the Collector task structure from Tarkov.dev API
 */

const https = require('https');

const query = `
{
  tasks(lang: en) {
    name
    tarkovDataId
    objectives {
      __typename
      ... on TaskObjectiveItem {
        id
        count
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

console.log('🔍 Fetching tasks from Tarkov.dev API...\n');

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

            const collectorTask = result.data.tasks.find(task =>
                task.name.toLowerCase().includes('collector')
            );

            if (collectorTask) {
                console.log('✅ Found Collector task:\n');
                console.log(JSON.stringify(collectorTask, null, 2));
            } else {
                console.log('❌ Collector task not found');
            }

        } catch (error) {
            console.error('❌ Error:', error);
            console.log('Response:', responseData.substring(0, 500));
        }
    });
});

req.on('error', (error) => {
    console.error('❌ Request error:', error);
});

req.write(data);
req.end();
