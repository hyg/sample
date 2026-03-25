/**
 * Unit tests for local_store module
 *
 * Based on distillation data from:
 * doc/scripts/local_store.py/py.json
 *
 * Python source: python/scripts/local_store.py
 */

const assert = require('assert');
const path = require('path');

// Load module under test
const localStore = require('../../../module/scripts/local-store');
const { SDKConfig } = require('../../../module/scripts/utils/config');

describe('local_store', () => {
  let config;
  let conn;
  
  beforeEach(() => {
    config = SDKConfig.load();
    conn = localStore.get_connection(config);
  });
  
  afterEach(() => {
    if (conn) {
      conn.close();
    }
  });

  describe('get_connection', () => {
    it('should return a database connection', () => {
      // Based on py.json: get_connection
      assert.ok(conn, 'Connection should be returned');
      assert.ok(typeof conn.execute === 'function', 'Connection should have execute method');
      assert.ok(typeof conn.close === 'function', 'Connection should have close method');
    });
  });

  describe('ensure_schema', () => {
    it('should create database schema', () => {
      // Based on py.json: ensure_schema
      localStore.ensure_schema(conn);
      
      // Check tables exist
      const tables = conn.execute(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `).all();
      
      assert.ok(tables.length > 0, 'Tables should be created');
    });
  });

  describe('store_message', () => {
    it('should store a message to database', () => {
      // Based on py.json: store_message
      localStore.ensure_schema(conn);
      
      const message = {
        msg_id: 'msg_test_' + Date.now(),
        owner_did: 'did:wba:awiki.ai:user:k1_test',
        thread_id: 'dm:did1:did2',
        direction: 0,
        sender_did: 'did:wba:awiki.ai:user:k1_sender',
        receiver_did: 'did:wba:awiki.ai:user:k1_receiver',
        content_type: 'text',
        content: 'Test message',
        sent_at: new Date().toISOString()
      };
      
      localStore.store_message(conn, message);
      
      // Verify stored
      const result = conn.execute(
        'SELECT * FROM messages WHERE msg_id = ?',
        [message.msg_id]
      ).get();
      
      assert.ok(result, 'Message should be stored');
      assert.strictEqual(result.content, message.content);
    });
  });

  describe('upsert_contact', () => {
    it('should insert or update a contact', () => {
      // Based on py.json: upsert_contact
      localStore.ensure_schema(conn);
      
      const contact = {
        owner_did: 'did:wba:awiki.ai:user:k1_test',
        did: 'did:wba:awiki.ai:user:k1_contact',
        name: 'Test Contact',
        handle: 'test.awiki.ai'
      };
      
      localStore.upsert_contact(conn, contact);
      
      // Verify stored
      const result = conn.execute(
        'SELECT * FROM contacts WHERE did = ?',
        [contact.did]
      ).get();
      
      assert.ok(result, 'Contact should be stored');
      assert.strictEqual(result.name, contact.name);
    });
  });

  describe('upsert_group', () => {
    it('should insert or update a group', () => {
      // Based on py.json: upsert_group
      localStore.ensure_schema(conn);
      
      const group = {
        owner_did: 'did:wba:awiki.ai:user:k1_test',
        group_id: 'grp_test',
        name: 'Test Group',
        slug: 'test-group'
      };
      
      localStore.upsert_group(conn, group);
      
      // Verify stored
      const result = conn.execute(
        'SELECT * FROM groups WHERE group_id = ?',
        [group.group_id]
      ).get();
      
      assert.ok(result, 'Group should be stored');
      assert.strictEqual(result.name, group.name);
    });
  });

  describe('query helpers', () => {
    it('should provide threads view', () => {
      // Based on py.json: query threads
      localStore.ensure_schema(conn);
      
      const threads = conn.execute('SELECT * FROM threads LIMIT 10').all();
      assert.ok(Array.isArray(threads), 'Should return array');
    });

    it('should provide inbox view', () => {
      const inbox = conn.execute('SELECT * FROM inbox LIMIT 10').all();
      assert.ok(Array.isArray(inbox), 'Should return array');
    });

    it('should provide outbox view', () => {
      const outbox = conn.execute('SELECT * FROM outbox LIMIT 10').all();
      assert.ok(Array.isArray(outbox), 'Should return array');
    });
  });

  describe('SDKConfig integration', () => {
    it('should load SDK configuration', () => {
      // Based on py.json: sdk_integration
      assert.ok(config, 'SDKConfig should be loaded');
      assert.ok(config.data_dir, 'data_dir should be set');
    });
  });
});
