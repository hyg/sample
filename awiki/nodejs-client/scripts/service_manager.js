#!/usr/bin/env node
/**
 * Cross-platform service manager: install/uninstall/start/stop/status for ws_listener background process.
 *
 * [INPUT]: sys.platform, subprocess, pathlib, SDKConfig, logging_config
 * [OUTPUT]: ServiceManager (base), MacOSServiceManager, LinuxServiceManager, WindowsServiceManager, get_service_manager()
 * [POS]: Abstraction layer between ws_listener.py CLI and OS-specific service management (launchd / systemd / Task Scheduler)
 *
 * [PROTOCOL]:
 * 1. Update this header when logic changes
 * 2. Check the folder's CLAUDE.md after updating
 */

import { parseArgs } from 'util';
import { platform } from 'os';
import { execSync, spawn } from 'child_process';
import { resolve, join } from 'path';
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'fs';

const PROJECT_ROOT = resolve(process.cwd(), '..');
const SERVICE_LABEL = 'com.awiki.ws-listener';

// Platform detection
const currentPlatform = platform();
console.log(`Platform: ${currentPlatform}`);

// Get service manager based on platform
function getServiceManager() {
    if (currentPlatform === 'darwin') {
        return new MacOSServiceManager();
    } else if (currentPlatform === 'linux') {
        return new LinuxServiceManager();
    } else if (currentPlatform === 'win32') {
        return new WindowsServiceManager();
    } else {
        throw new Error(`Unsupported platform: ${currentPlatform}`);
    }
}

// Base ServiceManager class
class ServiceManager {
    findNode() {
        return process.execPath;
    }

    _buildRunArgs(credential, configPath, mode) {
        const nodePath = this.findNode();
        const scriptPath = resolve(PROJECT_ROOT, 'scripts', 'ws_listener.js');
        const args = [nodePath, scriptPath, 'run', '--credential', credential];
        if (configPath) {
            args.push('--config', resolve(configPath));
        }
        if (mode) {
            args.push('--mode', mode);
        }
        return args;
    }

    _ensureLogDir() {
        const d = this.logDir();
        if (!existsSync(d)) {
            mkdirSync(d, { recursive: true });
        }
        return d;
    }
}

// macOS service manager
class MacOSServiceManager extends ServiceManager {
    constructor() {
        super();
        this.agentsDir = join(process.env.HOME, 'Library', 'LaunchAgents');
        this.plistPath = join(this.agentsDir, `${SERVICE_LABEL}.plist`);
    }

    logDir() {
        return join(process.env.HOME, 'Library', 'Logs', 'awiki-ws-listener');
    }

    isInstalled() {
        return existsSync(this.plistPath);
    }

    install(credential, configPath, mode) {
        if (existsSync(this.plistPath)) {
            console.log(`Service already installed: ${this.plistPath}`);
            console.log('To reinstall, run first: node scripts/ws_listener.js uninstall');
            return;
        }

        if (!existsSync(this.agentsDir)) {
            mkdirSync(this.agentsDir, { recursive: true });
        }
        const logs = this._ensureLogDir();

        const plistContent = this._generatePlist(credential, configPath, mode, logs);
        writeFileSync(this.plistPath, plistContent, 'utf-8');
        console.log(`plist written to: ${this.plistPath}`);

        try {
            execSync(`launchctl load ${this.plistPath}`);
            console.log('Service installed and started');
            console.log(`  Logs: tail -f ${join(logs, 'stderr.log')}`);
        } catch (error) {
            console.log(`launchctl load failed: ${error.stderr}`);
        }
    }

    uninstall() {
        if (!existsSync(this.plistPath)) {
            console.log('Service not installed');
            return;
        }
        try {
            execSync(`launchctl unload ${this.plistPath}`);
        } catch (error) {
            console.log(`launchctl unload warning: ${error.stderr}`);
        }
        unlinkSync(this.plistPath);
        console.log('Service uninstalled');
    }

    start() {
        if (!existsSync(this.plistPath)) {
            console.log('Service not installed, run first: node scripts/ws_listener.js install');
            return;
        }
        try {
            execSync(`launchctl load ${this.plistPath}`);
            console.log('Service started');
        } catch (error) {
            console.log(`Start failed: ${error.stderr}`);
        }
    }

    stop() {
        if (!existsSync(this.plistPath)) {
            console.log('Service not installed');
            return;
        }
        try {
            execSync(`launchctl unload ${this.plistPath}`);
            console.log('Service stopped');
        } catch (error) {
            console.log(`Stop failed: ${error.stderr}`);
        }
    }

