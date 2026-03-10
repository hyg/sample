# Migration Plan: Python to Node.js Client

## Project Overview

**Objective**: Port Python client functionality to Node.js client  
**Source**: `python-client/` (read-only reference)  
**Target**: `nodejs-client/` (working directory)  
**Status**: P0 (JWT auto-refresh) completed, remaining modules pending

---

## Current Status Summary

### ✅ Completed (P0)
- JWT auto-refresh mechanism
- DID WBA authentication
- Core authentication and credential management
- Basic E2EE encryption (HPKE, ratchet, session)

### ✅ Completed (Phase 1-2)
- credential_layout.py → scripts/utils/credential_layout.js
- credential_migration.py → scripts/utils/credential_migration.js
- e2ee_store.py → scripts/utils/e2ee_store.js
- e2ee_outbox.py → scripts/utils/e2ee_outbox.js
- local_store.py → scripts/utils/local_store.js (SQLite)
- database_migration.py → scripts/utils/database_migration.js
- check_status.py → scripts/check_status.js

### ⏳ Pending
- e2ee_handler.py
- migrate_credentials.py
- migrate_local_database.py
- query_db.py
- recover_handle.py
- regenerate_e2ee_keys.py
- resolve_handle.py
- service_manager.py
- listener_config.py

---

## Missing Modules Analysis

### 1. Python Scripts (28 total, 11 implemented)

| Script | Status | Priority | Description |
|--------|--------|----------|-------------|
| `check_status.py` | ✅ Implemented | High | Unified status check (identity + inbox + E2EE auto-processing) |
| `credential_layout.py` | ✅ Implemented | High | Credential storage layout helpers |
| `credential_migration.py` | ✅ Implemented | High | Legacy credential migration |
| `database_migration.py` | ✅ Implemented | Medium | Local database migration |
| `e2ee_handler.py` | ❌ Missing | High | E2EE message handling |
| `e2ee_outbox.py` | ✅ Implemented | Medium | E2EE outbox management |
| `e2ee_store.py` | ✅ Implemented | Medium | E2EE state storage |
| `local_store.py` | ✅ Implemented | Medium | Local storage management |
| `migrate_credentials.py` | ❌ Missing | Medium | Credential migration CLI |
| `migrate_local_database.py` | ❌ Missing | Low | Database migration CLI |
| `query_db.py` | ❌ Missing | Low | Database query CLI |
| `recover_handle.py` | ❌ Missing | Medium | Handle recovery CLI |
| `regenerate_e2ee_keys.py` | ❌ Missing | Medium | E2EE key regeneration |
| `resolve_handle.py` | ❌ Missing | Medium | Handle resolution CLI |
| `service_manager.py` | ❌ Missing | Low | Service management CLI |

### 2. Python Utils (11 total, 8 implemented in src/utils, 3 missing)

| Utility | Status | Location | Description |
|---------|--------|----------|-------------|
| `auth.py` | ✅ Implemented | `src/utils/auth.js` | Authentication utilities |
| `client.py` | ✅ Implemented | `src/utils/client.js` | HTTP client utilities |
| `config.py` | ✅ Implemented | `src/utils/config.js` | Configuration utilities |
| `e2ee.py` | ❌ Missing | - | E2EE utilities |
| `handle.py` | ✅ Implemented | `src/utils/handle.js` | Handle utilities |
| `identity.py` | ✅ Implemented | `src/utils/identity.js` | Identity utilities |
| `logging_config.py` | ❌ Missing | - | Logging configuration |
| `resolve.py` | ✅ Implemented | `src/utils/resolve.js` | DID resolution utilities |
| `rpc.py` | ✅ Implemented | `src/utils/rpc.js` | RPC utilities |
| `ws.py` | ❌ Missing | - | WebSocket utilities |

### 3. Node.js Scripts (11 implemented, 6 missing)

**Implemented:**
- `check_inbox.js`
- `e2ee_messaging.js`
- `get_profile.js`
- `manage_content.js`
- `manage_group.js`
- `manage_relationship.js`
- `register_handle.js`
- `send_message.js`
- `setup_identity.js`
- `update_profile.js`
- `ws_listener.js`

