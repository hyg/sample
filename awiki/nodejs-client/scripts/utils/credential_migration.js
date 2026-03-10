/**
 * Legacy credential migration into the indexed per-credential directory layout.
 *
 * [INPUT]: Legacy flat credential JSON files, legacy E2EE state files,
 *          credential_layout validated scan helpers, credential_store, e2ee_store
 * [OUTPUT]: detectLegacyLayout(), migrateLegacyCredentials(),
 *           ensureCredentialStorageReady()
 * [POS]: Shared migration module used by check_status.py and the standalone
 *        migrate_credentials.py CLI
 *
 * [PROTOCOL]:
 * 1. Update this header when logic changes
 * 2. Check the folder's CLAUDE.md after updating
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs';
import { join } from 'path';

import {
    getCredentialEntry,
    hasLegacyLayout,
    legacyAuthExportPaths,
    legacyBackupRoot,
    legacyE2eeStatePath,
    legacyIdentityPath,
    resolveCredentialPaths,
    scanLegacyLayout,
    writeSecureJson
} from './credential_layout.js';
import { saveIdentity } from './credential_store.js';
import { saveE2eeState } from './e2ee_store.js';

/**
 * Inspect whether legacy credential files still exist.
 * @returns {Object} Detection results
 */
export function detectLegacyLayout() {
    const scanResult = scanLegacyLayout();
    const legacyCredentials = scanResult.legacy_credentials;
    return {
        status: legacyCredentials.length > 0
            ? 'legacy'
            : scanResult.invalid_json_files.length > 0 || scanResult.orphan_e2ee_files.length > 0
                ? 'legacy_issues'
                : 'new',
        legacy_credentials: legacyCredentials,
        unique_dids: scanResult.unique_dids,
        unique_did_count: scanResult.unique_did_count,
        invalid_json_files: scanResult.invalid_json_files,
        orphan_e2ee_files: scanResult.orphan_e2ee_files
    };
}

/**
 * Load JSON content from a path.
 * @param {string} filePath - File path
 * @returns {Object} JSON content
 */
function _readJson(filePath) {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
}

/**
 * Move legacy files into a timestamped backup directory.
 * @param {string} credentialName - Credential name
 * @param {string} runId - Run ID
 * @returns {string} Backup directory path
 */
function _backupLegacyFiles(credentialName, runId) {
    const backupDir = join(legacyBackupRoot(), runId, credentialName);
    if (!existsSync(backupDir)) {
        mkdirSync(backupDir, { recursive: true });
    }

    const pathsToArchive = [
        legacyIdentityPath(credentialName),
        legacyE2eeStatePath(credentialName),
        ...legacyAuthExportPaths(credentialName)
    ];

    for (const filePath of pathsToArchive) {
        if (existsSync(filePath)) {
            const fileName = filePath.split('/').pop();
            renameSync(filePath, join(backupDir, fileName));
        }
    }

    console.info(`Archived legacy credential artifacts credential=${credentialName} backup_dir=${backupDir}`);
    return backupDir;
}

/**
 * Migrate one legacy credential into the new layout.
 * @param {string} credentialName - Credential name
 * @param {string} runId - Run ID
 * @returns {Object} Migration result
 */
function _migrateSingleCredential(credentialName, runId) {
    const legacyPath = legacyIdentityPath(credentialName);
    if (!existsSync(legacyPath)) {
        throw new Error(`Legacy credential file not found for '${credentialName}'`);
    }

    const legacyData = _readJson(legacyPath);
    const did = legacyData.did;
    const uniqueId = legacyData.unique_id || did.split(':').pop();

    // Use Node.js saveIdentity signature (identity object as first parameter)
    saveIdentity({
        did,
        uniqueId,
        userId: legacyData.user_id,
        private_key_pem: legacyData.private_key_pem,
        public_key_pem: legacyData.public_key_pem || '',
        jwt_token: legacyData.jwt_token,
        display_name: legacyData.name,
        handle: legacyData.handle,
        name: credentialName,
        did_document: legacyData.did_document,
        e2ee_signing_private_pem: legacyData.e2ee_signing_private_pem,
        e2ee_agreement_private_pem: legacyData.e2ee_agreement_private_pem
    }, credentialName, legacyData.name, legacyData.handle);

    const legacyE2eePath = legacyE2eeStatePath(credentialName);
    if (existsSync(legacyE2eePath)) {
        saveE2eeState(_readJson(legacyE2eePath), credentialName);
    }

    const backupDir = _backupLegacyFiles(credentialName, runId);
    const resolvedPaths = resolveCredentialPaths(credentialName);
    return {
        credential_name: credentialName,
        did: did,
        dir_name: resolvedPaths ? resolvedPaths.dirName : null,
        backup_dir: backupDir
    };
}

