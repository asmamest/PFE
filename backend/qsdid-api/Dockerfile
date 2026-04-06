# Dockerfile
FROM rust:1.85 as builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
COPY --from=builder /app/target/release/qsdid-api /usr/local/bin/
EXPOSE 8080
CMD ["qsdid-api"]

