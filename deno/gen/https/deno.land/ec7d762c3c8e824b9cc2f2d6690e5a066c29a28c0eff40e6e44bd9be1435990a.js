/**
 * @example
 * import { Server } from "https://deno.land/x/socket_io@x.y.z/mod.ts";
 *
 * const io = new Server();
 *
 * io.on("connection", (socket) => {
 *   console.log(`socket ${socket.id} connected`);
 *
 *   // send an event to the client
 *   socket.emit("foo", "bar");
 *
 *   socket.on("foobar", () => {
 *     // an event was received from the client
 *   });
 *
 *   // upon disconnection
 *   socket.on("disconnect", (reason) => {
 *     console.log(`socket ${socket.id} disconnected due to ${reason}`);
 *   });
 * });
 *
 * Deno.serve({
 *   handler: io.handler(),
 *   port: 3000,
 * });
 */ export { Adapter, Server } from "./packages/socket.io/mod.ts";
/**
 * The Redis adapter, to broadcast packets between several Socket.IO servers
 *
 * Documentation: https://socket.io/docs/v4/redis-adapter/
 *
 * @example
 * import { Server, createRedisAdapter, createRedisClient } from "https://deno.land/x/socket_io/mod.ts";
 *
 * const [pubClient, subClient] = await Promise.all([
 *   createRedisClient({
 *     hostname: "localhost",
 *   }),
 *   createRedisClient({
 *     hostname: "localhost",
 *   })
 * ]);
 *
 * const io = new Server({
 *     adapter: createRedisAdapter(pubClient, subClient)
 * });
 *
 * Deno.serve({
 *   handler: io.handler(),
 *   port: 3000
 * });
 */ export { createAdapter as createRedisAdapter } from "./packages/socket.io-redis-adapter/mod.ts";
