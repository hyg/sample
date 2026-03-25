/**
 * migrate-credentials.js 测试
 *
 * Based on distillation data from:
 * doc/scripts/migrate_credentials.py/py.json
 *
 * Python source: python/scripts/migrate_credentials.py
 */

const assert = require('assert');

describe('migrate_credentials', () => {
  // Note: Full migration tests require legacy credential files
  // These tests cover the module structure and CLI argument handling

  describe('Module Import', () => {
    it('should import migrate-credentials module', () => {
      // Based on py.json: module structure
      const migrateCredentials = require('../../scripts/migrate-credentials');

      assert.ok(migrateCredentials, 'migrate-credentials module should be loaded');
      assert.ok(typeof migrateCredentials.main === 'function', 'Should have main function');
    });
  });

  describe('CLI argument handling', () => {
    it('should accept --credential parameter', () => {
      // Based on py.json: CLI with --credential default
      const { execSync } = require('child_process');

      // Run the CLI with --credential parameter
      // Should output JSON with status "not_needed" when no legacy credentials exist
      const output = execSync('node scripts/migrate-credentials.js --credential default', {
        cwd: process.cwd(),
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const result = JSON.parse(output);
      assert.ok(result, 'Should output JSON');
      assert.ok('status' in result, 'Should have status field');
    });

    it('should work without parameters', () => {
      // Based on py.json: default behavior
      const { execSync } = require('child_process');

      const output = execSync('node scripts/migrate-credentials.js', {
        cwd: process.cwd(),
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const result = JSON.parse(output);
      assert.ok(result, 'Should output JSON');
      assert.ok('status' in result, 'Should have status field');
      assert.ok('legacy_credentials' in result, 'Should have legacy_credentials field');
      assert.ok('unique_dids' in result, 'Should have unique_dids field');
      assert.ok('migrated' in result, 'Should have migrated field');
      assert.ok('skipped' in result, 'Should have skipped field');
      assert.ok('conflicts' in result, 'Should have conflicts field');
      assert.ok('errors' in result, 'Should have errors field');
    });
  });

  describe('Output format', () => {
    it('should return correct JSON structure', () => {
      // Based on py.json: OUTPUT format
      const { execSync } = require('child_process');

      const output = execSync('node scripts/migrate-credentials.js', {
        cwd: process.cwd(),
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const result = JSON.parse(output);
      
      // Validate structure based on py.json
      assert.strictEqual(typeof result.status, 'string', 'status should be string');
      assert.ok(Array.isArray(result.legacy_credentials), 'legacy_credentials should be array');
      assert.ok(Array.isArray(result.unique_dids), 'unique_dids should be array');
      assert.strictEqual(typeof result.unique_did_count, 'number', 'unique_did_count should be number');
      assert.ok(Array.isArray(result.migrated), 'migrated should be array');
      assert.ok(Array.isArray(result.skipped), 'skipped should be array');
      assert.ok(Array.isArray(result.conflicts), 'conflicts should be array');
      assert.ok(Array.isArray(result.errors), 'errors should be array');
    });
  });
});
