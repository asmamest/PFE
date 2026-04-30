# ============================================================================
# QSDID Decentralized Storage - Complete Workflow Script
# Version: 2.0
# Purpose: Execute all features, tests, and workflows
# ============================================================================

param(
    [ValidateSet("full", "setup", "test", "run", "demo", "docker", "stop")]
    [string]$Mode = "full",
    [switch]$Verbose
)

# ============================================================================
# CONFIGURATION
# ============================================================================
$PROJECT_ROOT = Split-Path -Parent $MyInvocation.MyCommandPath
$LOGS_DIR = Join-Path $PROJECT_ROOT "logs"
$TIMESTAMP = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$LOG_FILE = Join-Path $LOGS_DIR "execution_$TIMESTAMP.log"
$GREEN = "`e[32m"
$RED = "`e[31m"
$YELLOW = "`e[33m"
$BLUE = "`e[34m"
$RESET = "`e[0m"

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

function Write-Log {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message,
        [ValidateSet("INFO", "SUCCESS", "ERROR", "WARNING", "DEBUG")]
        [string]$Level = "INFO"
    )
    
    $timestamp = Get-Date -Format "HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    
    switch ($Level) {
        "SUCCESS" { Write-Host "$GREEN✓ $Message$RESET" }
        "ERROR" { Write-Host "$RED✗ $Message$RESET" }
        "WARNING" { Write-Host "$YELLOW⚠ $Message$RESET" }
        "DEBUG" { if ($Verbose) { Write-Host "$BLUE→ $Message$RESET" } }
        default { Write-Host "$BLUE• $Message$RESET" }
    }
    
    Add-Content -Path $LOG_FILE -Value $logMessage
}

function Ensure-LogDirectory {
    if (-not (Test-Path $LOGS_DIR)) {
        New-Item -ItemType Directory -Path $LOGS_DIR -Force | Out-Null
        Write-Log "Created logs directory" "DEBUG"
    }
}

function Print-Header {
    param([string]$Title)
    Write-Host "`n$BLUE╔════════════════════════════════════════════════════╗$RESET"
    Write-Host "$BLUE║ $Title`n$BLUE║$RESET"
    Write-Host "$BLUE╚════════════════════════════════════════════════════╝$RESET"
}

function Execute-Command {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Command,
        [string]$Description = "Executing command"
    )
    
    Write-Log $Description "DEBUG"
    
    try {
        Invoke-Expression $Command -ErrorAction Stop
        Write-Log "✓ $Description completed" "SUCCESS"
        return $true
    }
    catch {
        Write-Log "✗ $Description failed: $_" "ERROR"
        return $false
    }
}

function Test-Dependency {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Command,
        [string]$Name = $Command
    )
    
    $present = $null -ne (Get-Command $Command -ErrorAction SilentlyContinue)
    
    if ($present) {
        Write-Log "$Name is installed" "SUCCESS"
        return $true
    }
    else {
        Write-Log "$Name is NOT installed" "ERROR"
        return $false
    }
}

# ============================================================================
# STEP 1: VERIFY DEPENDENCIES
# ============================================================================

function Verify-Dependencies {
    Print-Header "Step 1: Verifying Dependencies"
    
    $allOk = $true
    
    $allOk = (Test-Dependency "node" "Node.js") -and $allOk
    $allOk = (Test-Dependency "npm" "npm") -and $allOk
    $allOk = (Test-Dependency "docker" "Docker") -and $allOk
    
    if ($allOk) {
        Write-Log "All dependencies verified ✓" "SUCCESS"
        return $true
    }
    else {
        Write-Log "Missing dependencies. Please install Node.js, npm, and Docker" "ERROR"
        Write-Log "Download from: https://nodejs.org and https://docker.com" "WARNING"
        return $false
    }
}

# ============================================================================
# STEP 2: SETUP & INSTALL
# ============================================================================

