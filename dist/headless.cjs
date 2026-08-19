"use strict";Object.defineProperty(exports,Symbol.toStringTag,{value:"Module"});const l=require("./nodepod-BcMjJ5Am.cjs"),m=require("node:fs"),h=require("node:path"),v=require("node:url"),U=require("node:worker_threads"),A=require("node:http"),M=require("node:crypto"),p=require("node:fs/promises"),O=require("node:os");var S=typeof document<"u"?document.currentScript:null;function I(){return`"use strict";
const { parentPort, workerData } = require("node:worker_threads");
if (!parentPort) throw new Error("nodepod worker shim: missing parentPort");

const messageListeners = new Set();
const errorListeners = new Set();

function emitMessage(data) {
  const ev = { data };
  for (const fn of messageListeners) {
    try { fn(ev); } catch (err) { console.error(err); }
  }
  if (typeof globalThis.onmessage === "function") {
    try { globalThis.onmessage(ev); } catch (err) { console.error(err); }
  }
}

globalThis.self = globalThis;
globalThis.postMessage = function postMessage(data, transfer) {
  if (Array.isArray(transfer) && transfer.length) {
    parentPort.postMessage(data, transfer);
  } else {
    parentPort.postMessage(data);
  }
};
globalThis.addEventListener = function addEventListener(type, fn) {
  if (type === "message") messageListeners.add(fn);
  else if (type === "error") errorListeners.add(fn);
};
globalThis.removeEventListener = function removeEventListener(type, fn) {
  if (type === "message") messageListeners.delete(fn);
  else if (type === "error") errorListeners.delete(fn);
};
globalThis.onmessage = null;
globalThis.onerror = null;

parentPort.on("message", function (data) { emitMessage(data); });
parentPort.on("error", function (err) {
  const ev = { message: err && err.message ? err.message : String(err), error: err };
  for (const fn of errorListeners) {
    try { fn(ev); } catch (_) { /* ignore */ }
  }
  if (typeof globalThis.onerror === "function") {
    try { globalThis.onerror(ev); } catch (_) { /* ignore */ }
  }
});

const source = workerData && workerData.__nodepodSource;
if (typeof source !== "string" || !source) {
  throw new Error("nodepod worker shim: missing __nodepodSource");
}
(0, eval)(source);
`}function W(t){const s=new Set,a=new Set;let i=null,r=null;return t.on("message",e=>{const o={data:e};for(const u of s)try{u(o)}catch{}if(i)try{i(o)}catch{}}),t.on("error",e=>{const o={message:e.message,error:e};for(const u of a)try{u(o)}catch{}if(r)try{r(o)}catch{}}),{postMessage(e,o){o&&o.length?t.postMessage(e,o):t.postMessage(e)},terminate(){t.terminate()},addEventListener(e,o){e==="message"?s.add(o):e==="error"&&a.add(o)},removeEventListener(e,o){e==="message"?s.delete(o):e==="error"&&a.delete(o)},get onmessage(){return i},set onmessage(e){i=e},get onerror(){return r},set onerror(e){r=e}}}function w(t,s){const a=new U.Worker(I(),{eval:!0,workerData:{__nodepodSource:t},...s?{name:s}:{}});return W(a)}function R(t){const s=t.host??"127.0.0.1",a=t.port??0;let i=null,r=null;async function c(u){const n=[];for await(const f of u)n.push(Buffer.isBuffer(f)?f:Buffer.from(f));return Buffer.concat(n)}function e(u){const n={};for(const[f,d]of Object.entries(u))d!=null&&(n[f]=Array.isArray(d)?d.join(", "):d);return n}async function o(u,n){try{const f=new URL(u.url||"/",`http://${s}`),d=f.pathname.split("/").filter(Boolean);if(d[0]!=="__virtual__"||d.length<3){n.statusCode=404,n.setHeader("Content-Type","text/plain"),n.end("Not Found");return}const j=d[1],P=Number(d[2]);if(!Number.isFinite(P)){n.statusCode=400,n.setHeader("Content-Type","text/plain"),n.end("Invalid port");return}const g=await c(u),B=g.byteLength>0?g.buffer.slice(g.byteOffset,g.byteOffset+g.byteLength):void 0,L=d.slice(3),F=(L.length?`/${L.join("/")}`:"/")+f.search,y=await t.proxy.handleRequest(j,P,(u.method||"GET").toUpperCase(),F,e(u.headers),B);n.statusCode=y.statusCode;for(const[N,b]of Object.entries(y.headers))b!=null&&(Array.isArray(b),n.setHeader(N,b));const x=y.body?Buffer.isBuffer(y.body)?y.body:Buffer.from(y.body):Buffer.alloc(0);n.end(x)}catch(f){n.statusCode=500,n.setHeader("Content-Type","text/plain"),n.end(f instanceof Error?f.message:String(f))}}return{kind:"local-http",get baseUrl(){return r},async start(){if(i)return;i=A.createServer((n,f)=>{o(n,f)}),await new Promise((n,f)=>{i.once("error",f),i.listen(a,s,()=>{i.off("error",f),n()})});const u=i.address();u&&typeof u=="object"?r=`http://${s}:${u.port}`:r=`http://${s}`,t.proxy.setBaseUrl(r)},async stop(){const u=i;i=null,r=null,u&&await new Promise(n=>{u.close(()=>n())})}}}const _=2,k=7*24*60*60*1e3;function q(){return process.env.NODEPOD_CACHE||h.join(O.tmpdir(),"nodepod-snapshots")}function E(t,s){const a=M.createHash("sha256").update(s).digest("hex");return h.join(t,`${a}.bin`)}async function H(t=q()){try{await p.mkdir(t,{recursive:!0})}catch{return null}return(async()=>{try{const s=await p.readdir(t),a=Date.now();for(const i of s)if(i.endsWith(".meta.json"))try{const r=await p.readFile(h.join(t,i),"utf8"),c=JSON.parse(r);if(c.schema!==_||c.createdAt!=null&&a-c.createdAt>k){const e=i.slice(0,-10);await p.unlink(h.join(t,i)).catch(()=>{}),await p.unlink(h.join(t,`${e}.bin`)).catch(()=>{})}}catch{}}catch{}})(),{async get(s){try{const a=E(t,s),i=a.replace(/\.bin$/,".meta.json"),r=await p.readFile(i,"utf8"),c=JSON.parse(r);if(c.schema!==_||c.createdAt!=null&&Date.now()-c.createdAt>k)return null;const e=await p.readFile(a);if(e.byteLength<4)return null;const o=e.readUInt32LE(0),u=e.subarray(4,4+o),n=e.buffer.slice(e.byteOffset+4+o,e.byteOffset+e.byteLength);return{manifest:JSON.parse(u.toString("utf8")),data:n}}catch{return null}},async set(s,a){const i=E(t,s),r=i.replace(/\.bin$/,".meta.json"),c=Buffer.from(JSON.stringify(a.manifest),"utf8"),e=Buffer.from(a.data),o=Buffer.alloc(4);o.writeUInt32LE(c.byteLength,0),await p.writeFile(i,Buffer.concat([o,c,e])),await p.writeFile(r,JSON.stringify({schema:_,createdAt:Date.now()}))},close(){}}}function C(){try{const t=h.dirname(v.fileURLToPath(typeof document>"u"?require("url").pathToFileURL(__filename).href:S&&S.tagName.toUpperCase()==="SCRIPT"&&S.src||new URL("headless.cjs",document.baseURI).href)),s=[h.join(t,"..","..","__worker__.js"),h.join(t,"..","..","..","dist","__worker__.js"),h.join(process.cwd(),"dist","__worker__.js")];for(const a of s)if(m.existsSync(a))return a}catch{}return null}function D(){const t=Buffer.from(l.PROCESS_WORKER_BUNDLE_GZIP_BASE64,"base64");return l.ungzip_1(t,{to:"string"})}function $(t,s){return!s&&t&&m.existsSync(t)||t&&m.existsSync(t)?m.readFileSync(t,"utf8"):D()}function T(t={}){let s=t.workerPath??C(),a=null;function i(r){if(!r&&a)return a;const c=$(s,!!r);return r||(a=c),c}return{kind:"node",defaultHeadless:!0,canCreateWorkers(){return!0},createWorker(r){if(r.type==="url"){let o=r.url;if(o.startsWith("file:")&&(o=v.fileURLToPath(o)),!m.existsSync(o))throw new Error(`[Nodepod] Node host cannot load worker URL: ${r.url}`);const u=m.readFileSync(o,"utf8"),n=w(u,r.name);return n.__nodepodDirect=!0,n}if(r.type==="source")return w(r.source,r.name);const c=i(r.embedded),e=w(c,r.name);return s&&!r.embedded&&(e.__nodepodDirect=!0),e},async probeProcessWorkerUrl(r){if(r){let e=r;return e.startsWith("file:")&&(e=v.fileURLToPath(e)),m.existsSync(e)?(s=e,a=null,e):null}const c=C();return c?(s=c,a=null,c):null},disposeGlobalResources(){a=null},async openSnapshotCache(r){return r.enableSnapshotCache===!1||r.packageStore==="memory"?null:H(t.cacheDir)},createHttpIngress({proxy:r,headless:c}){return c?R({proxy:r,host:t.httpHost,port:t.httpPort}):{kind:"programmatic",baseUrl:null}}}}l.setRuntimeHost(T());exports.DependencyInstaller=l.DependencyInstaller;exports.MemoryVolume=l.MemoryVolume;exports.Nodepod=l.Nodepod;exports.NodepodFS=l.NodepodFS;exports.NodepodFSClient=l.NodepodFSClient;exports.NodepodFSClientError=l.NodepodFSClientError;exports.NodepodProcess=l.NodepodProcess;exports.NodepodSWSetupError=l.NodepodSWSetupError;exports.RequestProxy=l.RequestProxy;exports.discoverWorkspaces=l.discoverWorkspaces;exports.getProxyInstance=l.getProxyInstance;exports.getRuntimeHost=l.getRuntimeHost;exports.install=l.install;exports.readWorkspacePatterns=l.readWorkspacePatterns;exports.resetProxy=l.resetProxy;exports.resetRuntimeHost=l.resetRuntimeHost;exports.setRuntimeHost=l.setRuntimeHost;exports.createLocalHttpIngress=R;exports.createNodeHost=T;exports.openFsSnapshotCache=H;
//# sourceMappingURL=headless.cjs.map
