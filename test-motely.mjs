import bootsharp, { MotelyWasmHost } from 'motely-wasm';

async function run() {
  console.log("Booting...");
  await bootsharp.boot();
  console.log("Booted.");
  
  console.log("Version:", MotelyWasmHost.getVersion());
}
run();