/**
 * Migrate legacy flat-file credentials into the new indexed layout.
 * @param {string|null} credentialName - Specific credential name to migrate (null for all)
 * @returns {Object} Migration results
 */
export function migrateLegacyCredentials(credentialName = null) {
    const scanResult = scanLegacyLayout();
    let legacyCredentials = scanResult.legacy_credentials;
    if (credentialName !== null) {
        legacyCredentials = legacyCredentials.filter(name => name === credentialName);
    }

    if (legacyCredentials.length === 0) {
        return {
            status: 'not_needed',
            legacy_credentials: legacyCredentials,
            unique_dids: scanResult.unique_dids,
            unique_did_count: scanResult.unique_did_count,
            migrated: [],
            skipped: [],
            conflicts: [],
            errors: [],
            invalid_json_files: scanResult.invalid_json_files,
            orphan_e2ee_files: scanResult.orphan_e2ee_files
        };
    }

    // Generate timestamp in ISO format without special characters
    const now = new Date();
    const runId = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const migrated = [];
    const skipped = [];
    const conflicts = [];
    const errors = [];

    for (const legacyName of legacyCredentials) {
        try {
            const existingEntry = getCredentialEntry(legacyName);
            const legacyPath = legacyIdentityPath(legacyName);
            if (existingEntry !== null && !existsSync(legacyPath)) {
                skipped.push({
                    credential_name: legacyName,
                    reason: 'already_migrated'
                });
                continue;
            }

            migrated.push(_migrateSingleCredential(legacyName, runId));
        } catch (exc) {
            // In JavaScript, we check the error message to determine if it's a conflict
            if (exc.message.includes('already exists') || exc.message.includes('refusing to overwrite')) {
                conflicts.push({
                    credential_name: legacyName,
                    reason: exc.message
                });
                console.warn(`Credential migration conflict credential=${legacyName} error=${exc.message}`);
            } else {
                errors.push({
                    credential_name: legacyName,
                    reason: exc.message
                });
                console.error(`Credential migration failed credential=${legacyName}`, exc);
            }
        }
    }

    const hasConflictsOrErrors = conflicts.length > 0 || errors.length > 0;
    const status = hasConflictsOrErrors
        ? (migrated.length > 0 ? 'partial' : 'error')
        : 'migrated';

    return {
        status: status,
        legacy_credentials: legacyCredentials,
        unique_dids: scanResult.unique_dids,
        unique_did_count: scanResult.unique_did_count,
        migrated: migrated,
        skipped: skipped,
        conflicts: conflicts,
        errors: errors,
        invalid_json_files: scanResult.invalid_json_files,
        orphan_e2ee_files: scanResult.orphan_e2ee_files
    };
}

/**
 * Ensure the credential storage layout is ready for runtime use.
 * @param {string|null} credentialName - Specific credential name to check
 * @returns {Object} Storage readiness results
 */
export function ensureCredentialStorageReady(credentialName = null) {
    const detection = detectLegacyLayout();
    if (detection.status === 'new') {
        return {
            status: 'ready',
            layout: 'new',
            credential_ready: true,
            migration: null
        };
    }

    const migration = migrateLegacyCredentials();
    const targetInLegacy = (
        credentialName !== null &&
        detection.legacy_credentials.includes(credentialName)
    );
    const credentialReady = (
        !targetInLegacy ||
        getCredentialEntry(credentialName) !== null
    );
    return {
        status: migration.status,
        layout: hasLegacyLayout() ? 'legacy_remaining' : 'new',
        credential_ready: credentialReady,
        migration: migration
    };
}

export default {
    detectLegacyLayout,
    ensureCredentialStorageReady,
    migrateLegacyCredentials
};
