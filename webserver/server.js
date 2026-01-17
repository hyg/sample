const http = require('http');
const fs = require('fs');
const path = require('path');
const server = http.createServer((req, res) => {
 if (req.method === 'GET' && req.url === '/') {
   const htmlPath = path.join(__dirname, 'public', 'local.3.html');
   fs.readFile(htmlPath, (err, content) => {
     if (err) {
       res.writeHead(500);
       return res.end('Server Error');
     }
     res.writeHead(200, { 'Content-Type': 'text/html' });
     res.end(content);
   });
 } else {
   res.writeHead(404);
   res.end('404 Not Found');
 }
});
server.listen(6409, () => {
 console.log('Server running at http://localhost:6409');
});