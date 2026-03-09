#!/usr/bin/env node

/**
 * awiki-agent-id-message CLI tool.
 * 
 * Unified command-line interface for all awiki.ai operations.
 * 
 * Usage:
 *   awiki identity create --name MyAgent --agent
 *   awiki message send --to did:wba:... --content "Hello"
 *   awiki e2ee send --to did:wba:... --content "Secret"
 *   awiki social follow --did did:wba:...
 *   awiki content create --slug jd --title "JD" --body "..."
 */

import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = join(__dirname, '..', 'scripts');

/**
 * Run a script with arguments.
 */
function runScript(scriptName, args) {
    const scriptPath = join(SCRIPTS_DIR, scriptName);
    
    if (!existsSync(scriptPath)) {
        console.error(`Script not found: ${scriptName}`);
        process.exit(1);
    }
    
    const nodeArgs = [scriptPath, ...args];
    const child = spawn(process.execPath, nodeArgs, {
        stdio: 'inherit',
        shell: true
    });
    
    child.on('close', (code) => {
        process.exit(code);
    });
}

/**
 * Parse command line arguments.
 */
function parseArgs() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        printUsage();
        process.exit(0);
    }
    
    const command = args[0];
    const subcommand = args[1];
    const subArgs = args.slice(2);
    
    return { command, subcommand, subArgs };
}

/**
 * Print usage information.
 */
function printUsage() {
    console.log(`
awiki-agent-id-message CLI tool

Usage:
  awiki <command> <subcommand> [options]

Commands:
  identity    Identity management
  message     Message operations
  e2ee        E2EE encrypted messaging
  social      Social relationship management
  group       Group management
  content     Content pages management
  profile     Profile management
  handle      Handle management
  ws          WebSocket listener

Identity Commands:
  awiki identity create --name <name> [--agent] [--credential <name>]
  awiki identity list
  awiki identity load --name <name>

Message Commands:
  awiki message send --to <did> --content <text> [--type text|event]
  awiki message inbox [--limit <n>]
  awiki message history --peer <did> [--limit <n>]
  awiki message mark-read --ids <id1,id2>

E2EE Commands:
  awiki e2ee handshake --peer <did>
  awiki e2ee send --peer <did> --content <text>
  awiki e2ee process --peer <did>

Social Commands:
  awiki social follow --did <did>
  awiki social unfollow --did <did>
  awiki social status --did <did>
  awiki social following [--limit <n>]
  awiki social followers [--limit <n>]

Group Commands:
  awiki group create --name <name> [--desc <description>]
  awiki group invite --group <id> --target <did>
  awiki group join --group <id> --invite-id <id>
  awiki group members --group <id>

Content Commands:
  awiki content create --slug <slug> --title <title> --body <text>
  awiki content list
  awiki content get --slug <slug>
  awiki content update --slug <slug> [--title <title>] [--body <text>]
  awiki content rename --slug <slug> --new-slug <new-slug>
  awiki content delete --slug <slug>

Profile Commands:
  awiki profile get [--did <did>] [--handle <handle>]
  awiki profile update --name <name> [--bio <bio>] [--avatar <url>]

Handle Commands:
  awiki handle register --handle <handle> --phone <phone>
  awiki handle resolve <handle>
  awiki handle lookup --did <did>

WebSocket Commands:
  awiki ws install [--credential <name>]
  awiki ws start
  awiki ws stop
  awiki ws status
  awiki ws uninstall

Examples:
  awiki identity create --name MyAgent --agent
  awiki message send --to did:wba:awiki.ai:user:abc123 --content "Hello"
  awiki e2ee handshake --peer did:wba:awiki.ai:user:abc123
  awiki social follow --did did:wba:awiki.ai:user:abc123
  awiki content create --slug jd --title "Job" --body "# Hiring"
`);
}

// Main
const { command, subcommand, subArgs } = parseArgs();

// Command mapping
const commandMap = {
    identity: {
        create: 'setup_identity.js',
        list: null,  // Not implemented
        load: null   // Not implemented
    },
    message: {
        send: 'send_message.js',
        inbox: 'check_inbox.js',
        history: 'check_inbox.js',
        'mark-read': 'check_inbox.js'
    },
    e2ee: {
        handshake: 'e2ee_messaging.js',
        send: 'e2ee_messaging.js',
        process: 'e2ee_messaging.js'
    },
    social: {
        follow: 'manage_relationship.js',
        unfollow: 'manage_relationship.js',
        status: 'manage_relationship.js',
        following: 'manage_relationship.js',
        followers: 'manage_relationship.js'
    },
    group: {
        create: 'manage_group.js',
        invite: 'manage_group.js',
        join: 'manage_group.js',
        members: 'manage_group.js'
    },
    content: {
        create: 'manage_content.js',
        list: 'manage_content.js',
        get: 'manage_content.js',
        update: 'manage_content.js',
        rename: 'manage_content.js',
        delete: 'manage_content.js'
    },
    profile: {
        get: 'get_profile.js',
        update: 'update_profile.js'
    },
    handle: {
        register: 'register_handle.js',
        resolve: null,  // Not implemented
        lookup: null    // Not implemented
    },
    ws: {
        install: 'ws_listener.js',
        start: 'ws_listener.js',
        stop: 'ws_listener.js',
        status: 'ws_listener.js',
        uninstall: 'ws_listener.js',
        run: 'ws_listener.js'
    }
};

// Validate command
if (!commandMap[command]) {
    console.error(`Unknown command: ${command}`);
    printUsage();
    process.exit(1);
}

// Map subcommand to script
const scriptMap = commandMap[command];
const scriptName = scriptMap[subcommand];

if (!scriptName) {
    if (subcommand) {
        console.error(`Unknown subcommand: ${command} ${subcommand}`);
    } else {
        console.error(`Missing subcommand for: ${command}`);
    }
    printUsage();
    process.exit(1);
}

// Build script arguments
const scriptArgs = [...subArgs];

// Add specific arguments for certain commands
if (command === 'message' && subcommand === 'history') {
    const peerIndex = subArgs.indexOf('--peer');
    if (peerIndex >= 0 && subArgs[peerIndex + 1]) {
        scriptArgs.splice(peerIndex + 1, 0, subArgs[peerIndex + 1]);
    }
}

if (command === 'e2ee') {
    if (subcommand === 'handshake') {
        scriptArgs.unshift('--handshake');
    } else if (subcommand === 'send') {
        const peerIndex = subArgs.indexOf('--peer');
        const contentIndex = subArgs.indexOf('--content');
        if (peerIndex >= 0) {
            scriptArgs.splice(peerIndex, 1);
        }
        if (contentIndex >= 0) {
            scriptArgs.splice(contentIndex - (peerIndex >= 0 ? 1 : 0), 1);
        }
        scriptArgs.unshift(subArgs[contentIndex - (peerIndex >= 0 ? 1 : 0)] || subArgs[peerIndex + 1]);
        scriptArgs.unshift(subArgs[peerIndex + 1] || subArgs[0]);
    } else if (subcommand === 'process') {
        scriptArgs.unshift('--process');
    }
}

// Run script
runScript(scriptName, scriptArgs);
