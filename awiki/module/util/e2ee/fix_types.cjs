const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'e2ee.ts');
let content = fs.readFileSync(filePath, 'utf8');

// 修复 1: Uint8Array -> Buffer.from
content = content.replace(
  /key: this\._localX25519PrivateKey,/g,
  'key: Buffer.from(this._localX25519PrivateKey),'
);

// 修复 2: peerPublicKey -> Buffer.from(peerPublicKey)
content = content.replace(
  /key: peerPublicKey,/g,
  'key: Buffer.from(peerPublicKey),'
);

// 修复 3: console.exception -> console.error
content = content.replace(
  /console\.exception\(/g,
  'console.error('
);

// 修复 4: return shared -> return new Uint8Array(shared)
content = content.replace(
  /return shared;/,
  'return new Uint8Array(shared);'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('File fixed successfully');
