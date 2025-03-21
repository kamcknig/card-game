// scripts/transform-shared.ts
import { join, dirname, fromFileUrl } from "https://deno.land/std@0.193.0/path/mod.ts";

const __dirname = dirname(fromFileUrl(import.meta.url));

const PROJECT_ROOT = join(__dirname, "..", "..");

// Optionally, force the working directory to the project root:
Deno.chdir(PROJECT_ROOT);

console.log("PROJECT_ROOT:", PROJECT_ROOT);
console.log("Current working directory:", Deno.cwd());

const SRC_DIR = join(PROJECT_ROOT, "server", "src", "shared");
const DEST_DIR = join(PROJECT_ROOT, "app", "src", "shared");

async function transformAndCopy(srcDir: string, destDir: string): Promise<void> {
    try {
        for await (const entry of Deno.readDir(srcDir)) {
            const srcPath = join(srcDir, entry.name);
            const destPath = join(destDir, entry.name);
            if (entry.isDirectory) {
                await Deno.mkdir(destPath, { recursive: true });
                await transformAndCopy(srcPath, destPath);
            } else if (entry.isFile && entry.name.endsWith(".ts")) {
                let content = await Deno.readTextFile(srcPath);
                // Remove .ts extension from any import statements.
                content = content.replace(/(from\s+["'][^"']+)(\.ts)(["'])/g, "$1$3");
                await Deno.mkdir(dirname(destPath), { recursive: true });
                await Deno.writeTextFile(destPath, content);
                console.log(`Transformed: ${srcPath} -> ${destPath}`);
            }
        }
    } catch (err) {
        console.error("Error transforming shared files:", err);
    }
}

async function initialTransform() {
    console.log("Performing initial transform...");
    await transformAndCopy(SRC_DIR, DEST_DIR);
    console.log("Initial transform complete.");
}

async function watchSharedFiles() {
    console.log(`Watching for changes in ${SRC_DIR} ...`);
    const watcher = Deno.watchFs(SRC_DIR, { recursive: true });
    for await (const event of watcher) {
        console.log("File system event:", event);
        // On any change event, re-run the transformation.
        await transformAndCopy(SRC_DIR, DEST_DIR);
        console.log("Transformation complete for updated files.");
    }
}

await initialTransform();
await watchSharedFiles();
