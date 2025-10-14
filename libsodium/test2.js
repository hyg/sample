import _sodium from 'libsodium-wrappers';
await (async () => {
    await _sodium.ready;
    const sodium = _sodium;

    let hex1 = "830007992e8f501f349e385eac8e232aa3b33b97086bf9cc79b19883927bea33";
    let header1_hex = "c16669a4b36f928fed17dfeda6fa9271bc2af0aa57af6b3d";
    let c1_hex = "cb8b518da0b60e20dbd317a59e51d5ad7ab32fc2c5d77913fec8c74d2fd26ec6925b2fe99cf8f35cb8cb7bc9b5fdb40f9fdf9b5b42c0cccf0a20fbe15a1b30a4169522423e997e04ead5e4c833001024ff6191aa6a1d21dab3a80b986b779f5c";
    let c2_hex = "f98ec6c7274a7be54d4a3e5ddb17c9ea78826185aac1378cc681b9a1339fbbb09a4c9a9d94db573e2d561eb80ec1091f95e2b4a9de3b36504aa1203ee1c0b06318a4f77f51551ba16c33e164d2f40122a3d208567166f01b43adc198febd975d381a8961c3157143282666844890fb919e1fb06471f3e7204e41506ba928cedf460e758f8be9c97917277170316ed6f9b273def833132ea769da54fc78e92f538c0a52bf5cfbd0a87d13a90e2c9309c5574beaedf892cc5fbee17feefb208114b40d606c45dfa60f72afee9027a82dd9f6dacb644dd1a232e2c0";
    let header1 = sodium.from_hex(header1_hex);
    let c1 = sodium.from_hex(c1_hex);
    let c2 = sodium.from_hex(c2_hex);

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