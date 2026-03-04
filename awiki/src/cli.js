#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { AgentIdentityService } from './index.js';
import { MoltxTransport, MQTTTransport } from './messaging/index.js';

const DEFAULT_CONFIG = {
  userServiceUrl: process.env.E2E_USER_SERVICE_URL || 'https://awiki.ai',
  moltMessageUrl: process.env.E2E_MOLT_MESSAGE_URL || 'https://awiki.ai',
  domain: process.env.E2E_DID_DOMAIN || 'awiki.ai',
  credentialsDir: process.env.CREDENTIALS_DIR || './.credentials'
};

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .command('create <name>', 'Create a new DID identity', (yargs) => {
      return yargs
        .positional('name', { describe: 'Agent name', type: 'string' })
        .option('credential', { alias: 'c', default: 'default', describe: 'Credential name' })
        .option('method', { alias: 'm', default: 'wba', describe: 'DID method: wba, key, ethr', choices: ['wba', 'key', 'ethr'] })
        .option('domain', { describe: 'Custom domain for WBA (e.g. raw.githubusercontent.com)' })
        .option('output', { alias: 'o', describe: 'Output path for DID document (e.g. did.json)' });
    }, async (argv) => {
      const config = { ...DEFAULT_CONFIG };
      if (argv.domain) config.domain = argv.domain;
      
      const service = new AgentIdentityService(config);
      try {
        const identity = await service.identityManager.createIdentity(argv.name, argv.credential, argv.method);
        const result = {
          status: 'success',
          did: identity.did,
          method: identity.method,
          name: identity.name,
          createdAt: identity.createdAt,
          doc: identity.didDocument
        };
        
        if (argv.output) {
          fs.writeFileSync(argv.output, JSON.stringify(identity.didDocument, null, 2));
          result.saved_to = argv.output;
        } else if (argv.domain) {
           // Auto-save suggestion
           const filename = `${identity.name}_did.json`;
           fs.writeFileSync(filename, JSON.stringify(identity.didDocument, null, 2));
           result.saved_to = filename;
        }
        
        if (argv.domain && (argv.domain.includes('github.io') || argv.domain.includes('pages.dev') || argv.domain.includes('codeberg.page'))) {
           // Helper for GH Pages structure
           const path = identity.did.split(':').slice(3).join('/'); // did:wba:domain:user:name -> user/name
           result.pages_help = `To host this on Pages (${argv.domain}):\n` +
             `1. Ensure file is at: ${path}/did.json\n` +
             `2. Content: The 'doc' JSON object (saved to ${result.saved_to})\n` +
             `3. Push to your repository.`;
        }
        
        console.log(JSON.stringify(result, null, 2));
      } catch (error) {
        console.error(JSON.stringify({ status: 'error', error: error.message }));
        process.exit(1);
      }
    })
    .command('list', 'List all saved identities', {}, async () => {
      const service = new AgentIdentityService(DEFAULT_CONFIG);
      try {
        const identities = service.listIdentities();
        console.log(JSON.stringify({ status: 'success', identities }, null, 2));
      } catch (error) {
        console.error(JSON.stringify({ status: 'error', error: error.message }));
      }
    })
    .command('load [credential]', 'Load an identity and refresh JWT', (yargs) => {
      return yargs
        .positional('credential', { default: 'default' });
    }, async (argv) => {
      const service = new AgentIdentityService(DEFAULT_CONFIG);
      try {
        const identity = await service.refreshJwt(argv.credential);
        console.log(JSON.stringify({
          status: 'success',
          did: identity.did,
          jwt: identity.jwt ? 'refreshed' : 'none'
        }, null, 2));
      } catch (error) {
        console.error(JSON.stringify({ status: 'error', error: error.message }));
      }
    })
    .command('send <to> <content>', 'Send a message', (yargs) => {
      return yargs
        .positional('to', { describe: 'Recipient DID' })
        .positional('content', { describe: 'Message content' })
        .option('type', { default: 'text', describe: 'Message type' })
        .option('transport', { default: 'http', describe: 'Transport: http, mqtt, moltx' });
    }, async (argv) => {
      const service = new AgentIdentityService(DEFAULT_CONFIG);
      try {
        service.loadIdentity();
        const result = await service.sendMessage(argv.to, argv.content, { type: argv.type, transport: argv.transport });
        console.log(JSON.stringify({ status: 'success', result }, null, 2));
      } catch (error) {
        console.error(JSON.stringify({ status: 'error', error: error.message }));
      }
    })
    .command('inbox', 'Check inbox', (yargs) => {
      return yargs
        .option('history', { describe: 'Get history with specific DID' })
        .option('mark-read', { array: true, describe: 'Mark messages as read' })
        .option('transport', { default: 'http', describe: 'Transport: http, mqtt, moltx' });
    }, async (argv) => {
      const service = new AgentIdentityService(DEFAULT_CONFIG);
      try {
        service.loadIdentity();

        if (argv.markRead) {
          await service.markAsRead(argv.markRead, { transport: argv.transport });
          console.log(JSON.stringify({ status: 'success', action: 'marked_read' }));
        } else if (argv.history) {
          const messages = await service.checkInbox({ history: argv.history, transport: argv.transport });
          console.log(JSON.stringify({ status: 'success', messages }, null, 2));
        } else {
          const inbox = await service.checkInbox({ transport: argv.transport });
          console.log(JSON.stringify({ status: 'success', inbox }, null, 2));
        }
      } catch (error) {
        console.error(JSON.stringify({ status: 'error', error: error.message }));
      }
    })
    .command('e2ee-init <peer>', 'Initiate E2EE handshake', (yargs) => {
      return yargs.positional('peer', { describe: 'Peer DID' })
                  .option('transport', { default: 'http' });
    }, async (argv) => {
      const service = new AgentIdentityService(DEFAULT_CONFIG);
      try {
        service.loadIdentity();
        // Generate e2ee_init payload
        const msg = await service.initiateE2EE(argv.peer);
        // Send it via transport
        const result = await service.sendMessage(argv.peer, msg.content, { type: msg.type, transport: argv.transport });
        console.log(JSON.stringify({ status: 'success', sent: result, session_id: msg.content.session_id }, null, 2));
      } catch (error) {
        console.error(JSON.stringify({ status: 'error', error: error.message }));
      }
    })
    .command('e2ee-send <peer> <content>', 'Send encrypted message', (yargs) => {
      return yargs
        .positional('peer', { describe: 'Peer DID' })
        .positional('content', { describe: 'Message content' })
        .option('transport', { default: 'http' });
    }, async (argv) => {
      const service = new AgentIdentityService(DEFAULT_CONFIG);
      try {
        service.loadIdentity();
        const encryptedMsg = await service.sendEncrypted(argv.peer, argv.content);
        // sendEncrypted returns payload { type: 'e2ee_msg', content: ... }
        const result = await service.sendMessage(argv.peer, encryptedMsg.content, { type: encryptedMsg.type, transport: argv.transport });
        console.log(JSON.stringify({ status: 'success', action: 'sent', result }, null, 2));
      } catch (error) {
        console.error(JSON.stringify({ status: 'error', error: error.message }));
      }
    })
    .command('e2ee-process', 'Process inbox for E2EE messages', (yargs) => {
      return yargs
        .option('peer', { describe: 'Peer DID to decrypt from' })
        .option('transport', { default: 'http' });
    }, async (argv) => {
      const service = new AgentIdentityService(DEFAULT_CONFIG);
      try {
        service.loadIdentity();
        const inbox = await service.checkInbox({ transport: argv.transport });
        // Process messages
        // We need a method to process raw inbox messages
        // E2EEClient.processMessage(msg)
        // If peer provided, filter by peer
        
        const processed = [];
        const messages = inbox.messages || (Array.isArray(inbox) ? inbox : []);
        
        for (const msg of messages) {
           // msg has type, content, sender_did
           // if type starts with e2ee_, process it
           if (msg.type && msg.type.startsWith('e2ee_')) {
             try {
               const content = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
               // If it's encrypted msg, decrypt it
               if (msg.type === 'e2ee_msg') {
                 if (argv.peer && msg.sender_did !== argv.peer) continue;
                 const decrypted = service.e2ee.decryptMessage(content);
                 processed.push({ ...msg, decrypted_content: decrypted.plaintext, decrypted_type: decrypted.type });
               } else {
                 // init/rekey etc.
                 // We don't have process logic fully implemented in E2EEClient yet (mocked)
                 // But in real Python code, it updates session state.
                 // service.e2ee.processMessage(msg.type, content);
                 processed.push({ ...msg, status: 'processed_protocol_msg' });
               }
             } catch (e) {
               processed.push({ ...msg, error: e.message });
             }
           }
        }
        console.log(JSON.stringify({ status: 'success', processed }, null, 2));
        
        // Mark read?
        // if (processed.length > 0 && argv.transport === 'http') {
        //   await service.markAsRead(processed.map(m => m.id));
        // }
      } catch (error) {
         console.error(JSON.stringify({ status: 'error', error: error.message }));
      }
    })
    .demandCommand(1, 'You need to specify a command')
    .help()
    .alias('help', 'h')
    .argv;
}

main().catch(console.error);