**Missing:**
- `check_status.js` (equivalent to Python `check_status.py`)
- `credential_layout.js` (equivalent to Python `credential_layout.py`)
- `credential_migration.js` (equivalent to Python `credential_migration.py`)
- `e2ee_handler.js` (equivalent to Python `e2ee_handler.py`)
- `e2ee_outbox.js` (equivalent to Python `e2ee_outbox.py`)
- `e2ee_store.js` (equivalent to Python `e2ee_store.py`)

---

## Migration Priority Matrix

### High Priority (Core Functionality)
1. **check_status.py** → `check_status.js`
   - Unified status check for agent session startup
   - Identity verification + inbox + E2EE auto-processing
   - Required for production deployment

2. **credential_layout.py** → `credential_layout.js`
   - Storage layout helpers for multi-credential support
   - Required for credential migration

3. **credential_migration.py** → `credential_migration.js`
   - Legacy credential migration into indexed layout
   - Required for backward compatibility

4. **auth.py** → `auth.js`
   - Authentication utilities
   - Required for JWT handling

5. **client.py** → `client.js`
   - HTTP client utilities
   - Required for RPC calls

6. **e2ee.py** → `e2ee.js`
   - E2EE utilities
   - Required for encryption/decryption

### Medium Priority (Enhanced Functionality)
7. **e2ee_handler.py** → `e2ee_handler.js`
   - E2EE message handling

8. **e2ee_outbox.py** → `e2ee_outbox.js`
   - E2EE outbox management

9. **e2ee_store.py** → `e2ee_store.js`
   - E2EE state storage

10. **handle.py** → `handle.js`
    - Handle utilities

11. **identity.py** → `identity.js`
    - Identity utilities

12. **resolve.py** → `resolve.js`
    - DID resolution utilities

13. **ws.py** → `ws.js`
    - WebSocket utilities

### Low Priority (Advanced Features)
14. **database_migration.py** → `database_migration.js`
15. **local_store.py** → `local_store.js`
16. **migrate_credentials.py** → `migrate_credentials.js`
17. **migrate_local_database.py** → `migrate_local_database.js`
18. **query_db.py** → `query_db.js`
19. **recover_handle.py** → `recover_handle.js`
20. **regenerate_e2ee_keys.py** → `regenerate_e2ee_keys.js`
21. **resolve_handle.py** → `resolve_handle.js`
22. **service_manager.py** → `service_manager.js`
23. **logging_config.py** → `logging_config.js`

---

## Detailed Migration Plan

### Phase 1: Core Infrastructure (Week 1)
**Goal**: Establish foundation for status checks and credential management

1. **Port `credential_layout.py`**
   - Implement `CredentialPaths` dataclass
   - Implement path resolution functions
   - Implement index management
   - Test: `tests/credential_layout.test.js`

2. **Port `credential_migration.py`**
   - Implement legacy detection
   - Implement migration logic
   - Implement backup functionality
   - Test: `tests/credential_migration.test.js`

3. **Port `auth.py` utilities**
   - Implement authentication helpers
   - Implement JWT handling
   - Test: `tests/auth.test.js`

4. **Port `client.py` utilities**
   - Implement HTTP client wrapper
   - Implement RPC call helpers
   - Test: `tests/client.test.js`

### Phase 2: E2EE Enhancement (Week 2)
**Goal**: Complete E2EE message handling and storage

5. **Port `e2ee_handler.py`**
   - Implement E2EE message processing
   - Implement session management
   - Test: `tests/e2ee_handler.test.js`

6. **Port `e2ee_outbox.py`**
   - Implement outbox management
   - Implement failure recording
   - Test: `tests/e2ee_outbox.test.js`

7. **Port `e2ee_store.py`**
   - Implement E2EE state storage
   - Implement load/save/delete operations
   - Test: `tests/e2ee_store.test.js`

8. **Port `e2ee.py` utilities**
   - Implement E2EE helpers
   - Implement encryption/decryption utilities
   - Test: `tests/e2ee.test.js`

