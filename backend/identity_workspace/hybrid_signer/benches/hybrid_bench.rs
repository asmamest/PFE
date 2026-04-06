use criterion::{criterion_group, criterion_main, Criterion, BenchmarkId, Throughput};
use hybrid_signer::HybridSigner;

fn bench_hybrid_signature(c: &mut Criterion) {
    let signer = HybridSigner::generate().unwrap();
    let verifier = HybridVerifier::new(
        signer.get_public_keys().pq_public_key.clone(),
        signer.get_public_keys().classic_public_key.clone(),
    );
    
    let sizes = [64, 256, 1024, 4096, 16384, 65536];
    let mut group = c.benchmark_group("Hybrid Signature");
    
    for size in sizes {
        group.throughput(Throughput::Bytes(size as u64));
        let message = vec![0u8; size];
        
        group.bench_with_input(BenchmarkId::new("sign", size), &message, |b, msg| {
            b.iter(|| signer.sign_hybrid(msg).unwrap())
        });
        
        let signature = signer.sign_hybrid(&message).unwrap();
        group.bench_with_input(BenchmarkId::new("verify", size), &(msg, signature), |b, (msg, sig)| {
            b.iter(|| verifier.verify_hybrid(msg, sig).unwrap())
        });
    }
    group.finish();
}

fn bench_key_generation(c: &mut Criterion) {
    c.bench_function("hybrid-key-generation", |b| {
        b.iter(|| HybridSigner::generate().unwrap())
    });
}

criterion_group!(benches, bench_hybrid_signature, bench_key_generation);
criterion_main!(benches);