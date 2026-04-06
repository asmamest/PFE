use criterion::{criterion_group, criterion_main, Criterion};
use pqc_ml_kem::MlKem768;

fn bench_kem_generate(c: &mut Criterion) {
    c.bench_function("kem/generate", |b| {
        b.iter(|| MlKem768::generate().unwrap())
    });
}

fn bench_kem_encapsulate(c: &mut Criterion) {
    let keys = MlKem768::generate().unwrap();
    c.bench_function("kem/encapsulate", |b| {
        b.iter(|| MlKem768::encapsulate(&keys.public_key).unwrap())
    });
}

fn bench_kem_decapsulate(c: &mut Criterion) {
    let keys = MlKem768::generate().unwrap();
    let encapsulation = MlKem768::encapsulate(&keys.public_key).unwrap();
    c.bench_function("kem/decapsulate", |b| {
        b.iter(|| MlKem768::decapsulate(&keys.secret_key, &encapsulation.ciphertext.data).unwrap())
    });
}

criterion_group!(benches, bench_kem_generate, bench_kem_encapsulate, bench_kem_decapsulate);
criterion_main!(benches);
