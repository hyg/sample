#!/usr/bin/env node

/**
 * Group management (create, invite, join, members).
 * 
 * Compatible with Python's manage_group.py.
 * 
 * Usage:
 *   node scripts/manage_group.js --create --name "My Group" --desc "Description"
 *   node scripts/manage_group.js --invite --group GID --target did:wba:...
 *   node scripts/manage_group.js --join --group GID --invite IID
 *   node scripts/manage_group.js --members --group GID
 */


const RPC_ENDPOINT = '/user-service/did/relationships/rpc';

/**
 * Create a group.
 */
async function createGroup(groupName, description = '', credentialName = 'default') {
    const config = createSDKConfig();
    const cred = loadIdentity(credentialName);
    
    if (!cred) {
        console.error(`Credential '${credentialName}' not found`);
        process.exit(1);
    }
    
    const client = createUserServiceClient(config);
    
    try {
        const result = await authenticatedRpcCall(
            client,
            RPC_ENDPOINT,
            'createGroup',
            { group_name: groupName, description },
            1,
            { auth: null, credentialName }
        );
        
        console.log('Group created:');
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response:', JSON.stringify(error.response.data, null, 2));
        }
        process.exit(1);
    } finally {
        client.close();
    }
}

/**
 * Invite a user to a group.
 */
async function inviteToGroup(groupId, targetDid, credentialName = 'default') {
    const config = createSDKConfig();
    const cred = loadIdentity(credentialName);
    
    if (!cred) {
        console.error(`Credential '${credentialName}' not found`);
        process.exit(1);
    }
    
    const client = createUserServiceClient(config);
    
    try {
        const result = await authenticatedRpcCall(
            client,
            RPC_ENDPOINT,
            'inviteToGroup',
            { group_id: groupId, target_did: targetDid },
            1,
            { auth: null, credentialName }
        );
        
        console.log('Invite sent:');
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response:', JSON.stringify(error.response.data, null, 2));
        }
        process.exit(1);
    } finally {
        client.close();
    }
}

/**
 * Join a group with an invite.
 */
async function joinGroup(groupId, inviteId, credentialName = 'default') {
    const config = createSDKConfig();
    const cred = loadIdentity(credentialName);
    
    if (!cred) {
        console.error(`Credential '${credentialName}' not found`);
        process.exit(1);
    }
    
    const client = createUserServiceClient(config);
    
    try {
        const result = await authenticatedRpcCall(
            client,
            RPC_ENDPOINT,
            'joinGroup',
            { group_id: groupId, invite_id: inviteId },
            1,
            { auth: null, credentialName }
        );
        
        console.log('Joined group:');
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response:', JSON.stringify(error.response.data, null, 2));
        }
        process.exit(1);
    } finally {
        client.close();
    }
}

/**
 * Get group members list.
 */
async function getGroupMembers(groupId, credentialName = 'default') {
    const config = createSDKConfig();
    const cred = loadIdentity(credentialName);
    
    if (!cred) {
        console.error(`Credential '${credentialName}' not found`);
        process.exit(1);
    }
    
    const client = createUserServiceClient(config);
    
    try {
        const result = await authenticatedRpcCall(
            client,
            RPC_ENDPOINT,
            'getGroupMembers',
            { group_id: groupId },
            1,
            { auth: null, credentialName }
        );
        
        console.log('Group members:');
        console.log(JSON.stringify(result, null, 2));
        
        if (result.members && result.members.length > 0) {
            console.log(`\nTotal: ${result.total || result.members.length} member(s)`);
        }
    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response:', JSON.stringify(error.response.data, null, 2));
        }
        process.exit(1);
    } finally {
        client.close();
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
    
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--create':
                result.create = true;
                break;
            case '--name':
                result.name = args[++i];
                break;
            case '--desc':
                result.description = args[++i];
                break;
            case '--invite':
                result.invite = true;
                break;
            case '--group':
                result.group = args[++i];
                break;
            case '--target':
                result.target = args[++i];
                break;
            case '--join':
                result.join = true;
                break;
            case '--invite-id':
                result.inviteId = args[++i];
                break;
            case '--members':
                result.members = true;
                break;
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
Group management (create, invite, join, members).

Usage:
  node scripts/manage_group.js [options]

Options:
  --create                 Create a new group
  --name <name>            Group name (required for --create)
  --desc <description>     Group description (optional for --create)
  --invite                 Invite a user to a group
  --group <id>             Group ID (required for --invite, --join, --members)
  --target <did>           Target DID to invite (required for --invite)
  --join                   Join a group with an invite
  --invite-id <id>         Invite ID (required for --join)
  --members                Get group members list
  --credential <name>      Credential name (default: default)
  --help, -h               Show this help message

Examples:
  node scripts/manage_group.js --create --name "My Group" --desc "Description"
  node scripts/manage_group.js --invite --group GID --target did:wba:...
  node scripts/manage_group.js --join --group GID --invite-id IID
  node scripts/manage_group.js --members --group GID
`);
}

// Main
const options = parseArgs();

if (options.create) {
    if (!options.name) {
        console.error('Error: --name is required for --create');
        process.exit(1);
    }
    await createGroup(options.name, options.description || '', options.credential);
} else if (options.invite) {
    if (!options.group || !options.target) {
        console.error('Error: --group and --target are required for --invite');
        process.exit(1);
    }
    await inviteToGroup(options.group, options.target, options.credential);
} else if (options.join) {
    if (!options.group || !options.inviteId) {
        console.error('Error: --group and --invite-id are required for --join');
        process.exit(1);
    }
    await joinGroup(options.group, options.inviteId, options.credential);
} else if (options.members) {
    if (!options.group) {
        console.error('Error: --group is required for --members');
        process.exit(1);
    }
    await getGroupMembers(options.group, options.credential);
} else {
    console.error('Error: Please specify an action (--create, --invite, --join, or --members)');
    printUsage();
    process.exit(1);
}
