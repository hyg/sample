#!/usr/bin/env node

/**
 * WebSocket listener background service.
 * 
 * Compatible with Python's ws_listener.py.
 * 
 * Usage:
 *   node scripts/ws_listener.js install --credential default  # Install as background service
 *   node scripts/ws_listener.js start                         # Start service
 *   node scripts/ws_listener.js stop                          # Stop service
 *   node scripts/ws_listener.js status                        # Check status
 *   node scripts/ws_listener.js uninstall                     # Uninstall service
 *   node scripts/ws_listener.js run --credential default      # Run in foreground
 */


const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVICE_MARKER = join(__dirname, '..', '.ws_listener_running');

/**
 * Run WebSocket listener in foreground.
 */
async function runListener(credentialName = 'default') {
    const cred = loadIdentity(credentialName);
    
    if (!cred) {
        console.error(`Credential '${credentialName}' not found`);
        process.exit(1);
    }
    
    if (!cred.jwt_token) {
        console.error('No JWT token found in credential');
        process.exit(1);
    }
    
    console.log('Starting WebSocket listener...');
    console.log(`  Credential: ${credentialName}`);
    console.log(`  DID: ${cred.did}`);
    
    const listener = new WSListener(cred.jwt_token, {
        handleMessage: (message) => {
            console.log('[Message]', message.type, message);
        }
    });
    
    listener.on('connected', () => {
        console.log('[Listener] Connected to WebSocket');
        writeFileSync(SERVICE_MARKER, new Date().toISOString());
    });
    
    listener.on('closed', (info) => {
        console.log('[Listener] Closed:', info);
        if (existsSync(SERVICE_MARKER)) {
            unlinkSync(SERVICE_MARKER);
        }
    });
    
    listener.on('error', (error) => {
        console.error('[Listener] Error:', error.message);
    });
    
    listener.on('message', (message) => {
        switch (message.type) {
            case 'new_message':
                console.log(`[New Message] From: ${message.sender_did}`);
                break;
            case 'e2ee_message':
                console.log(`[E2EE Message] From: ${message.sender_did}`);
                break;
            case 'relationship_update':
                console.log(`[Relationship] ${message.action}`);
                break;
            case 'group_update':
                console.log(`[Group] ${message.action}`);
                break;
        }
    });
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n[Listener] Shutting down...');
        listener.stop();
        if (existsSync(SERVICE_MARKER)) {
            unlinkSync(SERVICE_MARKER);
        }
        process.exit(0);
    });
    
    process.on('SIGTERM', () => {
        console.log('\n[Listener] Terminating...');
        listener.stop();
        if (existsSync(SERVICE_MARKER)) {
            unlinkSync(SERVICE_MARKER);
        }
        process.exit(0);
    });
    
    listener.start();
}

/**
 * Install as background service (platform-specific).
 */
