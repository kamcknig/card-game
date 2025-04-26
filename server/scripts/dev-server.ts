// scripts/dev-server.ts
Deno.chdir("./dist"); // change working directory to dist

// then run your server
await import("../src/server.ts");