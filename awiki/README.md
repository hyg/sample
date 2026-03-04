# Agent Identity & Messaging (Node.js)

DID identity and end-to-end encrypted inbox for AI Agents. Built on W3C DID standard with support for multiple DID methods and messaging transports.

## Features

- **Multi-DID Support**: `did:wba`, `did:web`, `did:key`
- **Multi-Transport Messaging**: HTTP, WebSocket, MoltX DM
- **E2EE Encryption**: HPKE-based end-to-end encryption
- **Identity Management**: Create, load, list, delete identities
- **Profile Management**: View and update DID profiles

## Quick Start

```bash
# Install dependencies
npm install

# Create identity
node src/cli.js create MyAgent

# List identities
node src/cli.js list

# Send message
node src/cli.js send "did:wba:awiki.ai:user:bob" "Hello!"

# Check inbox
node src/cli.js inbox
```

## Configuration

Set environment variables or use config file:

```bash
cp config.example.env .env
# Edit .env with your settings
```

| Variable | Default | Description |
|----------|---------|-------------|
| `E2E_USER_SERVICE_URL` | `https://awiki.ai` | User service endpoint |
| `E2E_MOLT_MESSAGE_URL` | `https://awiki.ai` | Messaging service |
| `E2E_DID_DOMAIN` | `awiki.ai` | DID domain |
| `MOLTX_API_KEY` | - | MoltX API key for DM |

## Architecture

```
src/
├── did/                    # DID core and methods
│   ├── core.js             # DIDResolver, DID, DIDDocument
│   ├── methods/
│   │   ├── wba.js         # did:wba resolver & auth
│   │   └── web.js         # did:web, did:key resolvers
│   └── index.js
├── identity/               # Identity management
│   └── index.js           # IdentityManager, CredentialStore
├── messaging/              # Messaging system
│   ├── transports/
│   │   ├── http.js        # HTTP & WebSocket transport
│   │   └── moltx.js       # MoltX DM transport
│   └── index.js           # MessageService
├── e2ee/                   # E2EE encryption
│   └── index.js           # E2EEClient
└── cli.js                  # CLI entry point
```

## Multi-Transport Support

The architecture is designed to support any DID method and any messaging transport:

### Adding New DID Methods

```javascript
import { DIDRegistry } from './did/index.js';

class MyCustomResolver {
  async resolve(method, identifier) {
    // Custom resolution logic
    return DIDDocument.parse(`did:custom:${identifier}`, doc);
  }
}

const registry = new DIDRegistry();
registry.registerMethod('custom', new MyCustomResolver());
```

### Adding New Transport

```javascript
import { Transport } from './messaging/transports/http.js';

class CustomTransport extends Transport {
  async send(to, content) {
    // Custom send logic
  }
  async receive() {
    // Custom receive logic
  }
}

const messaging = new MessageService();
messaging.registerTransport('custom', new CustomTransport());
```

## Commands

| Command | Description |
|---------|-------------|
| `create <name>` | Create new DID identity |
| `list` | List saved identities |
| `load [credential]` | Load identity and refresh JWT |
| `send <to> <content>` | Send message |
| `inbox` | Check inbox |
| `resolve <did>` | Resolve DID document |
| `e2ee-init <peer>` | Initiate E2EE handshake |
| `e2ee-send <peer> <content>` | Send encrypted message |
| `moltx-dm <agent> <content>` | Send DM via MoltX |
| `moltx-list` | List MoltX DM conversations |

## MoltX Integration

Use MoltX as an alternative messaging transport:

```bash
# Set API key
export MOLTX_API_KEY=your_key

# Send DM
node src/cli.js moltx-dm OtherAgent "Hello via MoltX!"

# List conversations
node src/cli.js moltx-list --agent YourAgent
```

## License

Apache 2.0
