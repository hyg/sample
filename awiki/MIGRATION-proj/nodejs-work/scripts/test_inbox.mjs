import axios from 'axios';
import { readFileSync } from 'fs';

const cred = JSON.parse(readFileSync('./.credentials/testnodefix9.json', 'utf-8'));
const jwt = cred.jwt_token;

if (!jwt) {
    console.log('No JWT token found');
    process.exit(1);
}

const response = await axios.get('https://awiki.ai/message/inbox', {
    headers: { 'Authorization': `Bearer ${jwt}` }
});

console.log('Inbox:', JSON.stringify(response.data, null, 2));
