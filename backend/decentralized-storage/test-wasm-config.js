import * as wasm from '../qsdid-wasm/pkg/qsdid_wasm.js';

async function test() {
  console.log('🔧 Testing WASM configuration...\n');
  
  // 1. Init WASM
  await wasm.init();
  console.log('✅ WASM initialized');
  
  // 2. Configurer l'URL de l'API
  const API_URL = 'http://localhost:8082';
  wasm.set_api_base_url(API_URL);
  console.log(`✅ API URL set to: ${API_URL}`);
  
  // 3. Tester health check
  try {
    const health = await wasm.health_check();
    console.log('✅ Health check:', health);
  } catch(e) {
    console.log('❌ Health check failed:', e.message);
  }
  
  // 4. Tester génération de clés
  try {
    const keys = await wasm.generate_hybrid_keys();
    console.log('✅ Keys generated successfully');
  } catch(e) {
    console.log('❌ Key generation failed:', e.message);
  }
  
  // 5. Tester signature
  const testDoc = Buffer.from(JSON.stringify({test: true})).toString('base64');
  try {
    const sig = await wasm.sign_document(testDoc);
    console.log('✅ Signature created:', sig.signature_id);
  } catch(e) {
    console.log('❌ Signature failed:', e.message);
  }
}

test();
