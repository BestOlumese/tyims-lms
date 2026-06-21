// Quick test to verify Mux connection works
require('dotenv').config();
const Mux = require('@mux/mux-node').default;

console.log('MUX_TOKEN_ID:', process.env.MUX_TOKEN_ID ? 'SET' : 'MISSING');
console.log('MUX_TOKEN_SECRET:', process.env.MUX_TOKEN_SECRET ? 'SET' : 'MISSING');

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID,
  tokenSecret: process.env.MUX_TOKEN_SECRET,
});

async function test() {
  try {
    // Just list assets to verify the connection works
    const assets = await mux.video.assets.list({ limit: 1 });
    console.log('✅ Mux connection works! Assets found:', assets.data?.length ?? 0);
  } catch (err) {
    console.error('❌ Mux connection FAILED:', err.message);
    if (err.status) console.error('   Status:', err.status);
    if (err.error) console.error('   Error:', JSON.stringify(err.error));
  }
}

test();
