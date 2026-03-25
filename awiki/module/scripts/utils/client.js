/**
 * httpx AsyncClient factory.
 *
 * Python 源文件：python/scripts/utils/client.py
 * 分析报告：doc/scripts/utils/client.py/py.md
 * 蒸馏数据：doc/scripts/utils/client.py/py.json
 *
 * [INPUT]: SDKConfig
 * [OUTPUT]: create_user_service_client(), create_molt_message_client()
 * [POS]: Provides pre-configured HTTP clients
 *
 * [PROTOCOL]:
 * 1. Update this header when logic changes
 * 2. Check the folder's CLAUDE.md after updates
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { URL } = require('url');
const https = require('https');
const { request } = require('undici');

/**
 * Resolve TLS verification settings for the given service URL.
 *
 * Priority:
 *   1. AWIKI_CA_BUNDLE / E2E_CA_BUNDLE environment variable
 *   2. Auto-detect mkcert root CA for local *.test domains on macOS
 *   3. Default system/Certifi verification
 *
 * @param {string} baseUrl - The base URL of the service
 * @returns {boolean|https.Agent} TLS verification setting (true/false or SSLContext equivalent)
 */
function _resolveVerify(baseUrl) {
  // 1. Check environment variables
  const envNames = ['AWIKI_CA_BUNDLE', 'E2E_CA_BUNDLE', 'SSL_CERT_FILE'];
  for (const envName of envNames) {
    const candidate = (process.env[envName] || '').trim();
    if (candidate && fs.existsSync(candidate)) {
      // Create SSL context equivalent with custom CA
      return https.Agent({
        ca: fs.readFileSync(candidate)
      });
    }
  }

  // 2. Detect mkcert for .test domains (macOS)
  const parsedUrl = new URL(baseUrl);
  const host = (parsedUrl.hostname || '').toLowerCase();
  if (host.endsWith('.test') || host === 'localhost') {
    const mkcertRoot = path.join(
      os.homedir(),
      'Library',
      'Application Support',
      'mkcert',
      'rootCA.pem'
    );
    if (fs.existsSync(mkcertRoot)) {
      return https.Agent({
        ca: fs.readFileSync(mkcertRoot)
      });
    }
  }

  // 3. Default verification
  return true;
}

/**
 * Create a response wrapper that mimics httpx.Response
 * @param {Object} undiciResponse - Response from undici
 * @returns {Object} httpx-like response
 */
function _wrapResponse(undiciResponse) {
  return {
    status_code: undiciResponse.statusCode,
    headers: {
      get: (name) => undiciResponse.headers[name.toLowerCase()] || null
    },
    json: async () => {
      const text = await undiciResponse.body.text();
      return JSON.parse(text);
    },
    text: async () => {
      return await undiciResponse.body.text();
    },
    raise_for_status: () => {
      if (undiciResponse.statusCode >= 400) {
        throw new Error(`HTTP ${undiciResponse.statusCode}`);
      }
    }
  };
}

/**
 * Create an async HTTP client for user-service.
 *
 * @param {Object} config - SDKConfig instance
 * @param {string} config.user_service_url - User service URL
 * @returns {Object} HTTP client configured for user-service
 */
function create_user_service_client(config) {
  const verify = _resolveVerify(config.user_service_url);
  const baseUrl = config.user_service_url;

  // Create dispatcher for undici
  let dispatcher = undefined;
  if (typeof verify === 'object' && verify !== null) {
    dispatcher = verify;
  } else if (verify === false) {
    dispatcher = new (require('undici')).Agent({
      connect: {
        rejectUnauthorized: false
      }
    });
  }

  // Return a client-like object that mimics httpx.AsyncClient behavior
  return {
    base_url: baseUrl,
    baseUrl: baseUrl,
    timeout: 30000, // 30.0 seconds in milliseconds
    trustEnv: false,
    verify: verify,
    dispatcher: dispatcher,

    // POST method for RPC calls
    post: async (endpoint, options = {}) => {
      const url = `${baseUrl}${endpoint}`;
      const body = options.json ? JSON.stringify(options.json) : null;
      
      const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      };

      const response = await request(url, {
        method: 'POST',
        headers,
        body,
        dispatcher
      });

      return _wrapResponse(response);
    },

    // GET method
    get: async (endpoint, options = {}) => {
      const url = `${baseUrl}${endpoint}`;
      
      const headers = {
        ...(options.headers || {})
      };

      const response = await request(url, {
        method: 'GET',
        headers,
        dispatcher
      });

      return _wrapResponse(response);
    },

    // HTTP methods (to be implemented by callers using undici or similar)
    // This is a configuration holder that matches Python's httpx.AsyncClient
    _config: {
      base_url: baseUrl,
      timeout: 30.0,
      trust_env: false,
      verify: verify
    }
  };
}

/**
 * Create an async HTTP client for molt-message.
 *
 * @param {Object} config - SDKConfig instance
 * @param {string} config.molt_message_url - Molt message service URL
 * @returns {Object} HTTP client configured for molt-message
 */
function create_molt_message_client(config) {
  const verify = _resolveVerify(config.molt_message_url);
  const baseUrl = config.molt_message_url;

  // Create dispatcher for undici
  let dispatcher = undefined;
  if (typeof verify === 'object' && verify !== null) {
    dispatcher = verify;
  } else if (verify === false) {
    dispatcher = new (require('undici')).Agent({
      connect: {
        rejectUnauthorized: false
      }
    });
  }

  // Return a client-like object that mimics httpx.AsyncClient behavior
  return {
    base_url: baseUrl,
    baseUrl: baseUrl,
    timeout: 30000, // 30.0 seconds in milliseconds
    trustEnv: false,
    verify: verify,
    dispatcher: dispatcher,

    // POST method for RPC calls
    post: async (endpoint, options = {}) => {
      const url = `${baseUrl}${endpoint}`;
      const body = options.json ? JSON.stringify(options.json) : null;
      
      const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      };

      const response = await request(url, {
        method: 'POST',
        headers,
        body,
        dispatcher
      });

      return _wrapResponse(response);
    },

    // GET method
    get: async (endpoint, options = {}) => {
      const url = `${baseUrl}${endpoint}`;
      
      const headers = {
        ...(options.headers || {})
      };

      const response = await request(url, {
        method: 'GET',
        headers,
        dispatcher
      });

      return _wrapResponse(response);
    },

    // HTTP methods (to be implemented by callers using undici or similar)
    // This is a configuration holder that matches Python's httpx.AsyncClient
    _config: {
      base_url: baseUrl,
      timeout: 30.0,
      trust_env: false,
      verify: verify
    }
  };
}

module.exports = {
  create_molt_message_client,
  create_user_service_client,
  _resolveVerify,
  _wrapResponse
};