    status() {
        const output = {
            platform: 'macOS (launchd)',
            installed: existsSync(this.plistPath),
            service_file: this.plistPath
        };
        if (existsSync(this.plistPath)) {
            try {
                const result = execSync('launchctl list', { encoding: 'utf-8' });
                output.running = result.includes(SERVICE_LABEL);
            } catch (error) {
                output.running = false;
            }
        } else {
            output.running = false;
        }
        return output;
    }

    _generatePlist(credential, configPath, mode, logs) {
        const runArgs = this._buildRunArgs(credential, configPath, mode);
        const argsXml = runArgs.map(a => `        <string>${a}</string>`).join('\n');
        return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${SERVICE_LABEL}</string>

    <key>ProgramArguments</key>
    <array>
${argsXml}
    </array>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <true/>

    <key>ThrottleInterval</key>
    <integer>10</integer>

    <key>WorkingDirectory</key>
    <string>${PROJECT_ROOT}</string>

    <key>StandardOutPath</key>
    <string>${join(logs, 'stdout.log')}</string>
    <key>StandardErrorPath</key>
    <string>${join(logs, 'stderr.log')}</string>
</dict>
</plist>
`;
    }
}

// Linux service manager
class LinuxServiceManager extends ServiceManager {
    constructor() {
        super();
        this.unitName = 'awiki-ws-listener.service';
        const configHome = process.env.XDG_CONFIG_HOME || join(process.env.HOME, '.config');
        this.unitDir = join(configHome, 'systemd', 'user');
        this.unitPath = join(this.unitDir, this.unitName);
    }

    logDir() {
        const stateHome = process.env.XDG_STATE_HOME || join(process.env.HOME, '.local', 'state');
        return join(stateHome, 'awiki-ws-listener', 'logs');
    }

    isInstalled() {
        return existsSync(this.unitPath);
    }

    install(credential, configPath, mode) {
        if (existsSync(this.unitPath)) {
            console.log(`Service already installed: ${this.unitPath}`);
            console.log('To reinstall, run first: node scripts/ws_listener.js uninstall');
            return;
        }

        if (!existsSync(this.unitDir)) {
            mkdirSync(this.unitDir, { recursive: true });
        }
        const logs = this._ensureLogDir();

        const unitContent = this._generateUnit(credential, configPath, mode, logs);
        writeFileSync(this.unitPath, unitContent, 'utf-8');
        console.log(`Unit file written to: ${this.unitPath}`);

        try {
            execSync('systemctl --user daemon-reload');
            execSync(`systemctl --user enable --now ${this.unitName}`);
            console.log('Service installed and started');
            console.log(`  Logs: journalctl --user -u ${this.unitName} -f`);
            console.log(`  File logs: tail -f ${join(logs, 'stderr.log')}`);
        } catch (error) {
            console.log(`systemctl enable --now failed: ${error.stderr}`);
        }
    }

    uninstall() {
        if (!existsSync(this.unitPath)) {
            console.log('Service not installed');
            return;
        }
        try {
            execSync(`systemctl --user disable --now ${this.unitName}`);
        } catch (error) {
            console.log(`systemctl disable warning: ${error.stderr}`);
        }
        unlinkSync(this.unitPath);
        try {
            execSync('systemctl --user daemon-reload');
        } catch (error) {
            // Ignore
        }
        console.log('Service uninstalled');
    }

    start() {
        if (!existsSync(this.unitPath)) {
            console.log('Service not installed, run first: node scripts/ws_listener.js install');
            return;
        }
        try {
            execSync(`systemctl --user start ${this.unitName}`);
            console.log('Service started');
        } catch (error) {
            console.log(`Start failed: ${error.stderr}`);
        }
    }

    stop() {
        if (!existsSync(this.unitPath)) {
            console.log('Service not installed');
            return;
        }
        try {
            execSync(`systemctl --user stop ${this.unitName}`);
            console.log('Service stopped');
        } catch (error) {
            console.log(`Stop failed: ${error.stderr}`);
        }
    }

    status() {
        const output = {
            platform: 'Linux (systemd)',
            installed: existsSync(this.unitPath),
            service_file: this.unitPath
        };
        if (existsSync(this.unitPath)) {
            try {
                const result = execSync(`systemctl --user is-active ${this.unitName}`, { encoding: 'utf-8' });
                output.running = result.trim() === 'active';
                output.state = result.trim();
            } catch (error) {
                output.running = false;
            }
        } else {
            output.running = false;
        }
        return output;
    }

    _generateUnit(credential, configPath, mode, logs) {
        const runArgs = this._buildRunArgs(credential, configPath, mode);
        const execStart = runArgs.join(' ');
        return `[Unit]
Description=awiki WebSocket Listener
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=${execStart}
WorkingDirectory=${PROJECT_ROOT}
Restart=on-failure
RestartSec=10
StandardOutput=append:${join(logs, 'stdout.log')}
StandardError=append:${join(logs, 'stderr.log')}

[Install]
WantedBy=default.target
`;
    }
}

// Windows service manager
class WindowsServiceManager extends ServiceManager {
    constructor() {
        super();
        this.taskName = 'awiki-ws-listener';
        const localApp = process.env.LOCALAPPDATA || join(process.env.HOME, 'AppData', 'Local');
        this.appDir = join(localApp, 'awiki-ws-listener');
        this.batPath = join(this.appDir, 'run-listener.bat');
    }

    logDir() {
        return join(this.appDir, 'logs');
    }

    isInstalled() {
        try {
            execSync(`schtasks /Query /TN ${this.taskName}`);
            return true;
        } catch (error) {
            return false;
        }
    }

    install(credential, configPath, mode) {
        if (this.isInstalled()) {
            console.log(`Task '${this.taskName}' already exists in Task Scheduler`);
            console.log('To reinstall, run first: node scripts/ws_listener.js uninstall');
            return;
        }

        if (!existsSync(this.appDir)) {
            mkdirSync(this.appDir, { recursive: true });
        }
        const logs = this._ensureLogDir();

        const batContent = this._generateBat(credential, configPath, mode, logs);
        writeFileSync(this.batPath, batContent, 'utf-8');
        console.log(`Batch file written to: ${this.batPath}`);

        try {
            execSync(`schtasks /Create /TN ${this.taskName} /TR "${this.batPath}" /SC ONLOGON /RL LIMITED /F`);
            console.log('Scheduled task created');

            try {
                execSync(`schtasks /Run /TN ${this.taskName}`);
                console.log('Service installed and started');
            } catch (error) {
                console.log('Task created but start failed');
            }

            console.log(`  Logs: ${logs}`);
        } catch (error) {
            console.log(`schtasks /Create failed: ${error.stderr}`);
        }
    }

    uninstall() {
        if (!this.isInstalled()) {
            console.log('Service not installed');
            return;
        }
        try {
            execSync(`schtasks /End /TN ${this.taskName}`);
        } catch (error) {
            // Ignore
        }
        try {
            execSync(`schtasks /Delete /TN ${this.taskName} /F`);
            console.log('Scheduled task removed');
        } catch (error) {
            console.log(`schtasks /Delete warning: ${error.stderr}`);
        }

        if (existsSync(this.batPath)) {
            unlinkSync(this.batPath);
        }
        console.log('Service uninstalled');
    }

    start() {
        if (!this.isInstalled()) {
            console.log('Service not installed, run first: node scripts/ws_listener.js install');
            return;
        }
        try {
            execSync(`schtasks /Run /TN ${this.taskName}`);
            console.log('Service started');
        } catch (error) {
            console.log(`Start failed: ${error.stderr}`);
        }
    }

    stop() {
        if (!this.isInstalled()) {
            console.log('Service not installed');
            return;
        }
        try {
            execSync(`schtasks /End /TN ${this.taskName}`);
            console.log('Service stopped');
        } catch (error) {
            console.log(`Stop failed: ${error.stderr}`);
        }
    }

    status() {
        const installed = this.isInstalled();
        const output = {
            platform: 'Windows (Task Scheduler)',
            installed: installed,
            task_name: this.taskName
        };
        if (installed) {
            try {
                const result = execSync(`schtasks /Query /TN ${this.taskName} /FO LIST /V`, { encoding: 'utf-8' });
                output.running = result.includes('Running');
                output.details = result.trim();
            } catch (error) {
                output.running = false;
            }
        } else {
            output.running = false;
        }
        return output;
    }

    _generateBat(credential, configPath, mode, logs) {
        const runArgs = this._buildRunArgs(credential, configPath, mode);
        const cmdLine = runArgs.map(a => `"${a}"`).join(' ');
        return `@echo off
REM awiki WebSocket Listener — auto-generated, do not edit manually
cd /d "${PROJECT_ROOT}"
${cmdLine} >> "${join(logs, 'stdout.log')}" 2>> "${join(logs, 'stderr.log')}"
`;
    }
}

// Main CLI
const args = parseArgs({
    options: {
        credential: { type: 'string', default: 'default' },
        config: { type: 'string' },
        mode: { type: 'string' }
    },
    allowPositionals: true
});

const command = args.positionals[0];
const manager = getServiceManager();

switch (command) {
    case 'install':
        manager.install(args.values.credential, args.values.config, args.values.mode);
        break;
    case 'uninstall':
        manager.uninstall();
        break;
    case 'start':
        manager.start();
        break;
    case 'stop':
        manager.stop();
        break;
    case 'status':
        const status = manager.status();
        console.log(JSON.stringify(status, null, 2));
        break;
    default:
        console.error('Usage: node scripts/service_manager.js <install|uninstall|start|stop|status> [--credential <name>] [--config <path>] [--mode <mode>]');
        process.exit(1);
}
