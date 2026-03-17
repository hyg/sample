/**
 * Audited & minimal JS implementation of hash functions, MACs and KDFs. Check out individual modules.
 * @module
 * @example
```js
import {
  sha256, sha384, sha512, sha224, sha512_224, sha512_256
} from '../lib/hashes/sha2';
import {
  sha3_224, sha3_256, sha3_384, sha3_512,
  keccak_224, keccak_256, keccak_384, keccak_512,
  shake128, shake256
} from '../lib/hashes/sha3';
import {
  cshake128, cshake256,
  turboshake128, turboshake256,
  kmac128, kmac256,
  tuplehash256, parallelhash256,
  k12, m14, keccakprg
} from '../lib/hashes/sha3-addons';
import { blake3 } from '../lib/hashes/blake3';
import { blake2b, blake2s } from '../lib/hashes/blake2';
import { hmac } from '../lib/hashes/hmac';
import { hkdf } from '../lib/hashes/hkdf';
import { pbkdf2, pbkdf2Async } from '../lib/hashes/pbkdf2';
import { scrypt, scryptAsync } from '../lib/hashes/scrypt';
import { md5, ripemd160, sha1 } from '../lib/hashes/legacy';
import * as utils from '../lib/hashes/utils';
```
 */
throw new Error('root module cannot be imported: import submodules instead. Check out README');
export {};
//# sourceMappingURL=index.js.map