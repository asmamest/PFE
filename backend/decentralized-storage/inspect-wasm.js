import * as wasm from '../qsdid-wasm/pkg/qsdid_wasm.js';

async function inspect() {
  console.log('🔍 Inspecting WASM functions:\n');
  
  // Voir toutes les fonctions
  const functions = Object.keys(wasm).filter(k => typeof wasm[k] === 'function');
  console.log('Functions:', functions);
  
  // Voir les paramètres attendus
  console.log('\n📌 Function signatures:');
  for (const fn of ['generate_hybrid_keys', 'sign_document', 'verify_signature', 'health_check', 'set_api_base_url']) {
    if (wasm[fn]) {
      console.log(`  - ${fn}: ${wasm[fn].length} parameter(s)`);
    }
  }
  
  // Tester set_api_base_url
  console.log('\n📌 Testing set_api_base_url...');
  try {
    const result = wasm.set_api_base_url('http://localhost:8082');
    console.log('  set_api_base_url returned:', result);
  } catch(e) {
    console.log('  Error:', e.message);
  }
  
  // Tester health_check
  console.log('\n📌 Testing health_check...');
  try {
    const result = await wasm.health_check();
    console.log('  health_check returned:', result);
    console.log('  Type:', typeof result);
  } catch(e) {
    console.log('  Error:', e.message);
  }
  
  // Tester generate_hybrid_keys
  console.log('\n📌 Testing generate_hybrid_keys...');
  try {
    const result = await wasm.generate_hybrid_keys();
    console.log('  generate_hybrid_keys returned:', result);
    if (result && typeof result === 'object') {
      console.log('  Keys:', Object.keys(result));
    }
  } catch(e) {
    console.log('  Error:', e.message, e.stack);
  }
}

inspect();