async function installService(credentialName = 'default') {
    const platform = process.platform;
    const scriptPath = join(__dirname, 'ws_listener.js');
    const nodePath = process.execPath;
    
    console.log(`Installing WebSocket listener service on ${platform}...`);
    
    if (platform === 'win32') {
        // Windows: Create VBS script for silent execution
        const vbsPath = join(__dirname, '..', 'ws_listener.vbs');
        const vbsContent = `Set objShell = CreateObject("WScript.Shell")
objShell.Run """" & "${nodePath}" & """ """" & "${scriptPath}" & """ run --credential ${credentialName}", 0, False`;
        
        writeFileSync(vbsPath, vbsContent);
        
        // Create startup shortcut
        const startupPath = process.env.APPDATA.replace('Roaming', 'Microsoft\\Windows\\Start Menu\\Programs\\Startup');
        const shortcutPath = join(startupPath, 'awiki-ws-listener.vbs');
        
        try {
            const { execSync } = await import('child_process');
            execSync(`copy /Y "${vbsPath}" "${shortcutPath}"`);
            console.log('Service installed successfully');
            console.log(`  Startup script: ${shortcutPath}`);
            console.log('  The service will start automatically on next login');
        } catch (error) {
            console.error('Failed to create startup shortcut:', error.message);
            console.log('Please copy the VBS file manually to startup folder');
        }
    } else if (platform === 'darwin') {
        // macOS: Create launchd plist
        const plistPath = join(__dirname, '..', 'com.awiki.ws-listener.plist');
        const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.awiki.ws-listener</string>
    <key>ProgramArguments</key>
    <array>
        <string>${nodePath}</string>
        <string>${scriptPath}</string>
        <string>run</string>
        <string>--credential</string>
        <string>${credentialName}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${join(__dirname, '..', 'ws-listener.out.log')}</string>
    <key>StandardErrorPath</key>
    <string>${join(__dirname, '..', 'ws-listener.err.log')}</string>
</dict>
</plist>`;
        
        writeFileSync(plistPath, plistContent);
        
        const launchAgentsDir = join(process.env.HOME, 'Library', 'LaunchAgents');
        const targetPath = join(launchAgentsDir, 'com.awiki.ws-listener.plist');
        
        try {
            const { execSync } = await import('child_process');
            execSync(`cp "${plistPath}" "${targetPath}"`);
            execSync(`launchctl load "${targetPath}"`);
            console.log('Service installed successfully');
            console.log(`  LaunchAgent: ${targetPath}`);
        } catch (error) {
            console.error('Failed to install LaunchAgent:', error.message);
        }
    } else {
        // Linux: Create systemd service
        const servicePath = '/etc/systemd/system/awiki-ws-listener.service';
        const serviceContent = `[Unit]
Description=awiki.ai WebSocket Listener
After=network.target

[Service]
Type=simple
User=${process.env.USER}
ExecStart=${nodePath} ${scriptPath} run --credential ${credentialName}
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target`;
        
        console.log('Linux systemd service file:');
        console.log(serviceContent);
        console.log(`\nPlease save this to ${servicePath} and run:`);
        console.log('  sudo systemctl daemon-reload');
        console.log('  sudo systemctl enable awiki-ws-listener');
        console.log('  sudo systemctl start awiki-ws-listener');
    }
}

/**
 * Uninstall background service.
 */
async function uninstallService() {
    const platform = process.platform;
    
    console.log(`Uninstalling WebSocket listener service on ${platform}...`);
    
    if (platform === 'win32') {
        const startupPath = process.env.APPDATA.replace('Roaming', 'Microsoft\\Windows\\Start Menu\\Programs\\Startup');
        const shortcutPath = join(startupPath, 'awiki-ws-listener.vbs');
        const vbsPath = join(__dirname, '..', 'ws_listener.vbs');
        
        try {
            if (existsSync(shortcutPath)) {
                unlinkSync(shortcutPath);
                console.log('Removed startup shortcut');
            }
            if (existsSync(vbsPath)) {
                unlinkSync(vbsPath);
                console.log('Removed VBS script');
            }
        } catch (error) {
            console.error('Failed to remove files:', error.message);
        }
    } else if (platform === 'darwin') {
        const launchAgentsDir = join(process.env.HOME, 'Library', 'LaunchAgents');
        const targetPath = join(launchAgentsDir, 'com.awiki.ws-listener.plist');
        
        try {
            const { execSync } = await import('child_process');
            execSync(`launchctl unload "${targetPath}" 2>/dev/null || true`);
            if (existsSync(targetPath)) {
                unlinkSync(targetPath);
                console.log('Removed LaunchAgent');
            }
        } catch (error) {
            console.error('Failed to remove LaunchAgent:', error.message);
        }
    } else {
        console.log('Please run:');
        console.log('  sudo systemctl stop awiki-ws-listener');
        console.log('  sudo systemctl disable awiki-ws-listener');
        console.log('  sudo rm /etc/systemd/system/awiki-ws-listener.service');
    }
}

/**
 * Check service status.
 */
function checkStatus() {
    const isRunning = existsSync(SERVICE_MARKER);
    const platform = process.platform;
    
    console.log('WebSocket Listener Status:');
    console.log(`  Running: ${isRunning ? 'Yes' : 'No'}`);
    console.log(`  Platform: ${platform}`);
    
    if (platform === 'win32') {
        const startupPath = process.env.APPDATA.replace('Roaming', 'Microsoft\\Windows\\Start Menu\\Programs\\Startup');
        const shortcutPath = join(startupPath, 'awiki-ws-listener.vbs');
        console.log(`  Installed: ${existsSync(shortcutPath) ? 'Yes' : 'No'}`);
    } else if (platform === 'darwin') {
        const launchAgentsDir = join(process.env.HOME, 'Library', 'LaunchAgents');
        const targetPath = join(launchAgentsDir, 'com.awiki.ws-listener.plist');
        console.log(`  Installed: ${existsSync(targetPath) ? 'Yes' : 'No'}`);
    }
    
    if (isRunning) {
        try {
            const markerTime = readFileSync(SERVICE_MARKER, 'utf-8');
            console.log(`  Started at: ${markerTime}`);
        } catch (error) {
            // Ignore
        }
    }
}

/**
 * Parse command line arguments.
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const result = {
        credential: 'default'
    };
    
    if (args.length === 0) {
        printUsage();
        process.exit(0);
    }
    
    result.command = args[0];
    
    for (let i = 1; i < args.length; i++) {
        switch (args[i]) {
            case '--credential':
                result.credential = args[++i];
                break;
            case '--help':
            case '-h':
                printUsage();
                process.exit(0);
                break;
        }
    }
    
    return result;
}

function printUsage() {
    console.log(`
WebSocket listener background service.

Usage:
  node scripts/ws_listener.js <command> [options]

Commands:
  install     Install as background service
  start       Start service (foreground)
  stop        Stop service
  status      Check service status
  uninstall   Uninstall service
  run         Run in foreground (for testing)

Options:
  --credential <name>  Credential name (default: default)
  --help, -h           Show this help message

Examples:
  node scripts/ws_listener.js install --credential default
  node scripts/ws_listener.js run --credential default
  node scripts/ws_listener.js status
  node scripts/ws_listener.js uninstall
`);
}

// Main
const options = parseArgs();

switch (options.command) {
    case 'install':
        await installService(options.credential);
        break;
    case 'start':
    case 'run':
        await runListener(options.credential);
        break;
    case 'stop':
        if (existsSync(SERVICE_MARKER)) {
            unlinkSync(SERVICE_MARKER);
            console.log('Service stopped');
        } else {
            console.log('Service is not running');
        }
        break;
    case 'status':
        checkStatus();
        break;
    case 'uninstall':
        await uninstallService();
        break;
    default:
        console.error(`Unknown command: ${options.command}`);
        printUsage();
        process.exit(1);
}
