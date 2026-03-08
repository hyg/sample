const sig = 'MEQCID4NH66JDIUSBgzJ4DyDOe9AftcwhP5lVTEx5uB4QEB0AiA_P4WUAS1h8HrwF2oAE0gmQLUazWbxU9QJ29025cs1xA';
const buf = Buffer.from(sig, 'base64');
console.log('Decoded length:', buf.length);
console.log('First byte:', buf[0].toString(16));
console.log('Is DER (30)?:', buf[0] === 0x30);
