import bootsharp, { MotelyWasmHost } from 'motely-wasm';
console.log("Imported");
await bootsharp.boot();
console.log("Booted");
console.log("Version:", MotelyWasmHost.getVersion());
