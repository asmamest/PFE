import * as wasm from '../qsdid-wasm/pkg/qsdid_wasm.js';

async function test() {
  console.log('🔍 Testing WASM with init()...\n');
  
  // 1. Initialize WASM first
  console.log('📌 Calling init()...');
  try {
    await wasm.init();
    console.log('✅ init() successful');
  } catch(e) {
    console.log('❌ init() failed:', e.message);
  }
  
  // 2. Test generate_hybrid_keys
  console.log('\n📌 Testing generate_hybrid_keys...');
  try {
    const keys = await wasm.generate_hybrid_keys();
    console.log('✅ generate_hybrid_keys result:', keys);
  } catch(e) {
    console.log('❌ generate_hybrid_keys error:', e.message);
  }
  
  // 3. Test sign_document
  const testDoc = { test: true, message: "Hello PQ" };
  const testDocJson = JSON.stringify(testDoc);
  const testDocBase64 = Buffer.from(testDocJson).toString('base64');
  
  console.log('\n📌 Testing sign_document...');
  try {
    const signature = await wasm.sign_document(testDocBase64);
    console.log('✅ sign_document result:', signature);
  } catch(e) {
    console.log('❌ sign_document error:', e.message);
  }
}

test().catch(console.error);