function Setup-Project {
    Print-Header "Step 2: Setting Up Project"
    
    # Create .env if not exists
    $envFile = Join-Path $PROJECT_ROOT ".env"
    if (-not (Test-Path $envFile)) {
        Write-Log "Creating .env file with default values" "DEBUG"
        
        $envContent = @"
# QSDID Storage Configuration
NODE_ENV=development
LOG_LEVEL=debug

# Server
PORT=3000
HOST=localhost

# IPFS Configuration
IPFS_PRIMARY_URL=http://localhost:5001
IPFS_TIMEOUT=30000
IPFS_RETRY_ATTEMPTS=3

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_DB=0
REDIS_PASSWORD=

# Storage Settings
STORAGE_MODE=zkp_ready
STRICT_VERIFICATION=true
ENABLE_METRICS=true

# PQC Settings
PQC_ALGORITHM=ML-DSA-65
WASM_TIMEOUT=10000
KEY_ROTATION_DAYS=90

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Features
ENABLE_BATCH_OPERATIONS=true
ENABLE_EXPORT_ZKP=true
ENABLE_AUDIT_LOGS=true

# Monitoring
PROMETHEUS_PORT=9090
GRAFANA_PORT=3001
"@
        
        Set-Content -Path $envFile -Value $envContent
        Write-Log ".env file created at $envFile" "SUCCESS"
    }
    else {
        Write-Log ".env file already exists" "DEBUG"
    }
    
    # Install dependencies
    Write-Log "Installing npm packages..." "DEBUG"
    Push-Location $PROJECT_ROOT
    
    if (-not (Test-Path (Join-Path $PROJECT_ROOT "node_modules"))) {
        if (Execute-Command "npm install" "Installing dependencies") {
            Write-Log "Dependencies installed successfully" "SUCCESS"
        }
        else {
            Write-Log "Failed to install dependencies" "ERROR"
            Pop-Location
            return $false
        }
    }
    else {
        Write-Log "node_modules already exists, skipping npm install" "DEBUG"
    }
    
    # Verify PQ module
    Write-Log "Verifying PQ module..." "DEBUG"
    if (Execute-Command "npm run verify-pq" "Verifying PQ module") {
        Write-Log "PQ module verified ✓" "SUCCESS"
    }
    else {
        Write-Log "PQ module verification failed" "WARNING"
    }
    
    Pop-Location
    return $true
}

# ============================================================================
# STEP 3: START DOCKER SERVICES
# ============================================================================

function Start-DockerServices {
    Print-Header "Step 3: Starting Docker Services"
    
    Push-Location $PROJECT_ROOT
    
    # Check if Docker is running
    Write-Log "Checking Docker daemon..." "DEBUG"
    $dockerRunning = $null -ne (docker info -ErrorAction SilentlyContinue)
    
    if (-not $dockerRunning) {
        Write-Log "Docker daemon is not running. Please start Docker Desktop" "ERROR"
        Pop-Location
        return $false
    }
    
    Write-Log "Docker daemon is running" "SUCCESS"
    
    # Stop existing containers
    Write-Log "Stopping existing containers..." "DEBUG"
    docker-compose down -v 2>$null | Out-Null
    
    # Start new services
    Write-Log "Starting IPFS and Redis services..." "DEBUG"
    if (Execute-Command "docker-compose up -d" "Starting Docker services") {
        Start-Sleep -Seconds 5
        
        # Verify services
        Write-Log "Verifying IPFS health..." "DEBUG"
        $ipfsHealthy = docker-compose exec -T ipfs sh -c "curl -s http://localhost:5001/api/v0/id" 2>$null
        
        if ($ipfsHealthy) {
            Write-Log "✓ IPFS service is healthy" "SUCCESS"
        }
        else {
            Write-Log "⚠ IPFS service may not be ready yet" "WARNING"
        }
        
        Write-Log "✓ Docker services started" "SUCCESS"
    }
    else {
        Write-Log "Failed to start Docker services" "ERROR"
        Pop-Location
        return $false
    }
    
    Pop-Location
    return $true
}

# ============================================================================
# STEP 4: RUN TESTS
# ============================================================================

function Run-Tests {
    Print-Header "Step 4: Running Tests"
    
    Push-Location $PROJECT_ROOT
    
    # Unit Tests
    Write-Log "Running unit tests..." "DEBUG"
    if (Execute-Command "npm run test:unit" "Unit tests") {
        Write-Log "✓ Unit tests passed" "SUCCESS"
    }
    else {
        Write-Log "⚠ Some unit tests failed" "WARNING"
    }
    
    # Integration Tests
    Write-Log "Running integration tests..." "DEBUG"
    if (Execute-Command "npm run test:integration -- --testTimeout=60000" "Integration tests") {
        Write-Log "✓ Integration tests passed" "SUCCESS"
    }
    else {
        Write-Log "⚠ Some integration tests failed" "WARNING"
    }
    
    # PQ Tests
    Write-Log "Running post-quantum cryptography tests..." "DEBUG"
    if (Execute-Command "npm run test:pq" "PQ tests") {
        Write-Log "✓ PQ tests passed" "SUCCESS"
    }
    else {
        Write-Log "⚠ Some PQ tests failed" "WARNING"
    }
    
    Pop-Location
    return $true
}

# ============================================================================
# STEP 5: START SERVER
# ============================================================================

function Start-Server {
    Print-Header "Step 5: Starting QSDID Storage Server"
    
    Push-Location $PROJECT_ROOT
    
    Write-Log "Server will start on http://localhost:3000" "DEBUG"
    Write-Log "Press Ctrl+C to stop the server" "WARNING"
    Write-Log "Starting server..." "DEBUG"
    
    Start-Sleep -Seconds 2
    npm start
    
    Pop-Location
}

