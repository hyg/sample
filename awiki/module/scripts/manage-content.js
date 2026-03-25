/**
 * Manage Content Pages (create, update, rename, delete, list, get).
 *
 * Publish custom Markdown documents (job postings, event pages, etc.)
 * accessible via https://{handle}.{domain}/content/{slug}.md.
 *
 * Python 源文件：python/scripts/manage_content.py
 * 分析报告：doc/scripts/manage_content.py/py.md
 * 蒸馏数据：doc/scripts/manage_content.py/py.json
 *
 * Usage:
 *   // Create a content page
 *   await create_page('default', 'jd', 'Job Description', '# We are hiring\n\n...', 'public');
 *
 *   // Create a draft page
 *   await create_page('default', 'draft-post', 'Draft', 'WIP', 'draft');
 *
 *   // List all content pages
 *   await list_pages('default');
 *
 *   // Get a specific content page
 *   await get_page('default', 'jd');
 *
 *   // Update a content page
 *   await update_page('default', 'jd', 'Updated Title', 'New content', null);
 *
 *   // Rename a slug
 *   await rename_page('default', 'jd', 'hiring');
 *
 *   // Delete a content page
 *   await delete_page('default', 'jd');
 *
 * [INPUT]: SDK (authenticated_rpc_call), credential_store (load identity credentials)
 * [OUTPUT]: Content page CRUD operations results with structured JSON errors
 * [POS]: Content Pages management script
 *
 * [PROTOCOL]:
 * 1. Update this header when logic changes
 * 2. Check the folder's CLAUDE.md after updates
 */

const fs = require('fs');
const path = require('path');
const { SDKConfig } = require('./utils/config');
const { create_user_service_client } = require('./utils/client');
const { authenticated_rpc_call, JsonRpcError } = require('./utils/rpc');
const { create_authenticator } = require('./credential-store');

const CONTENT_RPC = '/content/rpc';

/**
 * Create a content page.
 *
 * Python 原型:
 * async def create_page(
 *     credential_name: str,
 *     slug: str,
 *     title: str,
 *     body: str,
 *     visibility: str = "public",
 * ) -> None:
 *
 * @param {string} credential_name - 凭证名称
 * @param {string} slug - 页面 slug (URL 标识符)
 * @param {string} title - 页面标题
 * @param {string} body - 页面正文 (Markdown 内容)
 * @param {string} [visibility="public"] - 页面可见性 (public/draft/unlisted)
 * @returns {Promise<void>}
 */
async function create_page(credential_name, slug, title, body, visibility = 'public') {
  console.log(`Creating content page credential=${credential_name} slug=${slug} visibility=${visibility}`);
  
  const config = new SDKConfig();
  const auth_result = create_authenticator(credential_name, config);
  
  if (auth_result === null) {
    console.log(JSON.stringify({
      status: 'error',
      error: `Credential '${credential_name}' unavailable`,
      hint: 'Create an identity first with setup_identity.py or register_handle.py',
    }, null, 2));
    process.exit(1);
  }

  const [auth, _] = auth_result;
  const params = {
    slug: slug,
    title: title,
    body: body,
    visibility: visibility,
  };

  const client = create_user_service_client(config);
  try {
    const result = await authenticated_rpc_call(
      client, CONTENT_RPC, 'create', params,
      { auth: auth, credentialName: credential_name }
    );
    console.log(JSON.stringify({
      status: 'ok',
      action: 'created',
      page: result,
    }, null, 2));
  } finally {
    // Client cleanup if needed
  }
}

/**
 * Update a content page.
 *
 * Python 原型:
 * async def update_page(
 *     credential_name: str,
 *     slug: str,
 *     title: str | None = None,
 *     body: str | None = None,
 *     visibility: str | None = None,
 * ) -> None:
 *
 * @param {string} credential_name - 凭证名称
 * @param {string} slug - 页面 slug
 * @param {string|null} [title=null] - 页面标题
 * @param {string|null} [body=null] - 页面正文
 * @param {string|null} [visibility=null] - 页面可见性
 * @returns {Promise<void>}
 */
async function update_page(credential_name, slug, title = null, body = null, visibility = null) {
  console.log(`Updating content page credential=${credential_name} slug=${slug}`);
  
  const params = { slug: slug };
  if (title !== null) {
    params.title = title;
  }
  if (body !== null) {
    params.body = body;
  }
  if (visibility !== null) {
    params.visibility = visibility;
  }

  if (Object.keys(params).length <= 1) {
    console.log(JSON.stringify({
      status: 'error',
      error: 'No fields to update',
      hint: 'Specify --title, --body, --visibility, or --body-file',
    }, null, 2));
    process.exit(1);
  }

  const config = new SDKConfig();
  const auth_result = create_authenticator(credential_name, config);
  
  if (auth_result === null) {
    console.log(JSON.stringify({
      status: 'error',
      error: `Credential '${credential_name}' unavailable`,
      hint: 'Create an identity first',
    }, null, 2));
    process.exit(1);
  }

  const [auth, _] = auth_result;
  const client = create_user_service_client(config);
  try {
    const result = await authenticated_rpc_call(
      client, CONTENT_RPC, 'update', params,
      { auth: auth, credentialName: credential_name }
    );
    console.log(JSON.stringify({
      status: 'ok',
      action: 'updated',
      page: result,
    }, null, 2));
  } finally {
    // Client cleanup if needed
  }
}

