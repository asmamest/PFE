# DOCKER COMPOSE UPDATES
# Add this to your docker-compose.yml for Redis with persistence

# ──────────────────────────────────────────────────────────────
# Redis Service with RDB + AOF Persistence
# ──────────────────────────────────────────────────────────────
redis:
  image: redis:7-alpine
  container_name: qsdid-redis
  ports:
    - "6379:6379"
  volumes:
    # Mount redis.conf for persistence settings
    - ./redis.conf:/usr/local/etc/redis/redis.conf:ro
    # Mount data directory for RDB snapshots and AOF
    - redis-data:/data
  command: redis-server /usr/local/etc/redis/redis.conf
  restart: unless-stopped
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 10s
    timeout: 3s
    retries: 3
  environment:
    - REDIS_PORT=6379
  networks:
    - qsdid-network

# ──────────────────────────────────────────────────────────────
# Storage Manager with updated config
# ──────────────────────────────────────────────────────────────
storage-manager:
  build:
    context: .
    dockerfile: Dockerfile
  container_name: qsdid-storage-manager
  ports:
    - "3500:3500"      # Main API
    - "9091:9091"      # Prometheus metrics
  depends_on:
    redis:
      condition: service_healthy
    ipfs-node-1:
      condition: service_started
  environment:
    - PORT=3500
    - NODE_ENV=production
    - LOG_LEVEL=info
    
    # Redis configuration
    - REDIS_URL=redis://redis:6379
    
    # IPFS nodes for replication
    - IPFS_API_URL=http://ipfs-node-1:5001
    - IPFS_NODE_1=http://ipfs-node-1:5001
    - IPFS_NODE_2=http://ipfs-node-2:5001
    - IPFS_NODE_3=http://ipfs-node-3:5001
    
    # Rate limiting
    - RATE_LIMIT_MAX=100
    - RATE_LIMIT_WINDOW_MS=900000
    
    # Storage paths
    - STORAGE_PATH=/data/ipfs
    
    # Metrics
    - METRICS_ENABLED=true
    - PROMETHEUS_PORT=9091
    
    # Oracle (optional)
    - BLOCKCHAIN_ENABLE_ORACLE=false
    - BLOCKCHAIN_RPC_URL=http://localhost:8545
    
    # Encryption key (CHANGE IN PRODUCTION!)
    - MASTER_ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000
    
  volumes:
    - ./src:/app/src:ro
  restart: unless-stopped
  networks:
    - qsdid-network

# ──────────────────────────────────────────────────────────────
# Prometheus for metrics scraping
# ──────────────────────────────────────────────────────────────
prometheus:
  image: prom/prometheus:latest
  container_name: qsdid-prometheus
  ports:
    - "9090:9090"
  volumes:
    - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
    - prometheus-data:/prometheus
  command:
    - '--config.file=/etc/prometheus/prometheus.yml'
    - '--storage.tsdb.path=/prometheus'
  restart: unless-stopped
  networks:
    - qsdid-network

# ──────────────────────────────────────────────────────────────
# Grafana for visualization
# ──────────────────────────────────────────────────────────────
grafana:
  image: grafana/grafana:latest
  container_name: qsdid-grafana
  ports:
    - "3000:3000"
  environment:
    - GF_SECURITY_ADMIN_PASSWORD=admin
    - GF_USERS_ALLOW_SIGN_UP=false
  volumes:
    - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards:ro
    - ./monitoring/grafana/datasources:/etc/grafana/provisioning/datasources:ro
    - grafana-data:/var/lib/grafana
  restart: unless-stopped
  depends_on:
    - prometheus
  networks:
    - qsdid-network

# ──────────────────────────────────────────────────────────────
# Volumes for data persistence
# ──────────────────────────────────────────────────────────────
volumes:
  redis-data:
    driver: local
  prometheus-data:
    driver: local
  grafana-data:
    driver: local

# ──────────────────────────────────────────────────────────────
# Network
# ──────────────────────────────────────────────────────────────
networks:
  qsdid-network:
    driver: bridge

# ──────────────────────────────────────────────────────────────
# STARTUP INSTRUCTIONS
# ──────────────────────────────────────────────────────────────
# 1. Update MASTER_ENCRYPTION_KEY with real 64-char hex value
# 2. Update BLOCKCHAIN values if Oracle is enabled
# 3. Ensure redis.conf exists in project root
# 4. Run: docker-compose up -d
# 5. Check logs: docker-compose logs -f storage-manager
# 6. View metrics: http://localhost:9091/metrics
# 7. Open Grafana: http://localhost:3000 (admin/admin)
# ──────────────────────────────────────────────────────────────