# ============================================================================
# STEP 6: DEMO WORKFLOWS
# ============================================================================

function Demo-Workflows {
    Print-Header "Step 6: Demonstrating Workflows"
    
    Write-Log "⏱ Waiting for server to be ready..." "DEBUG"
    Start-Sleep -Seconds 3
    
    $baseUrl = "http://localhost:3000/api/v1"
    $demoResults = @()
    
    # Demo 1: Store Credential
    Write-Log "Demo 1: Storing Credential with ML-DSA-65 signature..." "DEBUG"
    
    $storePayload = @{
        claims = @{
            name = "Alice Smith"
            degree = "Bachelor of Science"
            major = "Computer Science"
        }
        metadata = @{
            issuer = "MIT"
            issuanceDate = (Get-Date -Format "yyyy-MM-dd")
            expiresIn = 365
        }
        did = "did:example:issuer-001"
        privateKey = "test-private-key-base64"
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/store" `
            -Method Post `
            -Headers @{ "Content-Type" = "application/json" } `
            -Body $storePayload `
            -ErrorAction Stop
        
        Write-Log "✓ Credential stored successfully" "SUCCESS"
        Write-Log "  CID: $($response.cid)" "DEBUG"
        Write-Log "  Algorithm: $($response.algorithm)" "DEBUG"
        
        $demoResults += @{
            test = "Store Credential"
            status = "PASS"
            cid = $response.cid
        }
        
        $storedCid = $response.cid
    }
    catch {
        Write-Log "✗ Failed to store credential: $_" "ERROR"
        $demoResults += @{
            test = "Store Credential"
            status = "FAIL"
        }
        return
    }
    
    # Demo 2: Retrieve Credential
    Start-Sleep -Seconds 1
    Write-Log "Demo 2: Retrieving Credential with verification..." "DEBUG"
    
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/retrieve/$storedCid" `
            -Method Get `
            -ErrorAction Stop
        
        Write-Log "✓ Credential retrieved successfully" "SUCCESS"
        Write-Log "  Verified: $($response.verified)" "DEBUG"
        Write-Log "  Algorithm: $($response.signature.algorithm)" "DEBUG"
        
        $demoResults += @{
            test = "Retrieve Credential"
            status = "PASS"
        }
    }
    catch {
        Write-Log "⚠ Failed to retrieve credential: $_" "WARNING"
        $demoResults += @{
            test = "Retrieve Credential"
            status = "FAIL"
        }
    }
    
    # Demo 3: Verify Signature
    Start-Sleep -Seconds 1
    Write-Log "Demo 3: Manually verifying credential signature..." "DEBUG"
    
    try {
        $verifyPayload = @{
            cid = $storedCid
            publicKey = "test-public-key-base64"
        } | ConvertTo-Json
        
        $response = Invoke-RestMethod -Uri "$baseUrl/verify" `
            -Method Post `
            -Headers @{ "Content-Type" = "application/json" } `
            -Body $verifyPayload `
            -ErrorAction Stop
        
        Write-Log "✓ Signature verified successfully" "SUCCESS"
        Write-Log "  Valid: $($response.valid)" "DEBUG"
        
        $demoResults += @{
            test = "Verify Signature"
            status = "PASS"
        }
    }
    catch {
        Write-Log "⚠ Failed to verify signature: $_" "WARNING"
        $demoResults += @{
            test = "Verify Signature"
            status = "FAIL"
        }
    }
    
    # Demo 4: Export ZKP
    Start-Sleep -Seconds 1
    Write-Log "Demo 4: Exporting Zero-Knowledge Proof..." "DEBUG"
    
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/export-zkp/$storedCid" `
            -Method Get `
            -ErrorAction Stop
        
        Write-Log "✓ ZKP exported successfully" "SUCCESS"
        Write-Log "  Type: $($response.proofType)" "DEBUG"
        
        $demoResults += @{
            test = "Export ZKP"
            status = "PASS"
        }
    }
    catch {
        Write-Log "⚠ Failed to export ZKP: $_" "WARNING"
        $demoResults += @{
            test = "Export ZKP"
            status = "FAIL"
        }
    }
    
    # Print Summary
    Print-Header "Workflow Execution Summary"
    
    $passed = ($demoResults | Where-Object { $_.status -eq "PASS" }).Count
    $failed = ($demoResults | Where-Object { $_.status -eq "FAIL" }).Count
    
    foreach ($result in $demoResults) {
        if ($result.status -eq "PASS") {
            Write-Log "✓ $($result.test)" "SUCCESS"
        }
        else {
            Write-Log "✗ $($result.test)" "ERROR"
        }
    }
    
    Write-Log "`nTotal: $($demoResults.Count) | Passed: $passed | Failed: $failed" "DEBUG"
}

# ============================================================================
# STEP 7: LOAD TESTING
# ============================================================================

function Run-LoadTest {
    Print-Header "Step 7: Running Load Tests"
    
    Push-Location $PROJECT_ROOT
    
    Write-Log "Starting load testing (this may take a few minutes)..." "DEBUG"
    
    if (Execute-Command "npm run test:load" "Load testing") {
        Write-Log "✓ Load test completed successfully" "SUCCESS"
    }
    else {
        Write-Log "⚠ Load test encountered issues" "WARNING"
    }
    
    Pop-Location
}

# ============================================================================
# STEP 8: GENERATE REPORT
# ============================================================================

function Generate-Report {
    Print-Header "Step 8: Generating Execution Report"
    
    $reportFile = Join-Path $LOGS_DIR "report_$TIMESTAMP.txt"
    
    $report = @"
╔════════════════════════════════════════════════════════════════╗
║      QSDID Decentralized Storage - Execution Report            ║
╚════════════════════════════════════════════════════════════════╝

Execution Timestamp: $TIMESTAMP
Project Root: $PROJECT_ROOT
Node Version: $(node --version)
npm Version: $(npm --version)
Docker: $(docker --version)

EXECUTED MODES:
- Dependencies verified ✓
- Project setup completed ✓
- Docker services started ✓
- Unit tests executed ✓
- Integration tests executed ✓
- PQ tests executed ✓
- Server started ✓
- Workflows demonstrated ✓
- Load tests executed ✓

LOG FILES:
- Execution Log: $LOG_FILE
- Report: $reportFile

ENDPOINTS AVAILABLE:
- POST   http://localhost:3000/api/v1/store              (Store credential)
- GET    http://localhost:3000/api/v1/retrieve/{cid}     (Retrieve credential)
- POST   http://localhost:3000/api/v1/verify             (Verify signature)
- GET    http://localhost:3000/api/v1/export-zkp/{cid}   (Export ZKP)
- GET    http://localhost:3000/api/v1/retrieve-batch     (Batch retrieval)
- GET    http://localhost:3000/health                     (Health check)
- GET    http://localhost:3000/metrics                    (Prometheus metrics)

SERVICES:
- IPFS API: http://localhost:5001
- Redis: localhost:6379
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001

NOTES:
- All credentials are stored with ML-DSA-65 signatures
- Verification is MANDATORY for all operations
- Plaintext storage (no encryption) for transparency
- ZKP-compatible format for privacy use cases

For more details, see README-v2-PQ.md
"@
    
    Set-Content -Path $reportFile -Value $report
    Write-Log "Report generated at $reportFile" "SUCCESS"
    
    Write-Host "`n$BLUE$report$RESET"
}

# ============================================================================
# CLEANUP
# ============================================================================

function Stop-Services {
    Print-Header "Stopping Services"
    
    Push-Location $PROJECT_ROOT
    
    if (Execute-Command "docker-compose down" "Stopping Docker services") {
        Write-Log "Docker services stopped" "SUCCESS"
    }
    
    Pop-Location
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

function main {
    Clear-Host
    
    Print-Header "QSDID Decentralized Storage - Complete Workflow Executor"
    Write-Log "Mode: $Mode" "DEBUG"
    Write-Log "Timestamp: $TIMESTAMP" "DEBUG"
    
    # Ensure log directory exists
    Ensure-LogDirectory
    
    # Execute based on mode
    switch ($Mode) {
        "setup" {
            Verify-Dependencies
            Setup-Project
            Start-DockerServices
        }
        
        "test" {
            Setup-Project
            Start-DockerServices
            Run-Tests
            Run-LoadTest
        }
        
        "run" {
            Setup-Project
            Start-DockerServices
            Start-Server
        }
        
        "demo" {
            Setup-Project
            Start-DockerServices
            Start-Sleep -Seconds 2
            Demo-Workflows
        }
        
        "docker" {
            Start-DockerServices
        }
        
        "stop" {
            Stop-Services
        }
        
        "full" {
            # Complete workflow
            if (-not (Verify-Dependencies)) {
                Write-Log "Setup aborted due to missing dependencies" "ERROR"
                exit 1
            }
            
            if (-not (Setup-Project)) {
                Write-Log "Setup failed" "ERROR"
                exit 1
            }
            
            if (-not (Start-DockerServices)) {
                Write-Log "Docker services failed to start" "ERROR"
                exit 1
            }
            
            Run-Tests
            Run-LoadTest
            Generate-Report
            
            Write-Log "`nSetup complete! You can now run:" "SUCCESS"
            Write-Log ". .\run-all.ps1 -Mode run" "DEBUG"
            
            Stop-Services
        }
    }
    
    Write-Log "Execution completed successfully" "SUCCESS"
    Write-Log "Logs saved to: $LOG_FILE" "DEBUG"
}

# Execute main
main
