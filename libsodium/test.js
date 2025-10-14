import _sodium from 'libsodium-wrappers';
await (async () => {
    await _sodium.ready;
    const sodium = _sodium;

    let key1 = sodium.crypto_secretstream_xchacha20poly1305_keygen();
    let hex1 = sodium.to_hex(key1);
    console.log("key1:", key1);
    console.log("hex1:", hex1);

    let res1 = sodium.crypto_secretstream_xchacha20poly1305_init_push(key1);
    let [state_out1, header1] = [res1.state, res1.header];

    console.log("state_out1:", state_out1);
    console.log("header1:", header1);

    let c1 = sodium.crypto_secretstream_xchacha20poly1305_push(state_out1,
        //sodium.from_string('message 1'), null,
        sodium.from_string('If the output is a unique binary buffer, it is returned as a Uint8Array object.'), null,
        sodium.crypto_secretstream_xchacha20poly1305_TAG_MESSAGE);
    let c2 = sodium.crypto_secretstream_xchacha20poly1305_push(state_out1,
        //sodium.from_string('message 2'), null,
        sodium.from_string('Binary input buffers should be Uint8Array objects. However, if a string is given instead, the wrappers will automatically convert the string to an array containing a UTF-8 representation of the string.'), null,
        sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL);

    console.log("state_out1:", state_out1);
    console.log("header1:", header1);
    console.log("header1 hex:", sodium.to_hex(header1));
    console.log("c1:", c1);
    console.log("c1 hex:", sodium.to_hex(c1));
    console.log("c2:", c2);
    console.log("c2 hex:", sodium.to_hex(c2));

    let key2 = sodium.from_hex(hex1);
    let hex2 = sodium.to_hex(key2);
    console.log("key2:", key2);
    console.log("hex2:", hex2);

    let res2 = sodium.crypto_secretstream_xchacha20poly1305_init_push(key2);
    let [state_out2, header2] = [res2.state, res2.header];
    //let state_in2 = sodium.crypto_secretstream_xchacha20poly1305_init_pull(header2, key2);
    let state_in2 = sodium.crypto_secretstream_xchacha20poly1305_init_pull(header1, key2);
    let r1 = sodium.crypto_secretstream_xchacha20poly1305_pull(state_in2, c1);
    let [m1, tag1] = [sodium.to_string(r1.message), r1.tag];
    let r2 = sodium.crypto_secretstream_xchacha20poly1305_pull(state_in2, c2);
    let [m2, tag2] = [sodium.to_string(r2.message), r2.tag];
    console.log("state_out2:", state_out2);
    console.log("state_in2:", state_in2);
    console.log("header2:", header2);

    console.log("m1:", m1);
    console.log("m2:", m2);
})();