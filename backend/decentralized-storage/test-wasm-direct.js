import * as wasm from '../qsdid-wasm/pkg/qsdid_wasm.js';

async function test() {
  console.log('🔍 Testing WASM module directly...\n');
  
  // 1. Voir toutes les fonctions disponibles
  const functions = Object.keys(wasm).filter(k => typeof wasm[k] === 'function');
  console.log('📋 Available functions:', functions);
  
  // 2. Tester generate_hybrid_keys
  console.log('\n📌 Testing generate_hybrid_keys...');
  try {
    const keys = await wasm.generate_hybrid_keys();
    console.log('✅ generate_hybrid_keys result:', keys);
  } catch(e) {
    console.log('❌ generate_hybrid_keys error:', e.message);
    console.log('Stack:', e.stack);
  }
  
  // 3. Tester sign_document avec différents formats
  const testDoc = { test: true, message: "Hello PQ" };
  const testDocJson = JSON.stringify(testDoc);
  const testDocBase64 = Buffer.from(testDocJson).toString('base64');
  
  console.log('\n📌 Testing sign_document...');
  console.log('   Input (base64):', testDocBase64.substring(0, 50) + '...');
  
  try {
    const signature = await wasm.sign_document(testDocBase64);
    console.log('✅ sign_document result:', signature);
  } catch(e) {
    console.log('❌ sign_document error:', e.message);
    console.log('Stack:', e.stack);
  }
  
  // 4. Vérifier si le WASM a besoin d'être initialisé
  console.log('\n📌 Checking WASM initialization...');
  if (wasm.default && typeof wasm.default === 'function') {
    console.log('Found default initialization function');
    try {
      await wasm.default();
      console.log('✅ WASM initialized via default()');
    } catch(e) {
      console.log('⚠️ default() failed:', e.message);
    }
  }
  
  // 5. Vérifier le format de l'objet wasm
  console.log('\n📌 WASM module structure:');
  console.log('  - __wbg:', typeof wasm.__wbg);
  console.log('  - __wbindgen:', typeof wasm.__wbindgen);
  console.log('  - init:', typeof wasm.init);
}

test().catch(console.error);