/**
 * Rename a content page slug.
 *
 * Python 原型:
 * async def rename_page(
 *     credential_name: str,
 *     old_slug: str,
 *     new_slug: str,
 * ) -> None:
 *
 * @param {string} credential_name - 凭证名称
 * @param {string} old_slug - 旧 slug
 * @param {string} new_slug - 新 slug
 * @returns {Promise<void>}
 */
async function rename_page(credential_name, old_slug, new_slug) {
  console.log(`Renaming content page credential=${credential_name} old_slug=${old_slug} new_slug=${new_slug}`);
  
  const config = new SDKConfig();
  const auth_result = create_authenticator(credential_name, config);
  
  if (auth_result === null) {
    console.log(JSON.stringify({
      status: 'error',
      error: `Credential '${credential_name}' unavailable`,
      hint: 'Create an identity first',
    }, null, 2));
    process.exit(1);
  }

  const [auth, _] = auth_result;
  const params = { old_slug: old_slug, new_slug: new_slug };

  const client = create_user_service_client(config);
  try {
    const result = await authenticated_rpc_call(
      client, CONTENT_RPC, 'rename', params,
      { auth: auth, credentialName: credential_name }
    );
    console.log(JSON.stringify({
      status: 'ok',
      action: 'renamed',
      page: result,
    }, null, 2));
  } finally {
    // Client cleanup if needed
  }
}

/**
 * Delete a content page.
 *
 * Python 原型:
 * async def delete_page(credential_name: str, slug: str) -> None:
 *
 * @param {string} credential_name - 凭证名称
 * @param {string} slug - 页面 slug
 * @returns {Promise<void>}
 */
async function delete_page(credential_name, slug) {
  console.log(`Deleting content page credential=${credential_name} slug=${slug}`);
  
  const config = new SDKConfig();
  const auth_result = create_authenticator(credential_name, config);
  
  if (auth_result === null) {
    console.log(JSON.stringify({
      status: 'error',
      error: `Credential '${credential_name}' unavailable`,
      hint: 'Create an identity first',
    }, null, 2));
    process.exit(1);
  }

  const [auth, _] = auth_result;
  const client = create_user_service_client(config);
  try {
    const result = await authenticated_rpc_call(
      client, CONTENT_RPC, 'delete', { slug: slug },
      { auth: auth, credentialName: credential_name }
    );
    console.log(JSON.stringify({
      status: 'ok',
      action: 'deleted',
      result: result,
    }, null, 2));
  } finally {
    // Client cleanup if needed
  }
}

/**
 * List all content pages for the current Handle.
 *
 * Python 原型:
 * async def list_pages(credential_name: str) -> None:
 *
 * @param {string} credential_name - 凭证名称
 * @returns {Promise<void>}
 */
async function list_pages(credential_name) {
  console.log(`Listing content pages credential=${credential_name}`);
  
  const config = new SDKConfig();
  const auth_result = create_authenticator(credential_name, config);
  
  if (auth_result === null) {
    console.log(JSON.stringify({
      status: 'error',
      error: `Credential '${credential_name}' unavailable`,
      hint: 'Create an identity first',
    }, null, 2));
    process.exit(1);
  }

  const [auth, _] = auth_result;
  const client = create_user_service_client(config);
  try {
    const result = await authenticated_rpc_call(
      client, CONTENT_RPC, 'list', {},
      { auth: auth, credentialName: credential_name }
    );
    console.log(JSON.stringify({
      status: 'ok',
      action: 'list',
      pages: result.pages || [],
      count: result.count || 0,
    }, null, 2));
  } finally {
    // Client cleanup if needed
  }
}

/**
 * Get a specific content page with full body.
 *
 * Python 原型:
 * async def get_page(credential_name: str, slug: str) -> None:
 *
 * @param {string} credential_name - 凭证名称
 * @param {string} slug - 页面 slug
 * @returns {Promise<void>}
 */
