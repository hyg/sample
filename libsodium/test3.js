import _sodium from 'libsodium-wrappers';

await (async () => {
    await _sodium.ready;
    const sodium = _sodium;

    let key = sodium.from_hex('724b092810ec86d7e35c9d067702b31ef90bc43a7b598626749914d6a3e033ed');
    console.log("key:", key);
    let keypair = sodium.crypto_box_keypair();
    console.log("keypair:", keypair);
    let key2 = "830007992e8f501f349e385eac8e232aa3b33b97086bf9cc79b19883927bea33";
    console.log("key2:", key2);
    keypair = sodium.crypto_box_keypair();
    console.log("keypair:", keypair);

    function encrypt_and_prepend_nonce(message) {
        let nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
        console.log("nonce:", nonce);
        //console.log("nonce:", JSON.stringify(nonce));
        //console.log("typeof nonce:", typeof(nonce));
        let ciphertext = sodium.crypto_secretbox_easy(message, nonce, key);
        console.log("ciphertext:", ciphertext);
        return {nonce: nonce,ciphertext: ciphertext};
    }

    function decrypt_after_extracting_nonce(nonce_and_ciphertext) {
        if (nonce_and_ciphertext.length < sodium.crypto_secretbox_NONCEBYTES + sodium.crypto_secretbox_MACBYTES) {
            throw "Short message";
        }
        //let nonce = nonce_and_ciphertext.slice(0, sodium.crypto_secretbox_NONCEBYTES),
            //ciphertext = nonce_and_ciphertext.slice(sodium.crypto_secretbox_NONCEBYTES);
        let nonce = nonce_and_ciphertext.nonce;
        let ciphertext = nonce_and_ciphertext.ciphertext;
        return sodium.crypto_secretbox_open_easy(ciphertext, nonce, key);
    }

    let msg = "If the output is a unique binary buffer, it is returned as a Uint8Array object.";
    let ret1 = encrypt_and_prepend_nonce(msg);
    console.log("ret1:", ret1);

    let ret2 = decrypt_after_extracting_nonce(ret1);
    console.log("ret2:", ret2);
    console.log("ret2:", sodium.to_string(ret2));
})();