### Phase 3: Status & Monitoring (Week 3)
**Goal**: Unified status checking and monitoring

9. **Port `check_status.py`**
   - Implement identity check
   - Implement inbox summary
   - Implement E2EE auto-processing
   - Test: `tests/check_status.test.js`

10. **Update `check_inbox.js`**
    - Integrate with new credential layout
    - Add E2EE auto-processing option
    - Test: `tests/check_inbox.test.js`

### Phase 4: Handle & Identity (Week 4)
**Goal**: Handle management and identity utilities

11. **Port `handle.py` utilities**
    - Implement handle resolution
    - Implement handle registration helpers
    - Test: `tests/handle.test.js`

12. **Port `identity.py` utilities**
    - Implement identity helpers
    - Implement proof generation
    - Test: `tests/identity.test.js`

13. **Port `resolve.py` utilities**
    - Implement DID resolution
    - Test: `tests/resolve.test.js`

14. **Port `ws.py` utilities**
    - Implement WebSocket helpers
    - Test: `tests/ws.test.js`

### Phase 5: Advanced Features (Week 5-6)
**Goal**: Database migration and service management

15. **Port remaining scripts**
    - `database_migration.py`
    - `local_store.py`
    - `migrate_credentials.py`
    - `migrate_local_database.py`
    - `query_db.py`
    - `recover_handle.py`
    - `regenerate_e2ee_keys.py`
    - `resolve_handle.py`
    - `service_manager.py`
    - `logging_config.py`

---

## Testing Strategy

### Unit Tests
- Each migrated module should have corresponding unit tests
- Use Jest for Node.js testing
- Mirror Python test structure

### Integration Tests
- Test credential migration end-to-end
- Test E2EE message flow
- Test status checking

### Regression Tests
- Ensure existing Node.js scripts continue to work
- Verify compatibility with Python version

---

## Documentation Updates

### Update SKILL.md
- Add new CLI commands
- Update API reference
- Add migration notes

### Update README.md
- Update implementation status
- Add migration progress
- Update release checklist

### Create Migration Reports
- `PYTHON_MIGRATION_STATUS.md` - Track migration progress
- `MIGRATION_ISSUES.md` - Document any issues encountered
- `TEST_RESULTS.md` - Record test results

---

## Risk Assessment

### Technical Risks
1. **Complex E2EE Logic**: HPKE and ratchet algorithms require careful implementation
   - Mitigation: Thorough testing with Python version comparison

2. **Credential Storage Layout**: Multi-credential support requires precise path management
   - Mitigation: Unit tests for all path resolution functions

3. **Legacy Migration**: Backward compatibility with old credential format
   - Mitigation: Comprehensive migration tests

### Schedule Risks
1. **Scope Creep**: Additional features may be discovered during migration
   - Mitigation: Strict adherence to priority matrix

2. **Test Coverage**: Comprehensive testing may take longer than implementation
   - Mitigation: Parallelize implementation and testing

---

## Success Criteria

### Phase 1 Success
- ✅ `check_status.js` can identify identity status
- ✅ `check_status.js` can summarize inbox
- ✅ `check_status.js` can auto-process E2EE messages
- ✅ Credential migration works without data loss

### Phase 2 Success
- ✅ E2EE message encryption/decryption works
- ✅ E2EE session management works
- ✅ E2EE state persistence works

### Phase 3 Success
- ✅ All migrated scripts pass unit tests
- ✅ All migrated scripts pass integration tests
- ✅ No regression in existing functionality

### Phase 4 Success
- ✅ Handle management works
- ✅ Identity utilities work
- ✅ DID resolution works

### Phase 5 Success
- ✅ Database migration works
- ✅ Service management works
- ✅ All CLI commands work

---

## Next Steps

1. **Immediate (Today)**
   - Review this plan with team
   - Set up development environment
   - Create first test file

2. **This Week**
   - Implement Phase 1 modules
   - Write unit tests
   - Update documentation

3. **Next Week**
   - Implement Phase 2 modules
   - Integration testing
   - Performance testing

---

**Document Version**: 1.0  
**Last Updated**: 2026-03-11  
**Status**: Draft for review