async function get_page(credential_name, slug) {
  console.log(`Fetching content page credential=${credential_name} slug=${slug}`);
  
  const config = new SDKConfig();
  const auth_result = create_authenticator(credential_name, config);
  
  if (auth_result === null) {
    console.log(JSON.stringify({
      status: 'error',
      error: `Credential '${credential_name}' unavailable`,
      hint: 'Create an identity first',
    }, null, 2));
    process.exit(1);
  }

  const [auth, _] = auth_result;
  const client = create_user_service_client(config);
  try {
    const result = await authenticated_rpc_call(
      client, CONTENT_RPC, 'get', { slug: slug },
      { auth: auth, credentialName: credential_name }
    );
    console.log(JSON.stringify({
      status: 'ok',
      action: 'get',
      page: result,
    }, null, 2));
  } finally {
    // Client cleanup if needed
  }
}

/**
 * CLI 入口点
 *
 * Python 原型:
 * def main() -> None:
 */
function main() {
  const args = process.argv.slice(2);
  
  // 解析命令行参数
  const parsed = parseArgs(args);
  
  console.log(`manage_content CLI started credential=${parsed.credential}`);

  // 从文件读取正文 (如果指定了 body-file)
  let body = parsed.body;
  if (parsed.bodyFile) {
    const bodyPath = path.resolve(parsed.bodyFile);
    if (!fs.existsSync(bodyPath)) {
      console.log(JSON.stringify({
        status: 'error',
        error: `File not found: ${parsed.bodyFile}`,
        hint: 'Check the file path',
      }, null, 2));
      process.exit(1);
    }
    body = fs.readFileSync(bodyPath, 'utf-8');
  }

  // 执行相应的操作
  (async () => {
    try {
      if (parsed.create) {
        if (!parsed.slug || !parsed.title) {
          console.error('--create requires --slug and --title');
          process.exit(1);
        }
        await create_page(
          parsed.credential,
          parsed.slug,
          parsed.title,
          body || '',
          parsed.visibility || 'public'
        );
      } else if (parsed.update) {
        if (!parsed.slug) {
          console.error('--update requires --slug');
          process.exit(1);
        }
        await update_page(
          parsed.credential,
          parsed.slug,
          parsed.title,
          body,
          parsed.visibility
        );
      } else if (parsed.rename) {
        if (!parsed.slug || !parsed.newSlug) {
          console.error('--rename requires --slug and --new-slug');
          process.exit(1);
        }
        await rename_page(
          parsed.credential,
          parsed.slug,
          parsed.newSlug
        );
      } else if (parsed.delete) {
        if (!parsed.slug) {
          console.error('--delete requires --slug');
          process.exit(1);
        }
        await delete_page(parsed.credential, parsed.slug);
      } else if (parsed.list) {
        await list_pages(parsed.credential);
      } else if (parsed.get) {
        if (!parsed.slug) {
          console.error('--get requires --slug');
          process.exit(1);
        }
        await get_page(parsed.credential, parsed.slug);
      }
    } catch (error) {
      if (error instanceof JsonRpcError) {
        console.log(JSON.stringify({
          status: 'error',
          error_type: 'jsonrpc',
          code: error.code,
          message: error.message,
          data: error.data,
        }, null, 2));
        process.exit(1);
      } else {
        console.log(JSON.stringify({
          status: 'error',
          error_type: error.name,
          message: error.message,
        }, null, 2));
        process.exit(1);
      }
    }
  })();
}

/**
 * 解析命令行参数
 * @param {string[]} args - 命令行参数
 * @returns {Object} 解析后的参数对象
 */
function parseArgs(args) {
  const result = {
    create: false,
    update: false,
    rename: false,
    delete: false,
    list: false,
    get: false,
    slug: null,
    title: null,
    body: null,
    bodyFile: null,
    visibility: null,
    newSlug: null,
    credential: 'default'
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--create') {
      result.create = true;
    } else if (arg === '--update') {
      result.update = true;
    } else if (arg === '--rename') {
      result.rename = true;
    } else if (arg === '--delete') {
      result.delete = true;
    } else if (arg === '--list') {
      result.list = true;
    } else if (arg === '--get') {
      result.get = true;
    } else if (arg === '--slug' && i + 1 < args.length) {
      result.slug = args[++i];
    } else if (arg === '--title' && i + 1 < args.length) {
      result.title = args[++i];
    } else if (arg === '--body' && i + 1 < args.length) {
      result.body = args[++i];
    } else if (arg === '--body-file' && i + 1 < args.length) {
      result.bodyFile = args[++i];
    } else if (arg === '--visibility' && i + 1 < args.length) {
      result.visibility = args[++i];
    } else if (arg === '--new-slug' && i + 1 < args.length) {
      result.newSlug = args[++i];
    } else if (arg === '--credential' && i + 1 < args.length) {
      result.credential = args[++i];
    }
  }

  return result;
}

// 导出函数
module.exports = {
  create_page,
  update_page,
  rename_page,
  delete_page,
  list_pages,
  get_page,
  main,
  parseArgs
};

// CLI 入口
if (require.main === module) {
  main();
}