/**
 * Temporary export to provide a workaround for https://github.com/denodrivers/redis/issues/335
 */ export { connect as createRedisClient } from "./vendor/deno.land/x/redis@v0.27.1/mod.ts";
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvc29ja2V0X2lvQDAuMi4xL21vZC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBleGFtcGxlXG4gKiBpbXBvcnQgeyBTZXJ2ZXIgfSBmcm9tIFwiaHR0cHM6Ly9kZW5vLmxhbmQveC9zb2NrZXRfaW9AeC55LnovbW9kLnRzXCI7XG4gKlxuICogY29uc3QgaW8gPSBuZXcgU2VydmVyKCk7XG4gKlxuICogaW8ub24oXCJjb25uZWN0aW9uXCIsIChzb2NrZXQpID0+IHtcbiAqICAgY29uc29sZS5sb2coYHNvY2tldCAke3NvY2tldC5pZH0gY29ubmVjdGVkYCk7XG4gKlxuICogICAvLyBzZW5kIGFuIGV2ZW50IHRvIHRoZSBjbGllbnRcbiAqICAgc29ja2V0LmVtaXQoXCJmb29cIiwgXCJiYXJcIik7XG4gKlxuICogICBzb2NrZXQub24oXCJmb29iYXJcIiwgKCkgPT4ge1xuICogICAgIC8vIGFuIGV2ZW50IHdhcyByZWNlaXZlZCBmcm9tIHRoZSBjbGllbnRcbiAqICAgfSk7XG4gKlxuICogICAvLyB1cG9uIGRpc2Nvbm5lY3Rpb25cbiAqICAgc29ja2V0Lm9uKFwiZGlzY29ubmVjdFwiLCAocmVhc29uKSA9PiB7XG4gKiAgICAgY29uc29sZS5sb2coYHNvY2tldCAke3NvY2tldC5pZH0gZGlzY29ubmVjdGVkIGR1ZSB0byAke3JlYXNvbn1gKTtcbiAqICAgfSk7XG4gKiB9KTtcbiAqXG4gKiBEZW5vLnNlcnZlKHtcbiAqICAgaGFuZGxlcjogaW8uaGFuZGxlcigpLFxuICogICBwb3J0OiAzMDAwLFxuICogfSk7XG4gKi9cbmV4cG9ydCB7XG4gIEFkYXB0ZXIsXG4gIHR5cGUgQnJvYWRjYXN0T3B0aW9ucyxcbiAgdHlwZSBOYW1lc3BhY2UsXG4gIFNlcnZlcixcbiAgdHlwZSBTZXJ2ZXJPcHRpb25zLFxuICB0eXBlIFNvY2tldCxcbn0gZnJvbSBcIi4vcGFja2FnZXMvc29ja2V0LmlvL21vZC50c1wiO1xuXG4vKipcbiAqIFRoZSBSZWRpcyBhZGFwdGVyLCB0byBicm9hZGNhc3QgcGFja2V0cyBiZXR3ZWVuIHNldmVyYWwgU29ja2V0LklPIHNlcnZlcnNcbiAqXG4gKiBEb2N1bWVudGF0aW9uOiBodHRwczovL3NvY2tldC5pby9kb2NzL3Y0L3JlZGlzLWFkYXB0ZXIvXG4gKlxuICogQGV4YW1wbGVcbiAqIGltcG9ydCB7IFNlcnZlciwgY3JlYXRlUmVkaXNBZGFwdGVyLCBjcmVhdGVSZWRpc0NsaWVudCB9IGZyb20gXCJodHRwczovL2Rlbm8ubGFuZC94L3NvY2tldF9pby9tb2QudHNcIjtcbiAqXG4gKiBjb25zdCBbcHViQ2xpZW50LCBzdWJDbGllbnRdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICogICBjcmVhdGVSZWRpc0NsaWVudCh7XG4gKiAgICAgaG9zdG5hbWU6IFwibG9jYWxob3N0XCIsXG4gKiAgIH0pLFxuICogICBjcmVhdGVSZWRpc0NsaWVudCh7XG4gKiAgICAgaG9zdG5hbWU6IFwibG9jYWxob3N0XCIsXG4gKiAgIH0pXG4gKiBdKTtcbiAqXG4gKiBjb25zdCBpbyA9IG5ldyBTZXJ2ZXIoe1xuICogICAgIGFkYXB0ZXI6IGNyZWF0ZVJlZGlzQWRhcHRlcihwdWJDbGllbnQsIHN1YkNsaWVudClcbiAqIH0pO1xuICpcbiAqIERlbm8uc2VydmUoe1xuICogICBoYW5kbGVyOiBpby5oYW5kbGVyKCksXG4gKiAgIHBvcnQ6IDMwMDBcbiAqIH0pO1xuICovXG5leHBvcnQge1xuICBjcmVhdGVBZGFwdGVyIGFzIGNyZWF0ZVJlZGlzQWRhcHRlcixcbiAgdHlwZSBSZWRpc0FkYXB0ZXJPcHRpb25zLFxufSBmcm9tIFwiLi9wYWNrYWdlcy9zb2NrZXQuaW8tcmVkaXMtYWRhcHRlci9tb2QudHNcIjtcblxuLyoqXG4gKiBUZW1wb3JhcnkgZXhwb3J0IHRvIHByb3ZpZGUgYSB3b3JrYXJvdW5kIGZvciBodHRwczovL2dpdGh1Yi5jb20vZGVub2RyaXZlcnMvcmVkaXMvaXNzdWVzLzMzNVxuICovXG5leHBvcnQgeyBjb25uZWN0IGFzIGNyZWF0ZVJlZGlzQ2xpZW50IH0gZnJvbSBcIi4vdmVuZG9yL2Rlbm8ubGFuZC94L3JlZGlzQHYwLjI3LjEvbW9kLnRzXCI7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBMEJDLEdBQ0QsU0FDRSxPQUFPLEVBR1AsTUFBTSxRQUdELDhCQUE4QjtBQUVyQzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQXlCQyxHQUNELFNBQ0UsaUJBQWlCLGtCQUFrQixRQUU5Qiw0Q0FBNEM7QUFFbkQ7O0NBRUMsR0FDRCxTQUFTLFdBQVcsaUJBQWlCLFFBQVEsNENBQTRDIn0=
// denoCacheMetadata=7432438394797226998,13291204933557184958