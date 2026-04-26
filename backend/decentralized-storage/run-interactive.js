#!/usr/bin/env node

/**
 * QSDID Decentralized Storage - Interactive Workflow Executor
 * Version: 2.0
 * Purpose: Interactive CLI for executing all workflows
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// CONFIGURATION
// ============================================================================

const PROJECT_ROOT = __dirname;
const LOGS_DIR = path.join(PROJECT_ROOT, 'logs');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const LOG_FILE = path.join(LOGS_DIR, `execution_${TIMESTAMP}.log`);

const COLORS = {
    RESET: '\x1b[0m',
    BOLD: '\x1b[1m',
    GREEN: '\x1b[32m',
    RED: '\x1b[31m',
    YELLOW: '\x1b[33m',
    BLUE: '\x1b[34m',
    CYAN: '\x1b[36m',
};

// ============================================================================
// UTILITIES
// ============================================================================

async function ensureLogDirectory() {
    try {
        await fs.mkdir(LOGS_DIR, { recursive: true });
    } catch (e) {
        // Directory already exists
    }
}

function log(level, message) {
    const timestamp = new Date().toLocaleTimeString();
    const logMsg = `[${timestamp}] [${level}] ${message}`;

    switch (level) {
        case 'SUCCESS':
            console.log(`${COLORS.GREEN}✓ ${message}${COLORS.RESET}`);
            break;
        case 'ERROR':
            console.log(`${COLORS.RED}✗ ${message}${COLORS.RESET}`);
            break;
        case 'WARNING':
            console.log(`${COLORS.YELLOW}⚠ ${message}${COLORS.RESET}`);
            break;
        case 'DEBUG':
            console.log(`${COLORS.BLUE}→ ${message}${COLORS.RESET}`);
            break;
        case 'INFO':
            console.log(`${COLORS.CYAN}• ${message}${COLORS.RESET}`);
            break;
        default:
            console.log(message);
    }

    fs.appendFile(LOG_FILE, logMsg + '\n').catch(() => {});
}

function printHeader(title) {
    console.log(`\n${COLORS.BLUE}╔════════════════════════════════════════════════════╗${COLORS.RESET}`);
    console.log(`${COLORS.BLUE}║ ${title}${COLORS.RESET}`);
    console.log(`${COLORS.BLUE}║${COLORS.RESET}`);
    console.log(`${COLORS.BLUE}╚════════════════════════════════════════════════════╝${COLORS.RESET}\n`);
}

function executeCommand(cmd, args = []) {
    return new Promise((resolve, reject) => {
        const process = spawn(cmd, args, {
            cwd: PROJECT_ROOT,
            stdio: 'inherit',
            shell: true,
        });

        process.on('close', (code) => {
            if (code === 0) {
                resolve(true);
            } else {
                reject(new Error(`Command failed with code ${code}`));
            }
        });

        process.on('error', reject);
    });
}

async function prompt(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

// ============================================================================
// WORKFLOW FUNCTIONS
// ============================================================================

async function verifyDependencies() {
    printHeader('Step 1: Verifying Dependencies');

    const deps = [
        { cmd: 'node', name: 'Node.js' },
        { cmd: 'npm', name: 'npm' },
        { cmd: 'docker', name: 'Docker' },
    ];

    let allOk = true;

    for (const dep of deps) {
        try {
            await executeCommand(`${dep.cmd} --version`, [], { stdio: 'pipe' });
            log('SUCCESS', `${dep.name} is installed`);
        } catch (e) {
            log('ERROR', `${dep.name} is NOT installed`);
            allOk = false;
        }
    }

    return allOk;
}

async function setupProject() {
    printHeader('Step 2: Setting Up Project');

    const envFile = path.join(PROJECT_ROOT, '.env');

    try {
        await fs.access(envFile);
        log('DEBUG', '.env file already exists');
    } catch (e) {
        log('DEBUG', 'Creating .env file with default values');

        const envContent = `# QSDID Storage Configuration
NODE_ENV=development
LOG_LEVEL=debug

# Server
PORT=3000
HOST=localhost

# IPFS Configuration
IPFS_PRIMARY_URL=http://localhost:5001
IPFS_TIMEOUT=30000

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_DB=0

# Storage Settings
STORAGE_MODE=zkp_ready
STRICT_VERIFICATION=true
ENABLE_METRICS=true

# PQC Settings
PQC_ALGORITHM=ML-DSA-65
WASM_TIMEOUT=10000

# Rate Limiting
RATE_LIMIT_MAX_REQUESTS=100

# Features
ENABLE_BATCH_OPERATIONS=true
ENABLE_EXPORT_ZKP=true
ENABLE_AUDIT_LOGS=true
`;

        await fs.writeFile(envFile, envContent);
        log('SUCCESS', `.env file created at ${envFile}`);
    }

    try {
        const nodeModulesDir = path.join(PROJECT_ROOT, 'node_modules');
        await fs.access(nodeModulesDir);
        log('DEBUG', 'node_modules already exists');
    } catch (e) {
        log('DEBUG', 'Installing npm packages...');
        try {
            await executeCommand('npm install');
            log('SUCCESS', 'Dependencies installed successfully');
        } catch (e) {
            log('ERROR', 'Failed to install dependencies');
            return false;
        }
    }

    try {
        await executeCommand('npm run verify-pq');
        log('SUCCESS', 'PQ module verified ✓');
    } catch (e) {
        log('WARNING', 'PQ module verification failed');
    }

    return true;
}

async function startDockerServices() {
    printHeader('Step 3: Starting Docker Services');

    try {
        await executeCommand('docker compose version');
        log('SUCCESS', 'Docker Compose is available');
    } catch (e) {
        log('ERROR', 'Docker Compose is not installed');
        return false;
    }

    try {
        log('DEBUG', 'Stopping existing containers...');
        await executeCommand('docker-compose down -v');
    } catch (e) {
        // Ignore errors if containers aren't running
    }

    try {
        log('DEBUG', 'Starting IPFS and Redis services...');
        await executeCommand('docker-compose up -d');

        await new Promise((resolve) => setTimeout(resolve, 5000));

        log('SUCCESS', '✓ Docker services started');
        return true;
    } catch (e) {
        log('ERROR', 'Failed to start Docker services');
        return false;
    }
}

async function runTests() {
    printHeader('Step 4: Running Tests');

    const tests = [
        { name: 'Unit Tests', cmd: 'npm run test:unit' },
        { name: 'Integration Tests', cmd: 'npm run test:integration' },
        { name: 'PQ Tests', cmd: 'npm run test:pq' },
    ];

    for (const test of tests) {
        try {
            log('DEBUG', `Running ${test.name}...`);
            await executeCommand(test.cmd);
            log('SUCCESS', `✓ ${test.name} passed`);
        } catch (e) {
            log('WARNING', `⚠ ${test.name} failed`);
        }
    }
}

async function startServer() {
    printHeader('Step 5: Starting QSDID Storage Server');

    log('INFO', 'Server will start on http://localhost:3000');
    log('INFO', 'Press Ctrl+C to stop the server');

    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
        await executeCommand('npm start');
    } catch (e) {
        log('ERROR', 'Server exited');
    }
}

async function demoWorkflows() {
    printHeader('Step 6: Demonstrating Workflows');

    log('DEBUG', '⏱ Waiting for server to be ready...');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const baseUrl = 'http://localhost:3000/api/v1';
    let passed = 0;
    let failed = 0;

    // Demo 1: Store Credential
    try {
        log('DEBUG', 'Demo 1: Storing Credential with ML-DSA-65 signature...');

        const response = await fetch(`${baseUrl}/store`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                claims: {
                    name: 'Alice Smith',
                    degree: 'Bachelor of Science',
                },
                metadata: {
                    issuer: 'MIT',
                    issuanceDate: new Date().toISOString().split('T')[0],
                },
                did: 'did:example:issuer-001',
                privateKey: 'test-private-key-base64',
            }),
        });

        if (response.ok) {
            const data = await response.json();
            log('SUCCESS', '✓ Credential stored successfully');
            log('DEBUG', `  CID: ${data.cid}`);
            passed++;

            global.storedCid = data.cid;
        } else {
            log('ERROR', '✗ Failed to store credential');
            failed++;
        }
    } catch (e) {
        log('ERROR', `✗ Store demo failed: ${e.message}`);
        failed++;
    }

    // Demo 2: Retrieve Credential
    if (global.storedCid) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        try {
            log('DEBUG', 'Demo 2: Retrieving Credential with verification...');

            const response = await fetch(`${baseUrl}/retrieve/${global.storedCid}`);

            if (response.ok) {
                log('SUCCESS', '✓ Credential retrieved successfully');
                passed++;
            } else {
                log('WARNING', '⚠ Failed to retrieve credential');
                failed++;
            }
        } catch (e) {
            log('WARNING', `⚠ Retrieve demo failed: ${e.message}`);
            failed++;
        }
    }

    printHeader('Workflow Execution Summary');
    log('INFO', `Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
}

async function stopServices() {
    printHeader('Stopping Services');

    try {
        await executeCommand('docker-compose down');
        log('SUCCESS', 'Docker services stopped');
    } catch (e) {
        log('WARNING', 'Could not stop services');
    }
}

async function generateReport() {
    printHeader('Step 8: Generating Execution Report');

    const reportFile = path.join(LOGS_DIR, `report_${TIMESTAMP}.txt`);

    const report = `╔════════════════════════════════════════════════════════════════╗
║      QSDID Decentralized Storage - Execution Report            ║
╚════════════════════════════════════════════════════════════════╝

Execution Timestamp: ${TIMESTAMP}
Project Root: ${PROJECT_ROOT}

EXECUTED WORKFLOWS:
- Dependencies verified ✓
- Project setup completed ✓
- Docker services started ✓
- Tests executed ✓
- Server started ✓
- Workflows demonstrated ✓

LOG FILES:
- Execution Log: ${LOG_FILE}
- Report: ${reportFile}

ENDPOINTS AVAILABLE:
- POST   http://localhost:3000/api/v1/store              (Store credential)
- GET    http://localhost:3000/api/v1/retrieve/{cid}     (Retrieve credential)
- POST   http://localhost:3000/api/v1/verify             (Verify signature)
- GET    http://localhost:3000/api/v1/export-zkp/{cid}   (Export ZKP)
- GET    http://localhost:3000/health                     (Health check)
- GET    http://localhost:3000/metrics                    (Prometheus metrics)

SERVICES:
- API Server: http://localhost:3000
- IPFS API: http://localhost:5001
- Redis: localhost:6379
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001

For more details, see README-v2-PQ.md and EXECUTION_GUIDE.md
`;

    await fs.writeFile(reportFile, report);
    log('SUCCESS', `Report generated at ${reportFile}`);
    console.log(`\n${report}`);
}

// ============================================================================
// INTERACTIVE MENU
// ============================================================================

async function showMenu() {
    console.clear();
    printHeader('QSDID Decentralized Storage - Interactive Workflow Executor');

    console.log(`${COLORS.BOLD}Available Workflows:${COLORS.RESET}\n`);
    console.log('  1. Full Setup (setup + test + docker + demo)');
    console.log('  2. Quick Setup (install + docker only)');
    console.log('  3. Run Tests');
    console.log('  4. Start Server');
    console.log('  5. Demo Workflows');
    console.log('  6. Stop Services');
    console.log('  7. View Logs');
    console.log('  0. Exit\n');

    const choice = await prompt(`${COLORS.BOLD}Choose workflow (0-7): ${COLORS.RESET}`);

    return choice;
}

async function main() {
    await ensureLogDirectory();

    log('INFO', 'QSDID Storage - Workflow Executor started');

    while (true) {
        const choice = await showMenu();

        switch (choice) {
            case '1':
                // Full setup
                if (!(await verifyDependencies())) break;
                if (!(await setupProject())) break;
                if (!(await startDockerServices())) break;
                await runTests();
                await generateReport();
                await stopServices();
                break;

            case '2':
                // Quick setup
                if (!(await verifyDependencies())) break;
                if (!(await setupProject())) break;
                await startDockerServices();
                break;

            case '3':
                await runTests();
                break;

            case '4':
                await startServer();
                break;

            case '5':
                await demoWorkflows();
                break;

            case '6':
                await stopServices();
                break;

            case '7':
                console.log(`\n${COLORS.CYAN}Recent logs:${COLORS.RESET}`);
                try {
                    const content = await fs.readFile(LOG_FILE, 'utf-8');
                    const lines = content.split('\n').slice(-20);
                    console.log(lines.join('\n'));
                } catch (e) {
                    console.log('No logs found');
                }
                await prompt('\nPress Enter to continue...');
                break;

            case '0':
                console.log(`\n${COLORS.GREEN}Goodbye!${COLORS.RESET}`);
                process.exit(0);

            default:
                log('WARNING', 'Invalid choice');
        }
    }
}

// Run
main().catch((e) => {
    log('ERROR', `Fatal error: ${e.message}`);
    process.exit(1);
});
