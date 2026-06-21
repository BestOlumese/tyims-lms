// Test creating a Mux asset with the EXACT same code as functions.ts
require('dotenv').config();
const Mux = require('@mux/mux-node').default;

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID,
  tokenSecret: process.env.MUX_TOKEN_SECRET,
});

// Use a known public test video
const testUrl = 'https://storage.googleapis.com/muxdemofiles/mux-video-intro.mp4';

async function test() {
  console.log('Testing with url:', testUrl);
  
  try {
    // Test with "input" (singular, recommended)
    console.log('\n--- Testing with { input: [...] } ---');
    const asset = await mux.video.assets.create({
      input: [{ url: testUrl }],
      playback_policy: ['public'],
    });
    console.log('✅ Asset created!');
    console.log('   ID:', asset.id);
    console.log('   Status:', asset.status);
    console.log('   Playback IDs:', JSON.stringify(asset.playback_ids));
    
    // Clean up - delete the test asset
    await mux.video.assets.delete(asset.id);
    console.log('   Test asset deleted.');
  } catch (err) {
    console.error('❌ Asset creation FAILED:', err.message);
    if (err.status) console.error('   Status:', err.status);
    if (err.error) console.error('   Error body:', JSON.stringify(err.error));
  }
}

test();
