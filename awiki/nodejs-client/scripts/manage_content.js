#!/usr/bin/env node

/**
 * Manage Content Pages (create, update, rename, delete, list, get).
 * 
 * Compatible with Python's manage_content.py.
 * 
 * Publish custom Markdown documents accessible via https://{handle}.awiki.ai/content/{slug}.md
 * 
 * Usage:
 *   node scripts/manage_content.js --create --slug jd --title "JD" --body "..."
 *   node scripts/manage_content.js --list
 *   node scripts/manage_content.js --get --slug jd
 *   node scripts/manage_content.js --update --slug jd --title "Updated"
 *   node scripts/manage_content.js --rename --slug jd --new-slug hiring
 *   node scripts/manage_content.js --delete --slug jd
 */

import { loadIdentity } from '../src/credential_store.js';
import { createSDKConfig } from '../src/utils/config.js';
import { createUserServiceClient } from '../src/utils/client.js';
import { authenticatedRpcCall } from '../src/utils/rpc.js';
import { readFileSync } from 'fs';

const CONTENT_RPC = '/content/rpc';

/**
 * Create a content page.
 */
async function createPage({ slug, title, body, visibility = 'public' }, credentialName = 'default') {
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
            CONTENT_RPC,
            'create',
            { slug, title, body, visibility },
            1,
            { auth: null, credentialName }
        );
        
        console.log('Page created:');
        console.log(JSON.stringify({
            status: 'ok',
            action: 'created',
            page: result
        }, null, 2));
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
 * Update a content page.
 */
async function updatePage({ slug, title, body, visibility }, credentialName = 'default') {
    const config = createSDKConfig();
    const cred = loadIdentity(credentialName);
    
    if (!cred) {
        console.error(`Credential '${credentialName}' not found`);
        process.exit(1);
    }
    
    const params = { slug };
    if (title !== undefined) params.title = title;
    if (body !== undefined) params.body = body;
    if (visibility !== undefined) params.visibility = visibility;
    
    if (Object.keys(params).length <= 1) {
        console.error('Error: No fields to update');
        console.error('Specify --title, --body, --visibility, or --body-file');
        process.exit(1);
    }
    
    const client = createUserServiceClient(config);
    
    try {
        const method = 'update';
        const result = await authenticatedRpcCall(
            client,
            CONTENT_RPC,
            method,
            params,
            1,
            { auth: null, credentialName }
        );
        
        console.log('Page updated:');
        console.log(JSON.stringify({
            status: 'ok',
            action: 'updated',
            page: result
        }, null, 2));
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
 * Rename a content page slug.
 */
async function renamePage(slug, newSlug, credentialName = 'default') {
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
            CONTENT_RPC,
            'rename',
            { slug, new_slug: newSlug },
            1,
            { auth: null, credentialName }
        );
        
        console.log('Page renamed:');
        console.log(JSON.stringify({
            status: 'ok',
            action: 'renamed',
            page: result
        }, null, 2));
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
 * Delete a content page.
 */
async function deletePage(slug, credentialName = 'default') {
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
            CONTENT_RPC,
            'delete',
            { slug },
            1,
            { auth: null, credentialName }
        );
        
        console.log('Page deleted:');
        console.log(JSON.stringify({
            status: 'ok',
            action: 'deleted',
            page: result
        }, null, 2));
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
 * List all content pages.
 */
async function listPages(credentialName = 'default') {
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
            CONTENT_RPC,
            'listContents',
            {},
            1,
            { auth: null, credentialName }
        );
        
        console.log('Content pages:');
        console.log(JSON.stringify({
            status: 'ok',
            pages: result
        }, null, 2));
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
 * Get a specific content page.
 */
async function getPage(slug, credentialName = 'default') {
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
            CONTENT_RPC,
            'getContent',
            { slug },
            1,
            { auth: null, credentialName }
        );
        
        console.log('Content page:');
        console.log(JSON.stringify({
            status: 'ok',
            page: result
        }, null, 2));
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
        credential: 'default',
        visibility: 'public'
    };
    
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--create':
                result.create = true;
                break;
            case '--slug':
                result.slug = args[++i];
                break;
            case '--title':
                result.title = args[++i];
                break;
            case '--body':
                result.body = args[++i];
                break;
            case '--body-file':
                result.bodyFile = args[++i];
                break;
            case '--visibility':
                result.visibility = args[++i];
                break;
            case '--list':
                result.list = true;
                break;
            case '--get':
                result.get = true;
                break;
            case '--update':
                result.update = true;
                break;
            case '--rename':
                result.rename = true;
                break;
            case '--new-slug':
                result.newSlug = args[++i];
                break;
            case '--delete':
                result.delete = true;
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
Manage Content Pages (create, update, rename, delete, list, get).

Publish custom Markdown documents accessible via https://{handle}.awiki.ai/content/{slug}.md

Usage:
  node scripts/manage_content.js [options]

Options:
  --create                 Create a content page
  --slug <slug>            Page slug (required for most operations)
  --title <title>          Page title
  --body <body>            Page body (Markdown)
  --body-file <file>       Read body from a file
  --visibility <vis>       Visibility: public, draft, unlisted (default: public)
  --list                   List all content pages
  --get                    Get a specific content page
  --update                 Update a content page
  --rename                 Rename a content page slug
  --new-slug <slug>        New slug (required for --rename)
  --delete                 Delete a content page
  --credential <name>      Credential name (default: default)
  --help, -h               Show this help message

Examples:
  node scripts/manage_content.js --create --slug jd --title "JD" --body "# Hiring"
  node scripts/manage_content.js --list
  node scripts/manage_content.js --get --slug jd
  node scripts/manage_content.js --update --slug jd --title "Updated JD"
  node scripts/manage_content.js --rename --slug jd --new-slug hiring
  node scripts/manage_content.js --delete --slug jd
  node scripts/manage_content.js --create --slug event --body-file ./event.md
`);
}

// Main
const options = parseArgs();

// Read body from file if specified
if (options.bodyFile) {
    try {
        options.body = readFileSync(options.bodyFile, 'utf-8');
    } catch (error) {
        console.error(`Error reading file: ${error.message}`);
        process.exit(1);
    }
}

if (options.create) {
    if (!options.slug || !options.title) {
        console.error('Error: --slug and --title are required for --create');
        process.exit(1);
    }
    if (!options.body) {
        console.error('Error: --body or --body-file is required for --create');
        process.exit(1);
    }
    await createPage({
        slug: options.slug,
        title: options.title,
        body: options.body,
        visibility: options.visibility
    }, options.credential);
} else if (options.list) {
    await listPages(options.credential);
} else if (options.get) {
    if (!options.slug) {
        console.error('Error: --slug is required for --get');
        process.exit(1);
    }
    await getPage(options.slug, options.credential);
} else if (options.update) {
    if (!options.slug) {
        console.error('Error: --slug is required for --update');
        process.exit(1);
    }
    await updatePage({
        slug: options.slug,
        title: options.title,
        body: options.body,
        visibility: options.visibility
    }, options.credential);
} else if (options.rename) {
    if (!options.slug || !options.newSlug) {
        console.error('Error: --slug and --new-slug are required for --rename');
        process.exit(1);
    }
    await renamePage(options.slug, options.newSlug, options.credential);
} else if (options.delete) {
    if (!options.slug) {
        console.error('Error: --slug is required for --delete');
        process.exit(1);
    }
    await deletePage(options.slug, options.credential);
} else {
    console.error('Error: Please specify an action (--create, --list, --get, --update, --rename, or --delete)');
    printUsage();
    process.exit(1);
}
