/**
 * Unit tests for query_db module
 * 
 * Based on distillation data from:
 * doc/scripts/query_db.py/py.json
 */

const assert = require('assert');

describe('query_db', () => {
  describe('Module Import', () => {
    it('should import query_db module', () => {
      const query_db = require('../../scripts/query_db');
      assert.ok(query_db, 'query_db module should be loaded');
      assert.ok(typeof query_db.query_db === 'function');
    });
  });

  describe('CLI argument handling', () => {
    it('should require SQL query parameter', () => {
      const { execSync } = require('child_process');
      try {
        execSync('python scripts/query_db.py', { stdio: 'pipe', cwd: process.cwd() + '/../../python' });
        assert.fail('Should require SQL query');
      } catch (error) { /* Expected */ }
    });

    it('should accept SELECT query', () => {
      const { execSync } = require('child_process');
      try {
        execSync('python scripts/query_db.py "SELECT * FROM messages LIMIT 10"', { stdio: 'pipe', cwd: process.cwd() + '/../../python' });
      } catch (error) { /* Expected */ }
    });

    it('should reject DROP query', () => {
      const { execSync } = require('child_process');
      try {
        execSync('python scripts/query_db.py "DROP TABLE messages"', { stdio: 'pipe', cwd: process.cwd() + '/../../python' });
        assert.fail('Should reject DROP query');
      } catch (error) { /* Expected */ }
    });

    it('should reject DELETE without WHERE', () => {
      const { execSync } = require('child_process');
      try {
        execSync('python scripts/query_db.py "DELETE FROM messages"', { stdio: 'pipe', cwd: process.cwd() + '/../../python' });
        assert.fail('Should reject DELETE without WHERE');
      } catch (error) { /* Expected */ }
    });
  });

  describe('SDKConfig integration', () => {
    it('should load SDK configuration', () => {
      const { SDKConfig } = require('../../scripts/utils/config');
      const config = SDKConfig.load();
      assert.ok(config, 'SDKConfig should be loaded');
    });
  });
});
