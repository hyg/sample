# AGENTS.md - Agent Coding Guidelines

## Project Overview

This is a Node.js command-line tool for collecting Japanese AV actress works and magnet links from websites.

## Build/Lint/Test Commands

```bash
# Install dependencies
npm install

# Run getcode.js (fetch actress profile and works)
node getcode.js <演员中文名> [截止日期yyyymmdd]

# Run getmagnet.js (search magnet links)
node getmagnet.js <演员中文名>
```

**Note**: This project has no formal test suite or linting. Test manually by running the scripts.

## Code Style Guidelines

### General Principles

- **Language**: JavaScript (CommonJS)
- **Target**: Node.js command-line tools
- **No TypeScript** - Use plain JavaScript with clear variable naming

### Imports

```javascript
// Node.js built-ins first
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// External libraries
const puppeteer = require('puppeteer');
const { JSDOM } = require('jsdom');

// Local modules
const { loadSitesConfig, getMagnetSites, formatString } = require('./common');
```

### Formatting

- **No template literals for user output**: Use string concatenation for console.log to avoid encoding issues on Windows
  ```javascript
  // Bad
  console.log(`[*] 收集到 ${count} 个磁链`);

  // Good
  console.log('[*] 收集到 ' + count + ' 个磁链');
  ```

- **Function definitions**: Use `function name() {}` syntax, not arrow functions for top-level functions
- **Curly braces**: Same-line opening brace
- **Indentation**: 4 spaces

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Variables | camelCase | `profileData`, `collectedMagnets` |
| Constants | UPPER_SNAKE | `CONCURRENCY`, `SEARCH_DELAY` |
| Functions | camelCase | `loadSitesConfig()`, `formatString()` |
| Files | kebab-case | `getcode.js`, `common.js` |
| YAML configs | kebab-case | `sites.yaml` |

### Error Handling

- Use try-catch for async operations
- Log errors with `console.error()`
- Exit with `process.exit(1)` on critical errors
- Use `.catch(() => {})` for fire-and-forget promises

```javascript
try {
    await browser.close();
} catch (e) {
    // Ignore close errors
}
```

### Configuration Pattern

All website configurations go in `sites.yaml`:
- `profileSites`: Actress profile websites
- `magnetSites`: Magnet search websites

Each site config includes:
- `baseUrl`: Base URL
- `search`: Search page config
- `result`: Search result parsing
- `detail`: Detail page config

### YAML Handling

- Use `js-yaml` library
- Write options for multiline strings:
  ```javascript
  fs.writeFileSync(file, yaml.dump(data, {
      allowUnicode: true,
      lineWidth: -1,
      noRefs: true,
      styles: { '!!str': '|' }  // Use literal style for long strings
  }));
  ```

### Puppeteer Usage

- Launch with sandbox disabled for container environments:
  ```javascript
  await puppeteer.launch({
      headless: 'new',
      args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage'
      ]
  });
  ```

### Signal Handling

Handle graceful shutdown:
```javascript
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

function cleanup() {
    // Save state
    // Close browser
    process.exit(0);
}
```

### Concurrency Pattern

Use promise array with pipeline pattern:
```javascript
const running = [];
while (workIndex < works.length || running.length > 0) {
    while (workIndex < works.length && running.length < CONCURRENCY) {
        const p = runTask(work);
        running.push(p);
        p.then(() => {
            const idx = running.indexOf(p);
            if (idx > -1) running.splice(idx, 1);
        });
    }
    if (running.length > 0) {
        await Promise.any(running);
    }
}
```

### Profile Data Structure

Store in `profile/演员名.yaml`:
- Actor metadata (name, birthday, etc.)
- Works array (code, date, duration, maker, magnet, magnet_updated_at)
- Cache for current run (updated_at, magnets)

### Critical Files

| File | Purpose |
|------|---------|
| `common.js` | Shared utilities (config loading, encoding) |
| `sites.yaml` | Website configuration |
| `getcode.js` | Fetch actress info and works |
| `getmagnet.js` | Search magnet links |
| `profile/` | Output directory for YAML files |

### When Modifying

1. **Add new magnet site**: Update `sites.yaml` with new entry in `magnetSites`
2. **Add new profile site**: Update `sites.yaml` with new entry in `profileSites`
3. **Change search logic**: Modify `getmagnet.js` search functions
4. **Change extraction logic**: Modify `getcode.js` extract functions

### Encoding Issues on Windows

- Always use `setEncoding('utf8')` for stdout
- Use string concatenation instead of template literals for console.log
- Test on Windows specifically for output issues
