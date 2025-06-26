// scripts/transform-shared.ts
import { join, dirname, fromFileUrl } from "https://deno.land/std@0.193.0/path/mod.ts";
const __dirname = dirname(fromFileUrl(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..", "..");
// Optionally, force the working directory to the project root:
Deno.chdir(PROJECT_ROOT);
console.log("PROJECT_ROOT:", PROJECT_ROOT);
console.log("Current working directory:", Deno.cwd());
const SRC_DIR = join(PROJECT_ROOT, "server", "src", "shared");
const DEST_DIR = join(PROJECT_ROOT, "angular-frontend", "src", "app", "shared");
async function transformAndCopy(srcDir, destDir) {
  try {
    for await (const entry of Deno.readDir(srcDir)){
      const srcPath = join(srcDir, entry.name);
      const destPath = join(destDir, entry.name);
      if (entry.isDirectory) {
        await Deno.mkdir(destPath, {
          recursive: true
        });
        await transformAndCopy(srcPath, destPath);
      } else if (entry.isFile && entry.name.endsWith(".ts")) {
        let content = await Deno.readTextFile(srcPath);
        // Remove .ts extension from any import statements.
        content = content.replace(/(from\s+["'][^"']+)(\.ts)(["'])/g, "$1$3");
        await Deno.mkdir(dirname(destPath), {
          recursive: true
        });
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
  const watcher = Deno.watchFs(SRC_DIR, {
    recursive: true
  });
  for await (const event of watcher){
    console.log("File system event:", event);
    // On any change event, re-run the transformation.
    await transformAndCopy(SRC_DIR, DEST_DIR);
    console.log("Transformation complete for updated files.");
  }
}
await initialTransform();
await watchSharedFiles();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZpbGU6Ly8vYXBwL3NlcnZlci9zY3JpcHRzL2NvcHktc2hhcmVkLXNvdXJjZXMudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gc2NyaXB0cy90cmFuc2Zvcm0tc2hhcmVkLnRzXG5pbXBvcnQgeyBqb2luLCBkaXJuYW1lLCBmcm9tRmlsZVVybCB9IGZyb20gXCJodHRwczovL2Rlbm8ubGFuZC9zdGRAMC4xOTMuMC9wYXRoL21vZC50c1wiO1xuXG5jb25zdCBfX2Rpcm5hbWUgPSBkaXJuYW1lKGZyb21GaWxlVXJsKGltcG9ydC5tZXRhLnVybCkpO1xuXG5jb25zdCBQUk9KRUNUX1JPT1QgPSBqb2luKF9fZGlybmFtZSwgXCIuLlwiLCBcIi4uXCIpO1xuXG4vLyBPcHRpb25hbGx5LCBmb3JjZSB0aGUgd29ya2luZyBkaXJlY3RvcnkgdG8gdGhlIHByb2plY3Qgcm9vdDpcbkRlbm8uY2hkaXIoUFJPSkVDVF9ST09UKTtcblxuY29uc29sZS5sb2coXCJQUk9KRUNUX1JPT1Q6XCIsIFBST0pFQ1RfUk9PVCk7XG5jb25zb2xlLmxvZyhcIkN1cnJlbnQgd29ya2luZyBkaXJlY3Rvcnk6XCIsIERlbm8uY3dkKCkpO1xuXG5jb25zdCBTUkNfRElSID0gam9pbihQUk9KRUNUX1JPT1QsIFwic2VydmVyXCIsIFwic3JjXCIsIFwic2hhcmVkXCIpO1xuY29uc3QgREVTVF9ESVIgPSBqb2luKFBST0pFQ1RfUk9PVCwgXCJhbmd1bGFyLWZyb250ZW5kXCIsIFwic3JjXCIsIFwiYXBwXCIsIFwic2hhcmVkXCIpO1xuXG5hc3luYyBmdW5jdGlvbiB0cmFuc2Zvcm1BbmRDb3B5KHNyY0Rpcjogc3RyaW5nLCBkZXN0RGlyOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0cnkge1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGVudHJ5IG9mIERlbm8ucmVhZERpcihzcmNEaXIpKSB7XG4gICAgICAgICAgICBjb25zdCBzcmNQYXRoID0gam9pbihzcmNEaXIsIGVudHJ5Lm5hbWUpO1xuICAgICAgICAgICAgY29uc3QgZGVzdFBhdGggPSBqb2luKGRlc3REaXIsIGVudHJ5Lm5hbWUpO1xuICAgICAgICAgICAgaWYgKGVudHJ5LmlzRGlyZWN0b3J5KSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgRGVuby5ta2RpcihkZXN0UGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgYXdhaXQgdHJhbnNmb3JtQW5kQ29weShzcmNQYXRoLCBkZXN0UGF0aCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGVudHJ5LmlzRmlsZSAmJiBlbnRyeS5uYW1lLmVuZHNXaXRoKFwiLnRzXCIpKSB7XG4gICAgICAgICAgICAgICAgbGV0IGNvbnRlbnQgPSBhd2FpdCBEZW5vLnJlYWRUZXh0RmlsZShzcmNQYXRoKTtcbiAgICAgICAgICAgICAgICAvLyBSZW1vdmUgLnRzIGV4dGVuc2lvbiBmcm9tIGFueSBpbXBvcnQgc3RhdGVtZW50cy5cbiAgICAgICAgICAgICAgICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKC8oZnJvbVxccytbXCInXVteXCInXSspKFxcLnRzKShbXCInXSkvZywgXCIkMSQzXCIpO1xuICAgICAgICAgICAgICAgIGF3YWl0IERlbm8ubWtkaXIoZGlybmFtZShkZXN0UGF0aCksIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgIGF3YWl0IERlbm8ud3JpdGVUZXh0RmlsZShkZXN0UGF0aCwgY29udGVudCk7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFRyYW5zZm9ybWVkOiAke3NyY1BhdGh9IC0+ICR7ZGVzdFBhdGh9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIHRyYW5zZm9ybWluZyBzaGFyZWQgZmlsZXM6XCIsIGVycik7XG4gICAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBpbml0aWFsVHJhbnNmb3JtKCkge1xuICAgIGNvbnNvbGUubG9nKFwiUGVyZm9ybWluZyBpbml0aWFsIHRyYW5zZm9ybS4uLlwiKTtcbiAgICBhd2FpdCB0cmFuc2Zvcm1BbmRDb3B5KFNSQ19ESVIsIERFU1RfRElSKTtcbiAgICBjb25zb2xlLmxvZyhcIkluaXRpYWwgdHJhbnNmb3JtIGNvbXBsZXRlLlwiKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gd2F0Y2hTaGFyZWRGaWxlcygpIHtcbiAgICBjb25zb2xlLmxvZyhgV2F0Y2hpbmcgZm9yIGNoYW5nZXMgaW4gJHtTUkNfRElSfSAuLi5gKTtcbiAgICBjb25zdCB3YXRjaGVyID0gRGVuby53YXRjaEZzKFNSQ19ESVIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgIGZvciBhd2FpdCAoY29uc3QgZXZlbnQgb2Ygd2F0Y2hlcikge1xuICAgICAgICBjb25zb2xlLmxvZyhcIkZpbGUgc3lzdGVtIGV2ZW50OlwiLCBldmVudCk7XG4gICAgICAgIC8vIE9uIGFueSBjaGFuZ2UgZXZlbnQsIHJlLXJ1biB0aGUgdHJhbnNmb3JtYXRpb24uXG4gICAgICAgIGF3YWl0IHRyYW5zZm9ybUFuZENvcHkoU1JDX0RJUiwgREVTVF9ESVIpO1xuICAgICAgICBjb25zb2xlLmxvZyhcIlRyYW5zZm9ybWF0aW9uIGNvbXBsZXRlIGZvciB1cGRhdGVkIGZpbGVzLlwiKTtcbiAgICB9XG59XG5cbmF3YWl0IGluaXRpYWxUcmFuc2Zvcm0oKTtcbmF3YWl0IHdhdGNoU2hhcmVkRmlsZXMoKTtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSw4QkFBOEI7QUFDOUIsU0FBUyxJQUFJLEVBQUUsT0FBTyxFQUFFLFdBQVcsUUFBUSw0Q0FBNEM7QUFFdkYsTUFBTSxZQUFZLFFBQVEsWUFBWSxZQUFZLEdBQUc7QUFFckQsTUFBTSxlQUFlLEtBQUssV0FBVyxNQUFNO0FBRTNDLCtEQUErRDtBQUMvRCxLQUFLLEtBQUssQ0FBQztBQUVYLFFBQVEsR0FBRyxDQUFDLGlCQUFpQjtBQUM3QixRQUFRLEdBQUcsQ0FBQyw4QkFBOEIsS0FBSyxHQUFHO0FBRWxELE1BQU0sVUFBVSxLQUFLLGNBQWMsVUFBVSxPQUFPO0FBQ3BELE1BQU0sV0FBVyxLQUFLLGNBQWMsb0JBQW9CLE9BQU8sT0FBTztBQUV0RSxlQUFlLGlCQUFpQixNQUFjLEVBQUUsT0FBZTtFQUMzRCxJQUFJO0lBQ0EsV0FBVyxNQUFNLFNBQVMsS0FBSyxPQUFPLENBQUMsUUFBUztNQUM1QyxNQUFNLFVBQVUsS0FBSyxRQUFRLE1BQU0sSUFBSTtNQUN2QyxNQUFNLFdBQVcsS0FBSyxTQUFTLE1BQU0sSUFBSTtNQUN6QyxJQUFJLE1BQU0sV0FBVyxFQUFFO1FBQ25CLE1BQU0sS0FBSyxLQUFLLENBQUMsVUFBVTtVQUFFLFdBQVc7UUFBSztRQUM3QyxNQUFNLGlCQUFpQixTQUFTO01BQ3BDLE9BQU8sSUFBSSxNQUFNLE1BQU0sSUFBSSxNQUFNLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUTtRQUNuRCxJQUFJLFVBQVUsTUFBTSxLQUFLLFlBQVksQ0FBQztRQUN0QyxtREFBbUQ7UUFDbkQsVUFBVSxRQUFRLE9BQU8sQ0FBQyxvQ0FBb0M7UUFDOUQsTUFBTSxLQUFLLEtBQUssQ0FBQyxRQUFRLFdBQVc7VUFBRSxXQUFXO1FBQUs7UUFDdEQsTUFBTSxLQUFLLGFBQWEsQ0FBQyxVQUFVO1FBQ25DLFFBQVEsR0FBRyxDQUFDLENBQUMsYUFBYSxFQUFFLFFBQVEsSUFBSSxFQUFFLFVBQVU7TUFDeEQ7SUFDSjtFQUNKLEVBQUUsT0FBTyxLQUFLO0lBQ1YsUUFBUSxLQUFLLENBQUMsb0NBQW9DO0VBQ3REO0FBQ0o7QUFFQSxlQUFlO0VBQ1gsUUFBUSxHQUFHLENBQUM7RUFDWixNQUFNLGlCQUFpQixTQUFTO0VBQ2hDLFFBQVEsR0FBRyxDQUFDO0FBQ2hCO0FBRUEsZUFBZTtFQUNYLFFBQVEsR0FBRyxDQUFDLENBQUMsd0JBQXdCLEVBQUUsUUFBUSxJQUFJLENBQUM7RUFDcEQsTUFBTSxVQUFVLEtBQUssT0FBTyxDQUFDLFNBQVM7SUFBRSxXQUFXO0VBQUs7RUFDeEQsV0FBVyxNQUFNLFNBQVMsUUFBUztJQUMvQixRQUFRLEdBQUcsQ0FBQyxzQkFBc0I7SUFDbEMsa0RBQWtEO0lBQ2xELE1BQU0saUJBQWlCLFNBQVM7SUFDaEMsUUFBUSxHQUFHLENBQUM7RUFDaEI7QUFDSjtBQUVBLE1BQU07QUFDTixNQUFNIn0=
// denoCacheMetadata=14089993029624413715,17564940336794095562