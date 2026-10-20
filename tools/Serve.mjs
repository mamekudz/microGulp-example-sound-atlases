import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Build} from './Build.mjs';
await Build();
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public');
http.createServer(async (request,response)=>{
 try {
  const url=new URL(request.url,'http://localhost');
  const fixtures={'/test/bad-json':['application/json','{broken'],'/test/bad-audio':['audio/wav','not audio'],'/test/bad-loop':['application/json',JSON.stringify({schemaVersion:1,sounds:{loop:[0,0.2,0.3,0.1]}})]};
  if(fixtures[url.pathname]){response.setHeader('Content-Type',fixtures[url.pathname][0]);response.end(fixtures[url.pathname][1]);return;}
  const name=path.resolve(ROOT,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(!name.startsWith(ROOT+path.sep))throw Error('PATH');
  const data=await fs.readFile(name);response.setHeader('Cache-Control','no-store');
  response.setHeader('Content-Type',({'.mjs':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.wav':'audio/wav','.weba':'audio/webm'})[path.extname(name)]??'application/octet-stream');response.end(data);
 }catch{response.statusCode=404;response.end('Not found');}
}).listen(Number(process.env.PORT||9438),'127.0.0.1',()=>console.log('Sound atlas demo: http://127.0.0.1:'+(process.env.PORT||9438)+'/'));
