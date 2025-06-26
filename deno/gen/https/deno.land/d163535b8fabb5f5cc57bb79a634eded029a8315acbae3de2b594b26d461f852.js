import { RedisConnection } from "./connection.ts";
import { MuxExecutor } from "./executor.ts";
import { createRedisPipeline } from "./pipeline.ts";
import { psubscribe, subscribe } from "./pubsub.ts";
import { convertMap, isCondArray, isNumber, isString, parseXGroupDetail, parseXId, parseXMessage, parseXPendingConsumers, parseXPendingCounts, parseXReadReply, rawnum, rawstr, xidstr } from "./stream.ts";
class RedisImpl {
  executor;
  get isClosed() {
    return this.executor.connection.isClosed;
  }
  get isConnected() {
    return this.executor.connection.isConnected;
  }
  constructor(executor){
    this.executor = executor;
  }
  sendCommand(command, ...args) {
    return this.executor.exec(command, ...args);
  }
  close() {
    this.executor.close();
  }
  async execReply(command, ...args) {
    const reply = await this.executor.exec(command, ...args);
    return reply.value();
  }
  async execStatusReply(command, ...args) {
    const reply = await this.executor.exec(command, ...args);
    return reply.value();
  }
  async execIntegerReply(command, ...args) {
    const reply = await this.executor.exec(command, ...args);
    return reply.value();
  }
  async execBinaryReply(command, ...args) {
    const reply = await this.executor.exec(command, ...args);
    return reply.buffer();
  }
  async execBulkReply(command, ...args) {
    const reply = await this.executor.exec(command, ...args);
    return reply.value();
  }
  async execArrayReply(command, ...args) {
    const reply = await this.executor.exec(command, ...args);
    return reply.value();
  }
  async execIntegerOrNilReply(command, ...args) {
    const reply = await this.executor.exec(command, ...args);
    return reply.value();
  }
  async execStatusOrNilReply(command, ...args) {
    const reply = await this.executor.exec(command, ...args);
    return reply.string();
  }
  aclCat(categoryname) {
    if (categoryname !== undefined) {
      return this.execArrayReply("ACL", "CAT", categoryname);
    }
    return this.execArrayReply("ACL", "CAT");
  }
  aclDelUser(...usernames) {
    return this.execIntegerReply("ACL", "DELUSER", ...usernames);
  }
  aclGenPass(bits) {
    if (bits !== undefined) {
      return this.execBulkReply("ACL", "GENPASS", bits);
    }
    return this.execBulkReply("ACL", "GENPASS");
  }
  aclGetUser(username) {
    return this.execArrayReply("ACL", "GETUSER", username);
  }
  aclHelp() {
    return this.execArrayReply("ACL", "HELP");
  }
  aclList() {
    return this.execArrayReply("ACL", "LIST");
  }
  aclLoad() {
    return this.execStatusReply("ACL", "LOAD");
  }
  aclLog(param) {
    if (param === "RESET") {
      return this.execStatusReply("ACL", "LOG", "RESET");
    }
    return this.execArrayReply("ACL", "LOG", param);
  }
  aclSave() {
    return this.execStatusReply("ACL", "SAVE");
  }
  aclSetUser(username, ...rules) {
    return this.execStatusReply("ACL", "SETUSER", username, ...rules);
  }
  aclUsers() {
    return this.execArrayReply("ACL", "USERS");
  }
  aclWhoami() {
    return this.execBulkReply("ACL", "WHOAMI");
  }
  append(key, value) {
    return this.execIntegerReply("APPEND", key, value);
  }
  auth(param1, param2) {
    if (param2 !== undefined) {
      return this.execStatusReply("AUTH", param1, param2);
    }
    return this.execStatusReply("AUTH", param1);
  }
  bgrewriteaof() {
    return this.execStatusReply("BGREWRITEAOF");
  }
  bgsave() {
    return this.execStatusReply("BGSAVE");
  }
  bitcount(key, start, end) {
    if (start !== undefined && end !== undefined) {
      return this.execIntegerReply("BITCOUNT", key, start, end);
    }
    return this.execIntegerReply("BITCOUNT", key);
  }
  bitfield(key, opts) {
    const args = [
      key
    ];
    if (opts?.get) {
      const { type, offset } = opts.get;
      args.push("GET", type, offset);
    }
    if (opts?.set) {
      const { type, offset, value } = opts.set;
      args.push("SET", type, offset, value);
    }
    if (opts?.incrby) {
      const { type, offset, increment } = opts.incrby;
      args.push("INCRBY", type, offset, increment);
    }
    if (opts?.overflow) {
      args.push("OVERFLOW", opts.overflow);
    }
    return this.execArrayReply("BITFIELD", ...args);
  }
  bitop(operation, destkey, ...keys) {
    return this.execIntegerReply("BITOP", operation, destkey, ...keys);
  }
  bitpos(key, bit, start, end) {
    if (start !== undefined && end !== undefined) {
      return this.execIntegerReply("BITPOS", key, bit, start, end);
    }
    if (start !== undefined) {
      return this.execIntegerReply("BITPOS", key, bit, start);
    }
    return this.execIntegerReply("BITPOS", key, bit);
  }
  blpop(timeout, ...keys) {
    return this.execArrayReply("BLPOP", ...keys, timeout);
  }
  brpop(timeout, ...keys) {
    return this.execArrayReply("BRPOP", ...keys, timeout);
  }
  brpoplpush(source, destination, timeout) {
    return this.execBulkReply("BRPOPLPUSH", source, destination, timeout);
  }
  bzpopmin(timeout, ...keys) {
    return this.execArrayReply("BZPOPMIN", ...keys, timeout);
  }
  bzpopmax(timeout, ...keys) {
    return this.execArrayReply("BZPOPMAX", ...keys, timeout);
  }
  clientCaching(mode) {
    return this.execStatusReply("CLIENT", "CACHING", mode);
  }
  clientGetName() {
    return this.execBulkReply("CLIENT", "GETNAME");
  }
  clientGetRedir() {
    return this.execIntegerReply("CLIENT", "GETREDIR");
  }
  clientID() {
    return this.execIntegerReply("CLIENT", "ID");
  }
  clientInfo() {
    return this.execBulkReply("CLIENT", "INFO");
  }
  clientKill(opts) {
    const args = [];
    if (opts.addr) {
      args.push("ADDR", opts.addr);
    }
    if (opts.laddr) {
      args.push("LADDR", opts.laddr);
    }
    if (opts.id) {
      args.push("ID", opts.id);
    }
    if (opts.type) {
      args.push("TYPE", opts.type);
    }
    if (opts.user) {
      args.push("USER", opts.user);
    }
    if (opts.skipme) {
      args.push("SKIPME", opts.skipme);
    }
    return this.execIntegerReply("CLIENT", "KILL", ...args);
  }
  clientList(opts) {
    if (opts && opts.type && opts.ids) {
      throw new Error("only one of `type` or `ids` can be specified");
    }
    if (opts && opts.type) {
      return this.execBulkReply("CLIENT", "LIST", "TYPE", opts.type);
    }
    if (opts && opts.ids) {
      return this.execBulkReply("CLIENT", "LIST", "ID", ...opts.ids);
    }
    return this.execBulkReply("CLIENT", "LIST");
  }
  clientPause(timeout, mode) {
    if (mode) {
      return this.execStatusReply("CLIENT", "PAUSE", timeout, mode);
    }
    return this.execStatusReply("CLIENT", "PAUSE", timeout);
  }
  clientSetName(connectionName) {
    return this.execStatusReply("CLIENT", "SETNAME", connectionName);
  }
  clientTracking(opts) {
    const args = [
      opts.mode
    ];
    if (opts.redirect) {
      args.push("REDIRECT", opts.redirect);
    }
    if (opts.prefixes) {
      opts.prefixes.forEach((prefix)=>{
        args.push("PREFIX");
        args.push(prefix);
      });
    }
    if (opts.bcast) {
      args.push("BCAST");
    }
    if (opts.optIn) {
      args.push("OPTIN");
    }
    if (opts.optOut) {
      args.push("OPTOUT");
    }
    if (opts.noLoop) {
      args.push("NOLOOP");
    }
    return this.execStatusReply("CLIENT", "TRACKING", ...args);
  }
  clientTrackingInfo() {
    return this.execArrayReply("CLIENT", "TRACKINGINFO");
  }
  clientUnblock(id, behaviour) {
    if (behaviour) {
      return this.execIntegerReply("CLIENT", "UNBLOCK", id, behaviour);
    }
    return this.execIntegerReply("CLIENT", "UNBLOCK", id);
  }
  clientUnpause() {
    return this.execStatusReply("CLIENT", "UNPAUSE");
  }
  asking() {
    return this.execStatusReply("ASKING");
  }
  clusterAddSlots(...slots) {
    return this.execStatusReply("CLUSTER", "ADDSLOTS", ...slots);
  }
  clusterCountFailureReports(nodeId) {
    return this.execIntegerReply("CLUSTER", "COUNT-FAILURE-REPORTS", nodeId);
  }
  clusterCountKeysInSlot(slot) {
    return this.execIntegerReply("CLUSTER", "COUNTKEYSINSLOT", slot);
  }
  clusterDelSlots(...slots) {
    return this.execStatusReply("CLUSTER", "DELSLOTS", ...slots);
  }
  clusterFailover(mode) {
    if (mode) {
      return this.execStatusReply("CLUSTER", "FAILOVER", mode);
    }
    return this.execStatusReply("CLUSTER", "FAILOVER");
  }
  clusterFlushSlots() {
    return this.execStatusReply("CLUSTER", "FLUSHSLOTS");
  }
  clusterForget(nodeId) {
    return this.execStatusReply("CLUSTER", "FORGET", nodeId);
  }
  clusterGetKeysInSlot(slot, count) {
    return this.execArrayReply("CLUSTER", "GETKEYSINSLOT", slot, count);
  }
  clusterInfo() {
    return this.execStatusReply("CLUSTER", "INFO");
  }
  clusterKeySlot(key) {
    return this.execIntegerReply("CLUSTER", "KEYSLOT", key);
  }
  clusterMeet(ip, port) {
    return this.execStatusReply("CLUSTER", "MEET", ip, port);
  }
  clusterMyID() {
    return this.execStatusReply("CLUSTER", "MYID");
  }
  clusterNodes() {
    return this.execBulkReply("CLUSTER", "NODES");
  }
  clusterReplicas(nodeId) {
    return this.execArrayReply("CLUSTER", "REPLICAS", nodeId);
  }
  clusterReplicate(nodeId) {
    return this.execStatusReply("CLUSTER", "REPLICATE", nodeId);
  }
  clusterReset(mode) {
    if (mode) {
      return this.execStatusReply("CLUSTER", "RESET", mode);
    }
    return this.execStatusReply("CLUSTER", "RESET");
  }
  clusterSaveConfig() {
    return this.execStatusReply("CLUSTER", "SAVECONFIG");
  }
  clusterSetSlot(slot, subcommand, nodeId) {
    if (nodeId !== undefined) {
      return this.execStatusReply("CLUSTER", "SETSLOT", slot, subcommand, nodeId);
    }
    return this.execStatusReply("CLUSTER", "SETSLOT", slot, subcommand);
  }
  clusterSlaves(nodeId) {
    return this.execArrayReply("CLUSTER", "SLAVES", nodeId);
  }
  clusterSlots() {
    return this.execArrayReply("CLUSTER", "SLOTS");
  }
  command() {
    return this.execArrayReply("COMMAND");
  }
  commandCount() {
    return this.execIntegerReply("COMMAND", "COUNT");
  }
  commandGetKeys() {
    return this.execArrayReply("COMMAND", "GETKEYS");
  }
  commandInfo(...commandNames) {
    return this.execArrayReply("COMMAND", "INFO", ...commandNames);
  }
  configGet(parameter) {
    return this.execArrayReply("CONFIG", "GET", parameter);
  }
  configResetStat() {
    return this.execStatusReply("CONFIG", "RESETSTAT");
  }
  configRewrite() {
    return this.execStatusReply("CONFIG", "REWRITE");
  }
  configSet(parameter, value) {
    return this.execStatusReply("CONFIG", "SET", parameter, value);
  }
  dbsize() {
    return this.execIntegerReply("DBSIZE");
  }
  debugObject(key) {
    return this.execStatusReply("DEBUG", "OBJECT", key);
  }
  debugSegfault() {
    return this.execStatusReply("DEBUG", "SEGFAULT");
  }
  decr(key) {
    return this.execIntegerReply("DECR", key);
  }
  decrby(key, decrement) {
    return this.execIntegerReply("DECRBY", key, decrement);
  }
  del(...keys) {
    return this.execIntegerReply("DEL", ...keys);
  }
  discard() {
    return this.execStatusReply("DISCARD");
  }
  dump(key) {
    return this.execBinaryReply("DUMP", key);
  }
  echo(message) {
    return this.execBulkReply("ECHO", message);
  }
  eval(script, keys, args) {
    return this.execReply("EVAL", script, keys.length, ...keys, ...args);
  }
  evalsha(sha1, keys, args) {
    return this.execReply("EVALSHA", sha1, keys.length, ...keys, ...args);
  }
  exec() {
    return this.execArrayReply("EXEC");
  }
  exists(...keys) {
    return this.execIntegerReply("EXISTS", ...keys);
  }
  expire(key, seconds) {
    return this.execIntegerReply("EXPIRE", key, seconds);
  }
  expireat(key, timestamp) {
    return this.execIntegerReply("EXPIREAT", key, timestamp);
  }
  flushall(async) {
    if (async) {
      return this.execStatusReply("FLUSHALL", "ASYNC");
    }
    return this.execStatusReply("FLUSHALL");
  }
  flushdb(async) {
    if (async) {
      return this.execStatusReply("FLUSHDB", "ASYNC");
    }
    return this.execStatusReply("FLUSHDB");
  }
  // deno-lint-ignore no-explicit-any
  geoadd(key, ...params) {
    const args = [
      key
    ];
    if (Array.isArray(params[0])) {
      args.push(...params.flatMap((e)=>e));
    } else if (typeof params[0] === "object") {
      for (const [member, lnglat] of Object.entries(params[0])){
        args.push(...lnglat, member);
      }
    } else {
      args.push(...params);
    }
    return this.execIntegerReply("GEOADD", ...args);
  }
  geohash(key, ...members) {
    return this.execArrayReply("GEOHASH", key, ...members);
  }
  geopos(key, ...members) {
    return this.execArrayReply("GEOPOS", key, ...members);
  }
  geodist(key, member1, member2, unit) {
    if (unit) {
      return this.execBulkReply("GEODIST", key, member1, member2, unit);
    }
    return this.execBulkReply("GEODIST", key, member1, member2);
  }
  georadius(key, longitude, latitude, radius, unit, opts) {
    const args = this.pushGeoRadiusOpts([
      key,
      longitude,
      latitude,
      radius,
      unit
    ], opts);
    return this.execArrayReply("GEORADIUS", ...args);
  }
  georadiusbymember(key, member, radius, unit, opts) {
    const args = this.pushGeoRadiusOpts([
      key,
      member,
      radius,
      unit
    ], opts);
    return this.execArrayReply("GEORADIUSBYMEMBER", ...args);
  }
  pushGeoRadiusOpts(args, opts) {
    if (opts?.withCoord) {
      args.push("WITHCOORD");
    }
    if (opts?.withDist) {
      args.push("WITHDIST");
    }
    if (opts?.withHash) {
      args.push("WITHHASH");
    }
    if (opts?.count !== undefined) {
      args.push(opts.count);
    }
    if (opts?.sort) {
      args.push(opts.sort);
    }
    if (opts?.store !== undefined) {
      args.push(opts.store);
    }
    if (opts?.storeDist !== undefined) {
      args.push(opts.storeDist);
    }
    return args;
  }
  get(key) {
    return this.execBulkReply("GET", key);
  }
  getbit(key, offset) {
    return this.execIntegerReply("GETBIT", key, offset);
  }
  getrange(key, start, end) {
    return this.execBulkReply("GETRANGE", key, start, end);
  }
  getset(key, value) {
    return this.execBulkReply("GETSET", key, value);
  }
  hdel(key, ...fields) {
    return this.execIntegerReply("HDEL", key, ...fields);
  }
  hexists(key, field) {
    return this.execIntegerReply("HEXISTS", key, field);
  }
  hget(key, field) {
    return this.execBulkReply("HGET", key, field);
  }
  hgetall(key) {
    return this.execArrayReply("HGETALL", key);
  }
  hincrby(key, field, increment) {
    return this.execIntegerReply("HINCRBY", key, field, increment);
  }
  hincrbyfloat(key, field, increment) {
    return this.execBulkReply("HINCRBYFLOAT", key, field, increment);
  }
  hkeys(key) {
    return this.execArrayReply("HKEYS", key);
  }
  hlen(key) {
    return this.execIntegerReply("HLEN", key);
  }
  hmget(key, ...fields) {
    return this.execArrayReply("HMGET", key, ...fields);
  }
  // deno-lint-ignore no-explicit-any
  hmset(key, ...params) {
    const args = [
      key
    ];
    if (Array.isArray(params[0])) {
      args.push(...params.flatMap((e)=>e));
    } else if (typeof params[0] === "object") {
      for (const [field, value] of Object.entries(params[0])){
        args.push(field, value);
      }
    } else {
      args.push(...params);
    }
    return this.execStatusReply("HMSET", ...args);
  }
  // deno-lint-ignore no-explicit-any
  hset(key, ...params) {
    const args = [
      key
    ];
    if (Array.isArray(params[0])) {
      args.push(...params.flatMap((e)=>e));
    } else if (typeof params[0] === "object") {
      for (const [field, value] of Object.entries(params[0])){
        args.push(field, value);
      }
    } else {
      args.push(...params);
    }
    return this.execIntegerReply("HSET", ...args);
  }
  hsetnx(key, field, value) {
    return this.execIntegerReply("HSETNX", key, field, value);
  }
  hstrlen(key, field) {
    return this.execIntegerReply("HSTRLEN", key, field);
  }
  hvals(key) {
    return this.execArrayReply("HVALS", key);
  }
  incr(key) {
    return this.execIntegerReply("INCR", key);
  }
  incrby(key, increment) {
    return this.execIntegerReply("INCRBY", key, increment);
  }
  incrbyfloat(key, increment) {
    return this.execBulkReply("INCRBYFLOAT", key, increment);
  }
  info(section) {
    if (section !== undefined) {
      return this.execStatusReply("INFO", section);
    }
    return this.execStatusReply("INFO");
  }
  keys(pattern) {
    return this.execArrayReply("KEYS", pattern);
  }
  lastsave() {
    return this.execIntegerReply("LASTSAVE");
  }
  lindex(key, index) {
    return this.execBulkReply("LINDEX", key, index);
  }
  linsert(key, loc, pivot, value) {
    return this.execIntegerReply("LINSERT", key, loc, pivot, value);
  }
  llen(key) {
    return this.execIntegerReply("LLEN", key);
  }
  lpop(key) {
    return this.execBulkReply("LPOP", key);
  }
  lpos(key, element, opts) {
    const args = [
      element
    ];
    if (opts?.rank != null) {
      args.push("RANK", String(opts.rank));
    }
    if (opts?.count != null) {
      args.push("COUNT", String(opts.count));
    }
    if (opts?.maxlen != null) {
      args.push("MAXLEN", String(opts.maxlen));
    }
    return opts?.count == null ? this.execIntegerReply("LPOS", key, ...args) : this.execArrayReply("LPOS", key, ...args);
  }
  lpush(key, ...elements) {
    return this.execIntegerReply("LPUSH", key, ...elements);
  }
  lpushx(key, ...elements) {
    return this.execIntegerReply("LPUSHX", key, ...elements);
  }
  lrange(key, start, stop) {
    return this.execArrayReply("LRANGE", key, start, stop);
  }
  lrem(key, count, element) {
    return this.execIntegerReply("LREM", key, count, element);
  }
  lset(key, index, element) {
    return this.execStatusReply("LSET", key, index, element);
  }
  ltrim(key, start, stop) {
    return this.execStatusReply("LTRIM", key, start, stop);
  }
  memoryDoctor() {
    return this.execBulkReply("MEMORY", "DOCTOR");
  }
  memoryHelp() {
    return this.execArrayReply("MEMORY", "HELP");
  }
  memoryMallocStats() {
    return this.execBulkReply("MEMORY", "MALLOC", "STATS");
  }
  memoryPurge() {
    return this.execStatusReply("MEMORY", "PURGE");
  }
  memoryStats() {
    return this.execArrayReply("MEMORY", "STATS");
  }
  memoryUsage(key, opts) {
    const args = [
      key
    ];
    if (opts?.samples !== undefined) {
      args.push("SAMPLES", opts.samples);
    }
    return this.execIntegerReply("MEMORY", "USAGE", ...args);
  }
  mget(...keys) {
    return this.execArrayReply("MGET", ...keys);
  }
  migrate(host, port, key, destinationDB, timeout, opts) {
    const args = [
      host,
      port,
      key,
      destinationDB,
      timeout
    ];
    if (opts?.copy) {
      args.push("COPY");
    }
    if (opts?.replace) {
      args.push("REPLACE");
    }
    if (opts?.auth !== undefined) {
      args.push("AUTH", opts.auth);
    }
    if (opts?.keys) {
      args.push("KEYS", ...opts.keys);
    }
    return this.execStatusReply("MIGRATE", ...args);
  }
  moduleList() {
    return this.execArrayReply("MODULE", "LIST");
  }
  moduleLoad(path, ...args) {
    return this.execStatusReply("MODULE", "LOAD", path, ...args);
  }
  moduleUnload(name) {
    return this.execStatusReply("MODULE", "UNLOAD", name);
  }
  monitor() {
    throw new Error("not supported yet");
  }
  move(key, db) {
    return this.execIntegerReply("MOVE", key, db);
  }
  // deno-lint-ignore no-explicit-any
  mset(...params) {
    const args = [];
    if (Array.isArray(params[0])) {
      args.push(...params.flatMap((e)=>e));
    } else if (typeof params[0] === "object") {
      for (const [key, value] of Object.entries(params[0])){
        args.push(key, value);
      }
    } else {
      args.push(...params);
    }
    return this.execStatusReply("MSET", ...args);
  }
  // deno-lint-ignore no-explicit-any
  msetnx(...params) {
    const args = [];
    if (Array.isArray(params[0])) {
      args.push(...params.flatMap((e)=>e));
    } else if (typeof params[0] === "object") {
      for (const [key, value] of Object.entries(params[0])){
        args.push(key, value);
      }
    } else {
      args.push(...params);
    }
    return this.execIntegerReply("MSETNX", ...args);
  }
  multi() {
    return this.execStatusReply("MULTI");
  }
  objectEncoding(key) {
    return this.execBulkReply("OBJECT", "ENCODING", key);
  }
  objectFreq(key) {
    return this.execIntegerOrNilReply("OBJECT", "FREQ", key);
  }
  objectHelp() {
    return this.execArrayReply("OBJECT", "HELP");
  }
  objectIdletime(key) {
    return this.execIntegerOrNilReply("OBJECT", "IDLETIME", key);
  }
  objectRefCount(key) {
    return this.execIntegerOrNilReply("OBJECT", "REFCOUNT", key);
  }
  persist(key) {
    return this.execIntegerReply("PERSIST", key);
  }
  pexpire(key, milliseconds) {
    return this.execIntegerReply("PEXPIRE", key, milliseconds);
  }
  pexpireat(key, millisecondsTimestamp) {
    return this.execIntegerReply("PEXPIREAT", key, millisecondsTimestamp);
  }
  pfadd(key, ...elements) {
    return this.execIntegerReply("PFADD", key, ...elements);
  }
  pfcount(...keys) {
    return this.execIntegerReply("PFCOUNT", ...keys);
  }
  pfmerge(destkey, ...sourcekeys) {
    return this.execStatusReply("PFMERGE", destkey, ...sourcekeys);
  }
  ping(message) {
    if (message) {
      return this.execBulkReply("PING", message);
    }
    return this.execStatusReply("PING");
  }
  psetex(key, milliseconds, value) {
    return this.execStatusReply("PSETEX", key, milliseconds, value);
  }
  publish(channel, message) {
    return this.execIntegerReply("PUBLISH", channel, message);
  }
  subscribe(...channels) {
    return subscribe(this.executor, ...channels);
  }
  psubscribe(...patterns) {
    return psubscribe(this.executor, ...patterns);
  }
  pubsubChannels(pattern) {
    if (pattern !== undefined) {
      return this.execArrayReply("PUBSUB", "CHANNELS", pattern);
    }
    return this.execArrayReply("PUBSUB", "CHANNELS");
  }
  pubsubNumpat() {
    return this.execIntegerReply("PUBSUB", "NUMPAT");
  }
  pubsubNumsub(...channels) {
    return this.execArrayReply("PUBSUB", "NUMSUB", ...channels);
  }
  pttl(key) {
    return this.execIntegerReply("PTTL", key);
  }
  quit() {
    return this.execStatusReply("QUIT").finally(()=>this.close());
  }
  randomkey() {
    return this.execBulkReply("RANDOMKEY");
  }
  readonly() {
    return this.execStatusReply("READONLY");
  }
  readwrite() {
    return this.execStatusReply("READWRITE");
  }
  rename(key, newkey) {
    return this.execStatusReply("RENAME", key, newkey);
  }
  renamenx(key, newkey) {
    return this.execIntegerReply("RENAMENX", key, newkey);
  }
  restore(key, ttl, serializedValue, opts) {
    const args = [
      key,
      ttl,
      serializedValue
    ];
    if (opts?.replace) {
      args.push("REPLACE");
    }
    if (opts?.absttl) {
      args.push("ABSTTL");
    }
    if (opts?.idletime !== undefined) {
      args.push("IDLETIME", opts.idletime);
    }
    if (opts?.freq !== undefined) {
      args.push("FREQ", opts.freq);
    }
    return this.execStatusReply("RESTORE", ...args);
  }
  role() {
    return this.execArrayReply("ROLE");
  }
  rpop(key) {
    return this.execBulkReply("RPOP", key);
  }
  rpoplpush(source, destination) {
    return this.execBulkReply("RPOPLPUSH", source, destination);
  }
  rpush(key, ...elements) {
    return this.execIntegerReply("RPUSH", key, ...elements);
  }
  rpushx(key, ...elements) {
    return this.execIntegerReply("RPUSHX", key, ...elements);
  }
  sadd(key, ...members) {
    return this.execIntegerReply("SADD", key, ...members);
  }
  save() {
    return this.execStatusReply("SAVE");
  }
  scard(key) {
    return this.execIntegerReply("SCARD", key);
  }
  scriptDebug(mode) {
    return this.execStatusReply("SCRIPT", "DEBUG", mode);
  }
  scriptExists(...sha1s) {
    return this.execArrayReply("SCRIPT", "EXISTS", ...sha1s);
  }
  scriptFlush() {
    return this.execStatusReply("SCRIPT", "FLUSH");
  }
  scriptKill() {
    return this.execStatusReply("SCRIPT", "KILL");
  }
  scriptLoad(script) {
    return this.execStatusReply("SCRIPT", "LOAD", script);
  }
  sdiff(...keys) {
    return this.execArrayReply("SDIFF", ...keys);
  }
  sdiffstore(destination, ...keys) {
    return this.execIntegerReply("SDIFFSTORE", destination, ...keys);
  }
  select(index) {
    return this.execStatusReply("SELECT", index);
  }
  set(key, value, opts) {
    const args = [
      key,
      value
    ];
    if (opts?.ex !== undefined) {
      args.push("EX", opts.ex);
    } else if (opts?.px !== undefined) {
      args.push("PX", opts.px);
    }
    if (opts?.keepttl) {
      args.push("KEEPTTL");
    }
    if (opts?.mode) {
      args.push(opts.mode);
      return this.execStatusOrNilReply("SET", ...args);
    }
    return this.execStatusReply("SET", ...args);
  }
  setbit(key, offset, value) {
    return this.execIntegerReply("SETBIT", key, offset, value);
  }
  setex(key, seconds, value) {
    return this.execStatusReply("SETEX", key, seconds, value);
  }
  setnx(key, value) {
    return this.execIntegerReply("SETNX", key, value);
  }
  setrange(key, offset, value) {
    return this.execIntegerReply("SETRANGE", key, offset, value);
  }
  shutdown(mode) {
    if (mode) {
      return this.execStatusReply("SHUTDOWN", mode);
    }
    return this.execStatusReply("SHUTDOWN");
  }
  sinter(...keys) {
    return this.execArrayReply("SINTER", ...keys);
  }
  sinterstore(destination, ...keys) {
    return this.execIntegerReply("SINTERSTORE", destination, ...keys);
  }
  sismember(key, member) {
    return this.execIntegerReply("SISMEMBER", key, member);
  }
  slaveof(host, port) {
    return this.execStatusReply("SLAVEOF", host, port);
  }
  slaveofNoOne() {
    return this.execStatusReply("SLAVEOF", "NO ONE");
  }
  replicaof(host, port) {
    return this.execStatusReply("REPLICAOF", host, port);
  }
  replicaofNoOne() {
    return this.execStatusReply("REPLICAOF", "NO ONE");
  }
  slowlog(subcommand, ...args) {
    return this.execArrayReply("SLOWLOG", subcommand, ...args);
  }
  smembers(key) {
    return this.execArrayReply("SMEMBERS", key);
  }
  smove(source, destination, member) {
    return this.execIntegerReply("SMOVE", source, destination, member);
  }
  sort(key, opts) {
    const args = [
      key
    ];
    if (opts?.by !== undefined) {
      args.push("BY", opts.by);
    }
    if (opts?.limit) {
      args.push("LIMIT", opts.limit.offset, opts.limit.count);
    }
    if (opts?.patterns) {
      args.push("GET", ...opts.patterns);
    }
    if (opts?.order) {
      args.push(opts.order);
    }
    if (opts?.alpha) {
      args.push("ALPHA");
    }
    if (opts?.destination !== undefined) {
      args.push("STORE", opts.destination);
      return this.execIntegerReply("SORT", ...args);
    }
    return this.execArrayReply("SORT", ...args);
  }
  spop(key, count) {
    if (count !== undefined) {
      return this.execArrayReply("SPOP", key, count);
    }
    return this.execBulkReply("SPOP", key);
  }
  srandmember(key, count) {
    if (count !== undefined) {
      return this.execArrayReply("SRANDMEMBER", key, count);
    }
    return this.execBulkReply("SRANDMEMBER", key);
  }
  srem(key, ...members) {
    return this.execIntegerReply("SREM", key, ...members);
  }
  stralgo(algorithm, target, a, b, opts) {
    const args = [];
    if (opts?.idx) {
      args.push("IDX");
    }
    if (opts?.len) {
      args.push("LEN");
    }
    if (opts?.withmatchlen) {
      args.push("WITHMATCHLEN");
    }
    if (opts?.minmatchlen) {
      args.push("MINMATCHLEN");
      args.push(opts.minmatchlen);
    }
    return this.execBulkReply("STRALGO", algorithm, target, a, b, ...args);
  }
  strlen(key) {
    return this.execIntegerReply("STRLEN", key);
  }
  sunion(...keys) {
    return this.execArrayReply("SUNION", ...keys);
  }
  sunionstore(destination, ...keys) {
    return this.execIntegerReply("SUNIONSTORE", destination, ...keys);
  }
  swapdb(index1, index2) {
    return this.execStatusReply("SWAPDB", index1, index2);
  }
  sync() {
    throw new Error("not implemented");
  }
  time() {
    return this.execArrayReply("TIME");
  }
  touch(...keys) {
    return this.execIntegerReply("TOUCH", ...keys);
  }
  ttl(key) {
    return this.execIntegerReply("TTL", key);
  }
  type(key) {
    return this.execStatusReply("TYPE", key);
  }
  unlink(...keys) {
    return this.execIntegerReply("UNLINK", ...keys);
  }
  unwatch() {
    return this.execStatusReply("UNWATCH");
  }
  wait(numreplicas, timeout) {
    return this.execIntegerReply("WAIT", numreplicas, timeout);
  }
  watch(...keys) {
    return this.execStatusReply("WATCH", ...keys);
  }
  xack(key, group, ...xids) {
    return this.execIntegerReply("XACK", key, group, ...xids.map((xid)=>xidstr(xid)));
  }
  xadd(key, xid, fieldValues, maxlen = undefined) {
    const args = [
      key
    ];
    if (maxlen) {
      args.push("MAXLEN");
      if (maxlen.approx) {
        args.push("~");
      }
      args.push(maxlen.elements.toString());
    }
    args.push(xidstr(xid));
    if (fieldValues instanceof Map) {
      for (const [f, v] of fieldValues){
        args.push(f);
        args.push(v);
      }
    } else {
      for (const [f, v] of Object.entries(fieldValues)){
        args.push(f);
        args.push(v);
      }
    }
    return this.execBulkReply("XADD", ...args).then((rawId)=>parseXId(rawId));
  }
  xclaim(key, opts, ...xids) {
    const args = [];
    if (opts.idle) {
      args.push("IDLE");
      args.push(opts.idle);
    }
    if (opts.time) {
      args.push("TIME");
      args.push(opts.time);
    }
    if (opts.retryCount) {
      args.push("RETRYCOUNT");
      args.push(opts.retryCount);
    }
    if (opts.force) {
      args.push("FORCE");
    }
    if (opts.justXId) {
      args.push("JUSTID");
    }
    return this.execArrayReply("XCLAIM", key, opts.group, opts.consumer, opts.minIdleTime, ...xids.map((xid)=>xidstr(xid)), ...args).then((raw)=>{
      if (opts.justXId) {
        const xids = [];
        for (const r of raw){
          if (typeof r === "string") {
            xids.push(parseXId(r));
          }
        }
        const payload = {
          kind: "justxid",
          xids
        };
        return payload;
      }
      const messages = [];
      for (const r of raw){
        if (typeof r !== "string") {
          messages.push(parseXMessage(r));
        }
      }
      const payload = {
        kind: "messages",
        messages
      };
      return payload;
    });
  }
  xdel(key, ...xids) {
    return this.execIntegerReply("XDEL", key, ...xids.map((rawId)=>xidstr(rawId)));
  }
  xlen(key) {
    return this.execIntegerReply("XLEN", key);
  }
  xgroupCreate(key, groupName, xid, mkstream) {
    const args = [];
    if (mkstream) {
      args.push("MKSTREAM");
    }
    return this.execStatusReply("XGROUP", "CREATE", key, groupName, xidstr(xid), ...args);
  }
  xgroupDelConsumer(key, groupName, consumerName) {
    return this.execIntegerReply("XGROUP", "DELCONSUMER", key, groupName, consumerName);
  }
  xgroupDestroy(key, groupName) {
    return this.execIntegerReply("XGROUP", "DESTROY", key, groupName);
  }
  xgroupHelp() {
    return this.execBulkReply("XGROUP", "HELP");
  }
  xgroupSetID(key, groupName, xid) {
    return this.execStatusReply("XGROUP", "SETID", key, groupName, xidstr(xid));
  }
  xinfoStream(key) {
    return this.execArrayReply("XINFO", "STREAM", key).then((raw)=>{
      // Note that you should not rely on the fields
      // exact position, nor on the number of fields,
      // new fields may be added in the future.
      const data = convertMap(raw);
      const firstEntry = parseXMessage(data.get("first-entry"));
      const lastEntry = parseXMessage(data.get("last-entry"));
      return {
        length: rawnum(data.get("length") ?? null),
        radixTreeKeys: rawnum(data.get("radix-tree-keys") ?? null),
        radixTreeNodes: rawnum(data.get("radix-tree-nodes") ?? null),
        groups: rawnum(data.get("groups") ?? null),
        lastGeneratedId: parseXId(rawstr(data.get("last-generated-id") ?? null)),
        firstEntry,
        lastEntry
      };
    });
  }
  xinfoStreamFull(key, count) {
    const args = [];
    if (count) {
      args.push("COUNT");
      args.push(count);
    }
    return this.execArrayReply("XINFO", "STREAM", key, "FULL", ...args).then((raw)=>{
      // Note that you should not rely on the fields
      // exact position, nor on the number of fields,
      // new fields may be added in the future.
      if (raw == null) throw "no data";
      const data = convertMap(raw);
      if (data === undefined) throw "no data converted";
      const entries = data.get("entries").map((raw)=>parseXMessage(raw));
      return {
        length: rawnum(data.get("length") ?? null),
        radixTreeKeys: rawnum(data.get("radix-tree-keys") ?? null),
        radixTreeNodes: rawnum(data.get("radix-tree-nodes") ?? null),
        lastGeneratedId: parseXId(rawstr(data.get("last-generated-id") ?? null)),
        entries,
        groups: parseXGroupDetail(data.get("groups"))
      };
    });
  }
  xinfoGroups(key) {
    return this.execArrayReply("XINFO", "GROUPS", key).then((raws)=>raws.map((raw)=>{
        const data = convertMap(raw);
        return {
          name: rawstr(data.get("name") ?? null),
          consumers: rawnum(data.get("consumers") ?? null),
          pending: rawnum(data.get("pending") ?? null),
          lastDeliveredId: parseXId(rawstr(data.get("last-delivered-id") ?? null))
        };
      }));
  }
  xinfoConsumers(key, group) {
    return this.execArrayReply("XINFO", "CONSUMERS", key, group).then((raws)=>raws.map((raw)=>{
        const data = convertMap(raw);
        return {
          name: rawstr(data.get("name") ?? null),
          pending: rawnum(data.get("pending") ?? null),
          idle: rawnum(data.get("idle") ?? null)
        };
      }));
  }
  xpending(key, group) {
    return this.execArrayReply("XPENDING", key, group).then((raw)=>{
      if (isNumber(raw[0]) && isString(raw[1]) && isString(raw[2]) && isCondArray(raw[3])) {
        return {
          count: raw[0],
          startId: parseXId(raw[1]),
          endId: parseXId(raw[2]),
          consumers: parseXPendingConsumers(raw[3])
        };
      } else {
        throw "parse err";
      }
    });
  }
  xpendingCount(key, group, startEndCount, consumer) {
    const args = [];
    args.push(startEndCount.start);
    args.push(startEndCount.end);
    args.push(startEndCount.count);
    if (consumer) {
      args.push(consumer);
    }
    return this.execArrayReply("XPENDING", key, group, ...args).then((raw)=>parseXPendingCounts(raw));
  }
  xrange(key, start, end, count) {
    const args = [
      key,
      xidstr(start),
      xidstr(end)
    ];
    if (count) {
      args.push("COUNT");
      args.push(count);
    }
    return this.execArrayReply("XRANGE", ...args).then((raw)=>raw.map((m)=>parseXMessage(m)));
  }
  xrevrange(key, start, end, count) {
    const args = [
      key,
      xidstr(start),
      xidstr(end)
    ];
    if (count) {
      args.push("COUNT");
      args.push(count);
    }
    return this.execArrayReply("XREVRANGE", ...args).then((raw)=>raw.map((m)=>parseXMessage(m)));
  }
  xread(keyXIds, opts) {
    const args = [];
    if (opts) {
      if (opts.count) {
        args.push("COUNT");
        args.push(opts.count);
      }
      if (opts.block) {
        args.push("BLOCK");
        args.push(opts.block);
      }
    }
    args.push("STREAMS");
    const theKeys = [];
    const theXIds = [];
    for (const a of keyXIds){
      if (a instanceof Array) {
        // XKeyIdLike
        theKeys.push(a[0]);
        theXIds.push(xidstr(a[1]));
      } else {
        // XKeyId
        theKeys.push(a.key);
        theXIds.push(xidstr(a.xid));
      }
    }
    return this.execArrayReply("XREAD", ...args.concat(theKeys).concat(theXIds)).then((raw)=>parseXReadReply(raw));
  }
  xreadgroup(keyXIds, { group, consumer, count, block }) {
    const args = [
      "GROUP",
      group,
      consumer
    ];
    if (count) {
      args.push("COUNT");
      args.push(count);
    }
    if (block) {
      args.push("BLOCK");
      args.push(block);
    }
    args.push("STREAMS");
    const theKeys = [];
    const theXIds = [];
    for (const a of keyXIds){
      if (a instanceof Array) {
        // XKeyIdGroupLike
        theKeys.push(a[0]);
        theXIds.push(a[1] === ">" ? ">" : xidstr(a[1]));
      } else {
        // XKeyIdGroup
        theKeys.push(a.key);
        theXIds.push(a.xid === ">" ? ">" : xidstr(a.xid));
      }
    }
    return this.execArrayReply("XREADGROUP", ...args.concat(theKeys).concat(theXIds)).then((raw)=>parseXReadReply(raw));
  }
  xtrim(key, maxlen) {
    const args = [];
    if (maxlen.approx) {
      args.push("~");
    }
    args.push(maxlen.elements);
    return this.execIntegerReply("XTRIM", key, "MAXLEN", ...args);
  }
  zadd(key, param1, param2, opts) {
    const args = [
      key
    ];
    if (Array.isArray(param1)) {
      this.pushZAddOpts(args, param2);
      args.push(...param1.flatMap((e)=>e));
      opts = param2;
    } else if (typeof param1 === "object") {
      this.pushZAddOpts(args, param2);
      for (const [member, score] of Object.entries(param1)){
        args.push(score, member);
      }
    } else {
      this.pushZAddOpts(args, opts);
      args.push(param1, param2);
    }
    return this.execIntegerReply("ZADD", ...args);
  }
  pushZAddOpts(args, opts) {
    if (opts?.mode) {
      args.push(opts.mode);
    }
    if (opts?.ch) {
      args.push("CH");
    }
  }
  zaddIncr(key, score, member, opts) {
    const args = [
      key
    ];
    this.pushZAddOpts(args, opts);
    args.push("INCR", score, member);
    return this.execBulkReply("ZADD", ...args);
  }
  zcard(key) {
    return this.execIntegerReply("ZCARD", key);
  }
  zcount(key, min, max) {
    return this.execIntegerReply("ZCOUNT", key, min, max);
  }
  zincrby(key, increment, member) {
    return this.execBulkReply("ZINCRBY", key, increment, member);
  }
  zinter(keys, opts) {
    const args = this.pushZStoreArgs([], keys, opts);
    if (opts?.withScore) {
      args.push("WITHSCORES");
    }
    return this.execArrayReply("ZINTER", ...args);
  }
  zinterstore(destination, keys, opts) {
    const args = this.pushZStoreArgs([
      destination
    ], keys, opts);
    return this.execIntegerReply("ZINTERSTORE", ...args);
  }
  zunionstore(destination, keys, opts) {
    const args = this.pushZStoreArgs([
      destination
    ], keys, opts);
    return this.execIntegerReply("ZUNIONSTORE", ...args);
  }
  pushZStoreArgs(args, keys, opts) {
    if (Array.isArray(keys)) {
      args.push(keys.length);
      if (Array.isArray(keys[0])) {
        keys = keys;
        args.push(...keys.map((e)=>e[0]));
        args.push("WEIGHTS");
        args.push(...keys.map((e)=>e[1]));
      } else {
        args.push(...keys);
      }
    } else {
      args.push(Object.keys(keys).length);
      args.push(...Object.keys(keys));
      args.push("WEIGHTS");
      args.push(...Object.values(keys));
    }
    if (opts?.aggregate) {
      args.push("AGGREGATE", opts.aggregate);
    }
    return args;
  }
  zlexcount(key, min, max) {
    return this.execIntegerReply("ZLEXCOUNT", key, min, max);
  }
  zpopmax(key, count) {
    if (count !== undefined) {
      return this.execArrayReply("ZPOPMAX", key, count);
    }
    return this.execArrayReply("ZPOPMAX", key);
  }
  zpopmin(key, count) {
    if (count !== undefined) {
      return this.execArrayReply("ZPOPMIN", key, count);
    }
    return this.execArrayReply("ZPOPMIN", key);
  }
  zrange(key, start, stop, opts) {
    const args = this.pushZRangeOpts([
      key,
      start,
      stop
    ], opts);
    return this.execArrayReply("ZRANGE", ...args);
  }
  zrangebylex(key, min, max, opts) {
    const args = this.pushZRangeOpts([
      key,
      min,
      max
    ], opts);
    return this.execArrayReply("ZRANGEBYLEX", ...args);
  }
  zrangebyscore(key, min, max, opts) {
    const args = this.pushZRangeOpts([
      key,
      min,
      max
    ], opts);
    return this.execArrayReply("ZRANGEBYSCORE", ...args);
  }
  zrank(key, member) {
    return this.execIntegerOrNilReply("ZRANK", key, member);
  }
  zrem(key, ...members) {
    return this.execIntegerReply("ZREM", key, ...members);
  }
  zremrangebylex(key, min, max) {
    return this.execIntegerReply("ZREMRANGEBYLEX", key, min, max);
  }
  zremrangebyrank(key, start, stop) {
    return this.execIntegerReply("ZREMRANGEBYRANK", key, start, stop);
  }
  zremrangebyscore(key, min, max) {
    return this.execIntegerReply("ZREMRANGEBYSCORE", key, min, max);
  }
  zrevrange(key, start, stop, opts) {
    const args = this.pushZRangeOpts([
      key,
      start,
      stop
    ], opts);
    return this.execArrayReply("ZREVRANGE", ...args);
  }
  zrevrangebylex(key, max, min, opts) {
    const args = this.pushZRangeOpts([
      key,
      min,
      max
    ], opts);
    return this.execArrayReply("ZREVRANGEBYLEX", ...args);
  }
  zrevrangebyscore(key, max, min, opts) {
    const args = this.pushZRangeOpts([
      key,
      max,
      min
    ], opts);
    return this.execArrayReply("ZREVRANGEBYSCORE", ...args);
  }
  pushZRangeOpts(args, opts) {
    if (opts?.withScore) {
      args.push("WITHSCORES");
    }
    if (opts?.limit) {
      args.push("LIMIT", opts.limit.offset, opts.limit.count);
    }
    return args;
  }
  zrevrank(key, member) {
    return this.execIntegerOrNilReply("ZREVRANK", key, member);
  }
  zscore(key, member) {
    return this.execBulkReply("ZSCORE", key, member);
  }
  scan(cursor, opts) {
    const args = this.pushScanOpts([
      cursor
    ], opts);
    return this.execArrayReply("SCAN", ...args);
  }
  sscan(key, cursor, opts) {
    const args = this.pushScanOpts([
      key,
      cursor
    ], opts);
    return this.execArrayReply("SSCAN", ...args);
  }
  hscan(key, cursor, opts) {
    const args = this.pushScanOpts([
      key,
      cursor
    ], opts);
    return this.execArrayReply("HSCAN", ...args);
  }
  zscan(key, cursor, opts) {
    const args = this.pushScanOpts([
      key,
      cursor
    ], opts);
    return this.execArrayReply("ZSCAN", ...args);
  }
  pushScanOpts(args, opts) {
    if (opts?.pattern !== undefined) {
      args.push("MATCH", opts.pattern);
    }
    if (opts?.count !== undefined) {
      args.push("COUNT", opts.count);
    }
    if (opts?.type !== undefined) {
      args.push("TYPE", opts.type);
    }
    return args;
  }
  tx() {
    return createRedisPipeline(this.executor.connection, true);
  }
  pipeline() {
    return createRedisPipeline(this.executor.connection);
  }
}
/**
 * Connect to Redis server
 * @param options
 * @example
 * ```ts
 * import { connect } from "./mod.ts";
 * const conn1 = await connect({hostname: "127.0.0.1", port: 6379}); // -> TCP, 127.0.0.1:6379
 * const conn2 = await connect({hostname: "redis.proxy", port: 443, tls: true}); // -> TLS, redis.proxy:443
 * ```
 */ export async function connect(options) {
  const connection = createRedisConnection(options);
  await connection.connect();
  const executor = new MuxExecutor(connection);
  return create(executor);
}
/**
 * Create a lazy Redis client that will not establish a connection until a command is actually executed.
 *
 * ```ts
 * import { createLazyClient } from "./mod.ts";
 *
 * const client = createLazyClient({ hostname: "127.0.0.1", port: 6379 });
 * console.assert(!client.isConnected);
 * await client.get("foo");
 * console.assert(client.isConnected);
 * ```
 */ export function createLazyClient(options) {
  const connection = createRedisConnection(options);
  const executor = createLazyExecutor(connection);
  return create(executor);
}
/**
 * Create a redis client from `CommandExecutor`
 */ export function create(executor) {
  return new RedisImpl(executor);
}
/**
 * Extract RedisConnectOptions from redis URL
 * @param url
 * @example
 * ```ts
 * import { parseURL } from "./mod.ts";
 *
 * parseURL("redis://foo:bar@localhost:6379/1"); // -> {hostname: "localhost", port: "6379", tls: false, db: 1, name: foo, password: bar}
 * parseURL("rediss://127.0.0.1:443/?db=2&password=bar"); // -> {hostname: "127.0.0.1", port: "443", tls: true, db: 2, name: undefined, password: bar}
 * ```
 */ export function parseURL(url) {
  const { protocol, hostname, port, username, password, pathname, searchParams } = new URL(url);
  const db = pathname.replace("/", "") !== "" ? pathname.replace("/", "") : searchParams.get("db") ?? undefined;
  return {
    hostname: hostname !== "" ? hostname : "localhost",
    port: port !== "" ? parseInt(port, 10) : 6379,
    tls: protocol == "rediss:" ? true : searchParams.get("ssl") === "true",
    db: db ? parseInt(db, 10) : undefined,
    name: username !== "" ? username : undefined,
    password: password !== "" ? password : searchParams.get("password") ?? undefined
  };
}
function createRedisConnection(options) {
  const { hostname, port = 6379, ...opts } = options;
  return new RedisConnection(hostname, port, opts);
}
function createLazyExecutor(connection) {
  let executor = null;
  return {
    get connection () {
      return connection;
    },
    async exec (command, ...args) {
      if (!executor) {
        executor = new MuxExecutor(connection);
        await connection.connect();
      }
      return executor.exec(command, ...args);
    },
    close () {
      if (executor) {
        return executor.close();
      }
    }
  };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvc29ja2V0X2lvQDAuMi4xL3ZlbmRvci9kZW5vLmxhbmQveC9yZWRpc0B2MC4yNy4xL3JlZGlzLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB0eXBlIHtcbiAgQUNMTG9nTW9kZSxcbiAgQml0ZmllbGRPcHRzLFxuICBCaXRmaWVsZFdpdGhPdmVyZmxvd09wdHMsXG4gIENsaWVudENhY2hpbmdNb2RlLFxuICBDbGllbnRLaWxsT3B0cyxcbiAgQ2xpZW50TGlzdE9wdHMsXG4gIENsaWVudFBhdXNlTW9kZSxcbiAgQ2xpZW50VHJhY2tpbmdPcHRzLFxuICBDbGllbnRVbmJsb2NraW5nQmVoYXZpb3VyLFxuICBDbHVzdGVyRmFpbG92ZXJNb2RlLFxuICBDbHVzdGVyUmVzZXRNb2RlLFxuICBDbHVzdGVyU2V0U2xvdFN1YmNvbW1hbmQsXG4gIEdlb1JhZGl1c09wdHMsXG4gIEdlb1VuaXQsXG4gIEhTY2FuT3B0cyxcbiAgTEluc2VydExvY2F0aW9uLFxuICBMUG9zT3B0cyxcbiAgTFBvc1dpdGhDb3VudE9wdHMsXG4gIE1lbW9yeVVzYWdlT3B0cyxcbiAgTWlncmF0ZU9wdHMsXG4gIFJlZGlzQ29tbWFuZHMsXG4gIFJlc3RvcmVPcHRzLFxuICBTY2FuT3B0cyxcbiAgU2NyaXB0RGVidWdNb2RlLFxuICBTZXRPcHRzLFxuICBTZXRXaXRoTW9kZU9wdHMsXG4gIFNodXRkb3duTW9kZSxcbiAgU29ydE9wdHMsXG4gIFNvcnRXaXRoRGVzdGluYXRpb25PcHRzLFxuICBTU2Nhbk9wdHMsXG4gIFN0cmFsZ29BbGdvcml0aG0sXG4gIFN0cmFsZ29PcHRzLFxuICBTdHJhbGdvVGFyZ2V0LFxuICBaQWRkT3B0cyxcbiAgWkludGVyT3B0cyxcbiAgWkludGVyc3RvcmVPcHRzLFxuICBaUmFuZ2VCeUxleE9wdHMsXG4gIFpSYW5nZUJ5U2NvcmVPcHRzLFxuICBaUmFuZ2VPcHRzLFxuICBaU2Nhbk9wdHMsXG4gIFpVbmlvbnN0b3JlT3B0cyxcbn0gZnJvbSBcIi4vY29tbWFuZC50c1wiO1xuaW1wb3J0IHsgUmVkaXNDb25uZWN0aW9uIH0gZnJvbSBcIi4vY29ubmVjdGlvbi50c1wiO1xuaW1wb3J0IHR5cGUgeyBDb25uZWN0aW9uIH0gZnJvbSBcIi4vY29ubmVjdGlvbi50c1wiO1xuaW1wb3J0IHR5cGUgeyBSZWRpc0Nvbm5lY3Rpb25PcHRpb25zIH0gZnJvbSBcIi4vY29ubmVjdGlvbi50c1wiO1xuaW1wb3J0IHsgQ29tbWFuZEV4ZWN1dG9yLCBNdXhFeGVjdXRvciB9IGZyb20gXCIuL2V4ZWN1dG9yLnRzXCI7XG5pbXBvcnQgdHlwZSB7XG4gIEJpbmFyeSxcbiAgQnVsayxcbiAgQnVsa05pbCxcbiAgQnVsa1N0cmluZyxcbiAgQ29uZGl0aW9uYWxBcnJheSxcbiAgSW50ZWdlcixcbiAgUmF3LFxuICBSZWRpc1JlcGx5LFxuICBSZWRpc1ZhbHVlLFxuICBTaW1wbGVTdHJpbmcsXG59IGZyb20gXCIuL3Byb3RvY29sL21vZC50c1wiO1xuaW1wb3J0IHsgY3JlYXRlUmVkaXNQaXBlbGluZSB9IGZyb20gXCIuL3BpcGVsaW5lLnRzXCI7XG5pbXBvcnQgeyBwc3Vic2NyaWJlLCBzdWJzY3JpYmUgfSBmcm9tIFwiLi9wdWJzdWIudHNcIjtcbmltcG9ydCB7XG4gIGNvbnZlcnRNYXAsXG4gIGlzQ29uZEFycmF5LFxuICBpc051bWJlcixcbiAgaXNTdHJpbmcsXG4gIHBhcnNlWEdyb3VwRGV0YWlsLFxuICBwYXJzZVhJZCxcbiAgcGFyc2VYTWVzc2FnZSxcbiAgcGFyc2VYUGVuZGluZ0NvbnN1bWVycyxcbiAgcGFyc2VYUGVuZGluZ0NvdW50cyxcbiAgcGFyc2VYUmVhZFJlcGx5LFxuICByYXdudW0sXG4gIHJhd3N0cixcbiAgU3RhcnRFbmRDb3VudCxcbiAgWEFkZEZpZWxkVmFsdWVzLFxuICBYQ2xhaW1KdXN0WElkLFxuICBYQ2xhaW1NZXNzYWdlcyxcbiAgWENsYWltT3B0cyxcbiAgWElkLFxuICBYSWRBZGQsXG4gIFhJZElucHV0LFxuICBYSWROZWcsXG4gIFhJZFBvcyxcbiAgeGlkc3RyLFxuICBYS2V5SWQsXG4gIFhLZXlJZEdyb3VwLFxuICBYS2V5SWRHcm91cExpa2UsXG4gIFhLZXlJZExpa2UsXG4gIFhNYXhsZW4sXG4gIFhSZWFkR3JvdXBPcHRzLFxuICBYUmVhZElkRGF0YSxcbiAgWFJlYWRPcHRzLFxuICBYUmVhZFN0cmVhbVJhdyxcbn0gZnJvbSBcIi4vc3RyZWFtLnRzXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVkaXMgZXh0ZW5kcyBSZWRpc0NvbW1hbmRzIHtcbiAgcmVhZG9ubHkgaXNDbG9zZWQ6IGJvb2xlYW47XG4gIHJlYWRvbmx5IGlzQ29ubmVjdGVkOiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBMb3cgbGV2ZWwgaW50ZXJmYWNlIGZvciBSZWRpcyBzZXJ2ZXJcbiAgICovXG4gIHNlbmRDb21tYW5kKGNvbW1hbmQ6IHN0cmluZywgLi4uYXJnczogUmVkaXNWYWx1ZVtdKTogUHJvbWlzZTxSZWRpc1JlcGx5PjtcbiAgY2xvc2UoKTogdm9pZDtcbn1cblxuY2xhc3MgUmVkaXNJbXBsIGltcGxlbWVudHMgUmVkaXMge1xuICBwcml2YXRlIHJlYWRvbmx5IGV4ZWN1dG9yOiBDb21tYW5kRXhlY3V0b3I7XG5cbiAgZ2V0IGlzQ2xvc2VkKCkge1xuICAgIHJldHVybiB0aGlzLmV4ZWN1dG9yLmNvbm5lY3Rpb24uaXNDbG9zZWQ7XG4gIH1cblxuICBnZXQgaXNDb25uZWN0ZWQoKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY3V0b3IuY29ubmVjdGlvbi5pc0Nvbm5lY3RlZDtcbiAgfVxuXG4gIGNvbnN0cnVjdG9yKGV4ZWN1dG9yOiBDb21tYW5kRXhlY3V0b3IpIHtcbiAgICB0aGlzLmV4ZWN1dG9yID0gZXhlY3V0b3I7XG4gIH1cblxuICBzZW5kQ29tbWFuZChjb21tYW5kOiBzdHJpbmcsIC4uLmFyZ3M6IFJlZGlzVmFsdWVbXSkge1xuICAgIHJldHVybiB0aGlzLmV4ZWN1dG9yLmV4ZWMoY29tbWFuZCwgLi4uYXJncyk7XG4gIH1cblxuICBjbG9zZSgpOiB2b2lkIHtcbiAgICB0aGlzLmV4ZWN1dG9yLmNsb3NlKCk7XG4gIH1cblxuICBhc3luYyBleGVjUmVwbHkoY29tbWFuZDogc3RyaW5nLCAuLi5hcmdzOiBSZWRpc1ZhbHVlW10pOiBQcm9taXNlPFJhdz4ge1xuICAgIGNvbnN0IHJlcGx5ID0gYXdhaXQgdGhpcy5leGVjdXRvci5leGVjKFxuICAgICAgY29tbWFuZCxcbiAgICAgIC4uLmFyZ3MsXG4gICAgKTtcbiAgICByZXR1cm4gcmVwbHkudmFsdWUoKTtcbiAgfVxuXG4gIGFzeW5jIGV4ZWNTdGF0dXNSZXBseShcbiAgICBjb21tYW5kOiBzdHJpbmcsXG4gICAgLi4uYXJnczogUmVkaXNWYWx1ZVtdXG4gICk6IFByb21pc2U8U2ltcGxlU3RyaW5nPiB7XG4gICAgY29uc3QgcmVwbHkgPSBhd2FpdCB0aGlzLmV4ZWN1dG9yLmV4ZWMoY29tbWFuZCwgLi4uYXJncyk7XG4gICAgcmV0dXJuIHJlcGx5LnZhbHVlKCkgYXMgU2ltcGxlU3RyaW5nO1xuICB9XG5cbiAgYXN5bmMgZXhlY0ludGVnZXJSZXBseShcbiAgICBjb21tYW5kOiBzdHJpbmcsXG4gICAgLi4uYXJnczogUmVkaXNWYWx1ZVtdXG4gICk6IFByb21pc2U8SW50ZWdlcj4ge1xuICAgIGNvbnN0IHJlcGx5ID0gYXdhaXQgdGhpcy5leGVjdXRvci5leGVjKGNvbW1hbmQsIC4uLmFyZ3MpO1xuICAgIHJldHVybiByZXBseS52YWx1ZSgpIGFzIEludGVnZXI7XG4gIH1cblxuICBhc3luYyBleGVjQmluYXJ5UmVwbHkoXG4gICAgY29tbWFuZDogc3RyaW5nLFxuICAgIC4uLmFyZ3M6IFJlZGlzVmFsdWVbXVxuICApOiBQcm9taXNlPEJpbmFyeSB8IEJ1bGtOaWw+IHtcbiAgICBjb25zdCByZXBseSA9IGF3YWl0IHRoaXMuZXhlY3V0b3IuZXhlYyhjb21tYW5kLCAuLi5hcmdzKTtcbiAgICByZXR1cm4gcmVwbHkuYnVmZmVyKCk7XG4gIH1cblxuICBhc3luYyBleGVjQnVsa1JlcGx5PFQgZXh0ZW5kcyBCdWxrID0gQnVsaz4oXG4gICAgY29tbWFuZDogc3RyaW5nLFxuICAgIC4uLmFyZ3M6IFJlZGlzVmFsdWVbXVxuICApOiBQcm9taXNlPFQ+IHtcbiAgICBjb25zdCByZXBseSA9IGF3YWl0IHRoaXMuZXhlY3V0b3IuZXhlYyhjb21tYW5kLCAuLi5hcmdzKTtcbiAgICByZXR1cm4gcmVwbHkudmFsdWUoKSBhcyBUO1xuICB9XG5cbiAgYXN5bmMgZXhlY0FycmF5UmVwbHk8VCBleHRlbmRzIFJhdyA9IFJhdz4oXG4gICAgY29tbWFuZDogc3RyaW5nLFxuICAgIC4uLmFyZ3M6IFJlZGlzVmFsdWVbXVxuICApOiBQcm9taXNlPFRbXT4ge1xuICAgIGNvbnN0IHJlcGx5ID0gYXdhaXQgdGhpcy5leGVjdXRvci5leGVjKGNvbW1hbmQsIC4uLmFyZ3MpO1xuICAgIHJldHVybiByZXBseS52YWx1ZSgpIGFzIEFycmF5PFQ+O1xuICB9XG5cbiAgYXN5bmMgZXhlY0ludGVnZXJPck5pbFJlcGx5KFxuICAgIGNvbW1hbmQ6IHN0cmluZyxcbiAgICAuLi5hcmdzOiBSZWRpc1ZhbHVlW11cbiAgKTogUHJvbWlzZTxJbnRlZ2VyIHwgQnVsa05pbD4ge1xuICAgIGNvbnN0IHJlcGx5ID0gYXdhaXQgdGhpcy5leGVjdXRvci5leGVjKGNvbW1hbmQsIC4uLmFyZ3MpO1xuICAgIHJldHVybiByZXBseS52YWx1ZSgpIGFzIEludGVnZXIgfCBCdWxrTmlsO1xuICB9XG5cbiAgYXN5bmMgZXhlY1N0YXR1c09yTmlsUmVwbHkoXG4gICAgY29tbWFuZDogc3RyaW5nLFxuICAgIC4uLmFyZ3M6IFJlZGlzVmFsdWVbXVxuICApOiBQcm9taXNlPFNpbXBsZVN0cmluZyB8IEJ1bGtOaWw+IHtcbiAgICBjb25zdCByZXBseSA9IGF3YWl0IHRoaXMuZXhlY3V0b3IuZXhlYyhjb21tYW5kLCAuLi5hcmdzKTtcbiAgICByZXR1cm4gcmVwbHkuc3RyaW5nKCkgYXMgU2ltcGxlU3RyaW5nIHwgQnVsa05pbDtcbiAgfVxuXG4gIGFjbENhdChjYXRlZ29yeW5hbWU/OiBzdHJpbmcpIHtcbiAgICBpZiAoY2F0ZWdvcnluYW1lICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB0aGlzLmV4ZWNBcnJheVJlcGx5PEJ1bGtTdHJpbmc+KFwiQUNMXCIsIFwiQ0FUXCIsIGNhdGVnb3J5bmFtZSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmV4ZWNBcnJheVJlcGx5PEJ1bGtTdHJpbmc+KFwiQUNMXCIsIFwiQ0FUXCIpO1xuICB9XG5cbiAgYWNsRGVsVXNlciguLi51c2VybmFtZXM6IHN0cmluZ1tdKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY0ludGVnZXJSZXBseShcIkFDTFwiLCBcIkRFTFVTRVJcIiwgLi4udXNlcm5hbWVzKTtcbiAgfVxuXG4gIGFjbEdlblBhc3MoYml0cz86IG51bWJlcikge1xuICAgIGlmIChiaXRzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB0aGlzLmV4ZWNCdWxrUmVwbHk8QnVsa1N0cmluZz4oXCJBQ0xcIiwgXCJHRU5QQVNTXCIsIGJpdHMpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5leGVjQnVsa1JlcGx5PEJ1bGtTdHJpbmc+KFwiQUNMXCIsIFwiR0VOUEFTU1wiKTtcbiAgfVxuXG4gIGFjbEdldFVzZXIodXNlcm5hbWU6IHN0cmluZykge1xuICAgIHJldHVybiB0aGlzLmV4ZWNBcnJheVJlcGx5PEJ1bGtTdHJpbmcgfCBCdWxrU3RyaW5nW10+KFxuICAgICAgXCJBQ0xcIixcbiAgICAgIFwiR0VUVVNFUlwiLFxuICAgICAgdXNlcm5hbWUsXG4gICAgKTtcbiAgfVxuXG4gIGFjbEhlbHAoKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY0FycmF5UmVwbHk8QnVsa1N0cmluZz4oXCJBQ0xcIiwgXCJIRUxQXCIpO1xuICB9XG5cbiAgYWNsTGlzdCgpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjQXJyYXlSZXBseTxCdWxrU3RyaW5nPihcIkFDTFwiLCBcIkxJU1RcIik7XG4gIH1cblxuICBhY2xMb2FkKCkge1xuICAgIHJldHVybiB0aGlzLmV4ZWNTdGF0dXNSZXBseShcIkFDTFwiLCBcIkxPQURcIik7XG4gIH1cblxuICBhY2xMb2coY291bnQ6IG51bWJlcik6IFByb21pc2U8QnVsa1N0cmluZ1tdPjtcbiAgYWNsTG9nKG1vZGU6IEFDTExvZ01vZGUpOiBQcm9taXNlPFNpbXBsZVN0cmluZz47XG4gIGFjbExvZyhwYXJhbTogbnVtYmVyIHwgQUNMTG9nTW9kZSkge1xuICAgIGlmIChwYXJhbSA9PT0gXCJSRVNFVFwiKSB7XG4gICAgICByZXR1cm4gdGhpcy5leGVjU3RhdHVzUmVwbHkoXCJBQ0xcIiwgXCJMT0dcIiwgXCJSRVNFVFwiKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuZXhlY0FycmF5UmVwbHk8QnVsa1N0cmluZz4oXCJBQ0xcIiwgXCJMT0dcIiwgcGFyYW0pO1xuICB9XG5cbiAgYWNsU2F2ZSgpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjU3RhdHVzUmVwbHkoXCJBQ0xcIiwgXCJTQVZFXCIpO1xuICB9XG5cbiAgYWNsU2V0VXNlcih1c2VybmFtZTogc3RyaW5nLCAuLi5ydWxlczogc3RyaW5nW10pIHtcbiAgICByZXR1cm4gdGhpcy5leGVjU3RhdHVzUmVwbHkoXCJBQ0xcIiwgXCJTRVRVU0VSXCIsIHVzZXJuYW1lLCAuLi5ydWxlcyk7XG4gIH1cblxuICBhY2xVc2VycygpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjQXJyYXlSZXBseTxCdWxrU3RyaW5nPihcIkFDTFwiLCBcIlVTRVJTXCIpO1xuICB9XG5cbiAgYWNsV2hvYW1pKCkge1xuICAgIHJldHVybiB0aGlzLmV4ZWNCdWxrUmVwbHk8QnVsa1N0cmluZz4oXCJBQ0xcIiwgXCJXSE9BTUlcIik7XG4gIH1cblxuICBhcHBlbmQoa2V5OiBzdHJpbmcsIHZhbHVlOiBSZWRpc1ZhbHVlKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY0ludGVnZXJSZXBseShcIkFQUEVORFwiLCBrZXksIHZhbHVlKTtcbiAgfVxuXG4gIGF1dGgocGFyYW0xOiBSZWRpc1ZhbHVlLCBwYXJhbTI/OiBSZWRpc1ZhbHVlKSB7XG4gICAgaWYgKHBhcmFtMiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gdGhpcy5leGVjU3RhdHVzUmVwbHkoXCJBVVRIXCIsIHBhcmFtMSwgcGFyYW0yKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuZXhlY1N0YXR1c1JlcGx5KFwiQVVUSFwiLCBwYXJhbTEpO1xuICB9XG5cbiAgYmdyZXdyaXRlYW9mKCkge1xuICAgIHJldHVybiB0aGlzLmV4ZWNTdGF0dXNSZXBseShcIkJHUkVXUklURUFPRlwiKTtcbiAgfVxuXG4gIGJnc2F2ZSgpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjU3RhdHVzUmVwbHkoXCJCR1NBVkVcIik7XG4gIH1cblxuICBiaXRjb3VudChrZXk6IHN0cmluZywgc3RhcnQ/OiBudW1iZXIsIGVuZD86IG51bWJlcikge1xuICAgIGlmIChzdGFydCAhPT0gdW5kZWZpbmVkICYmIGVuZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gdGhpcy5leGVjSW50ZWdlclJlcGx5KFwiQklUQ09VTlRcIiwga2V5LCBzdGFydCwgZW5kKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuZXhlY0ludGVnZXJSZXBseShcIkJJVENPVU5UXCIsIGtleSk7XG4gIH1cblxuICBiaXRmaWVsZChcbiAgICBrZXk6IHN0cmluZyxcbiAgICBvcHRzPzogQml0ZmllbGRPcHRzIHwgQml0ZmllbGRXaXRoT3ZlcmZsb3dPcHRzLFxuICApIHtcbiAgICBjb25zdCBhcmdzOiAobnVtYmVyIHwgc3RyaW5nKVtdID0gW2tleV07XG4gICAgaWYgKG9wdHM/LmdldCkge1xuICAgICAgY29uc3QgeyB0eXBlLCBvZmZzZXQgfSA9IG9wdHMuZ2V0O1xuICAgICAgYXJncy5wdXNoKFwiR0VUXCIsIHR5cGUsIG9mZnNldCk7XG4gICAgfVxuICAgIGlmIChvcHRzPy5zZXQpIHtcbiAgICAgIGNvbnN0IHsgdHlwZSwgb2Zmc2V0LCB2YWx1ZSB9ID0gb3B0cy5zZXQ7XG4gICAgICBhcmdzLnB1c2goXCJTRVRcIiwgdHlwZSwgb2Zmc2V0LCB2YWx1ZSk7XG4gICAgfVxuICAgIGlmIChvcHRzPy5pbmNyYnkpIHtcbiAgICAgIGNvbnN0IHsgdHlwZSwgb2Zmc2V0LCBpbmNyZW1lbnQgfSA9IG9wdHMuaW5jcmJ5O1xuICAgICAgYXJncy5wdXNoKFwiSU5DUkJZXCIsIHR5cGUsIG9mZnNldCwgaW5jcmVtZW50KTtcbiAgICB9XG4gICAgaWYgKChvcHRzIGFzIEJpdGZpZWxkV2l0aE92ZXJmbG93T3B0cyk/Lm92ZXJmbG93KSB7XG4gICAgICBhcmdzLnB1c2goXCJPVkVSRkxPV1wiLCAob3B0cyBhcyBCaXRmaWVsZFdpdGhPdmVyZmxvd09wdHMpLm92ZXJmbG93KTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuZXhlY0FycmF5UmVwbHk8SW50ZWdlcj4oXCJCSVRGSUVMRFwiLCAuLi5hcmdzKTtcbiAgfVxuXG4gIGJpdG9wKG9wZXJhdGlvbjogc3RyaW5nLCBkZXN0a2V5OiBzdHJpbmcsIC4uLmtleXM6IHN0cmluZ1tdKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY0ludGVnZXJSZXBseShcIkJJVE9QXCIsIG9wZXJhdGlvbiwgZGVzdGtleSwgLi4ua2V5cyk7XG4gIH1cblxuICBiaXRwb3Moa2V5OiBzdHJpbmcsIGJpdDogbnVtYmVyLCBzdGFydD86IG51bWJlciwgZW5kPzogbnVtYmVyKSB7XG4gICAgaWYgKHN0YXJ0ICE9PSB1bmRlZmluZWQgJiYgZW5kICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB0aGlzLmV4ZWNJbnRlZ2VyUmVwbHkoXCJCSVRQT1NcIiwga2V5LCBiaXQsIHN0YXJ0LCBlbmQpO1xuICAgIH1cbiAgICBpZiAoc3RhcnQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHRoaXMuZXhlY0ludGVnZXJSZXBseShcIkJJVFBPU1wiLCBrZXksIGJpdCwgc3RhcnQpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5leGVjSW50ZWdlclJlcGx5KFwiQklUUE9TXCIsIGtleSwgYml0KTtcbiAgfVxuXG4gIGJscG9wKHRpbWVvdXQ6IG51bWJlciwgLi4ua2V5czogc3RyaW5nW10pIHtcbiAgICByZXR1cm4gdGhpcy5leGVjQXJyYXlSZXBseShcIkJMUE9QXCIsIC4uLmtleXMsIHRpbWVvdXQpIGFzIFByb21pc2U8XG4gICAgICBbQnVsa1N0cmluZywgQnVsa1N0cmluZ10gfCBCdWxrTmlsXG4gICAgPjtcbiAgfVxuXG4gIGJycG9wKHRpbWVvdXQ6IG51bWJlciwgLi4ua2V5czogc3RyaW5nW10pIHtcbiAgICByZXR1cm4gdGhpcy5leGVjQXJyYXlSZXBseShcIkJSUE9QXCIsIC4uLmtleXMsIHRpbWVvdXQpIGFzIFByb21pc2U8XG4gICAgICBbQnVsa1N0cmluZywgQnVsa1N0cmluZ10gfCBCdWxrTmlsXG4gICAgPjtcbiAgfVxuXG4gIGJycG9wbHB1c2goc291cmNlOiBzdHJpbmcsIGRlc3RpbmF0aW9uOiBzdHJpbmcsIHRpbWVvdXQ6IG51bWJlcikge1xuICAgIHJldHVybiB0aGlzLmV4ZWNCdWxrUmVwbHkoXCJCUlBPUExQVVNIXCIsIHNvdXJjZSwgZGVzdGluYXRpb24sIHRpbWVvdXQpO1xuICB9XG5cbiAgYnpwb3BtaW4odGltZW91dDogbnVtYmVyLCAuLi5rZXlzOiBzdHJpbmdbXSkge1xuICAgIHJldHVybiB0aGlzLmV4ZWNBcnJheVJlcGx5KFwiQlpQT1BNSU5cIiwgLi4ua2V5cywgdGltZW91dCkgYXMgUHJvbWlzZTxcbiAgICAgIFtCdWxrU3RyaW5nLCBCdWxrU3RyaW5nLCBCdWxrU3RyaW5nXSB8IEJ1bGtOaWxcbiAgICA+O1xuICB9XG5cbiAgYnpwb3BtYXgodGltZW91dDogbnVtYmVyLCAuLi5rZXlzOiBzdHJpbmdbXSkge1xuICAgIHJldHVybiB0aGlzLmV4ZWNBcnJheVJlcGx5KFwiQlpQT1BNQVhcIiwgLi4ua2V5cywgdGltZW91dCkgYXMgUHJvbWlzZTxcbiAgICAgIFtCdWxrU3RyaW5nLCBCdWxrU3RyaW5nLCBCdWxrU3RyaW5nXSB8IEJ1bGtOaWxcbiAgICA+O1xuICB9XG5cbiAgY2xpZW50Q2FjaGluZyhtb2RlOiBDbGllbnRDYWNoaW5nTW9kZSkge1xuICAgIHJldHVybiB0aGlzLmV4ZWNTdGF0dXNSZXBseShcIkNMSUVOVFwiLCBcIkNBQ0hJTkdcIiwgbW9kZSk7XG4gIH1cblxuICBjbGllbnRHZXROYW1lKCkge1xuICAgIHJldHVybiB0aGlzLmV4ZWNCdWxrUmVwbHkoXCJDTElFTlRcIiwgXCJHRVROQU1FXCIpO1xuICB9XG5cbiAgY2xpZW50R2V0UmVkaXIoKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY0ludGVnZXJSZXBseShcIkNMSUVOVFwiLCBcIkdFVFJFRElSXCIpO1xuICB9XG5cbiAgY2xpZW50SUQoKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY0ludGVnZXJSZXBseShcIkNMSUVOVFwiLCBcIklEXCIpO1xuICB9XG5cbiAgY2xpZW50SW5mbygpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjQnVsa1JlcGx5KFwiQ0xJRU5UXCIsIFwiSU5GT1wiKTtcbiAgfVxuXG4gIGNsaWVudEtpbGwob3B0czogQ2xpZW50S2lsbE9wdHMpIHtcbiAgICBjb25zdCBhcmdzOiAoc3RyaW5nIHwgbnVtYmVyKVtdID0gW107XG4gICAgaWYgKG9wdHMuYWRkcikge1xuICAgICAgYXJncy5wdXNoKFwiQUREUlwiLCBvcHRzLmFkZHIpO1xuICAgIH1cbiAgICBpZiAob3B0cy5sYWRkcikge1xuICAgICAgYXJncy5wdXNoKFwiTEFERFJcIiwgb3B0cy5sYWRkcik7XG4gICAgfVxuICAgIGlmIChvcHRzLmlkKSB7XG4gICAgICBhcmdzLnB1c2goXCJJRFwiLCBvcHRzLmlkKTtcbiAgICB9XG4gICAgaWYgKG9wdHMudHlwZSkge1xuICAgICAgYXJncy5wdXNoKFwiVFlQRVwiLCBvcHRzLnR5cGUpO1xuICAgIH1cbiAgICBpZiAob3B0cy51c2VyKSB7XG4gICAgICBhcmdzLnB1c2goXCJVU0VSXCIsIG9wdHMudXNlcik7XG4gICAgfVxuICAgIGlmIChvcHRzLnNraXBtZSkge1xuICAgICAgYXJncy5wdXNoKFwiU0tJUE1FXCIsIG9wdHMuc2tpcG1lKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuZXhlY0ludGVnZXJSZXBseShcIkNMSUVOVFwiLCBcIktJTExcIiwgLi4uYXJncyk7XG4gIH1cblxuICBjbGllbnRMaXN0KG9wdHM/OiBDbGllbnRMaXN0T3B0cykge1xuICAgIGlmIChvcHRzICYmIG9wdHMudHlwZSAmJiBvcHRzLmlkcykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwib25seSBvbmUgb2YgYHR5cGVgIG9yIGBpZHNgIGNhbiBiZSBzcGVjaWZpZWRcIik7XG4gICAgfVxuICAgIGlmIChvcHRzICYmIG9wdHMudHlwZSkge1xuICAgICAgcmV0dXJuIHRoaXMuZXhlY0J1bGtSZXBseShcIkNMSUVOVFwiLCBcIkxJU1RcIiwgXCJUWVBFXCIsIG9wdHMudHlwZSk7XG4gICAgfVxuICAgIGlmIChvcHRzICYmIG9wdHMuaWRzKSB7XG4gICAgICByZXR1cm4gdGhpcy5leGVjQnVsa1JlcGx5KFwiQ0xJRU5UXCIsIFwiTElTVFwiLCBcIklEXCIsIC4uLm9wdHMuaWRzKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuZXhlY0J1bGtSZXBseShcIkNMSUVOVFwiLCBcIkxJU1RcIik7XG4gIH1cblxuICBjbGllbnRQYXVzZSh0aW1lb3V0OiBudW1iZXIsIG1vZGU/OiBDbGllbnRQYXVzZU1vZGUpIHtcbiAgICBpZiAobW9kZSkge1xuICAgICAgcmV0dXJuIHRoaXMuZXhlY1N0YXR1c1JlcGx5KFwiQ0xJRU5UXCIsIFwiUEFVU0VcIiwgdGltZW91dCwgbW9kZSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmV4ZWNTdGF0dXNSZXBseShcIkNMSUVOVFwiLCBcIlBBVVNFXCIsIHRpbWVvdXQpO1xuICB9XG5cbiAgY2xpZW50U2V0TmFtZShjb25uZWN0aW9uTmFtZTogc3RyaW5nKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY1N0YXR1c1JlcGx5KFwiQ0xJRU5UXCIsIFwiU0VUTkFNRVwiLCBjb25uZWN0aW9uTmFtZSk7XG4gIH1cblxuICBjbGllbnRUcmFja2luZyhvcHRzOiBDbGllbnRUcmFja2luZ09wdHMpIHtcbiAgICBjb25zdCBhcmdzOiAobnVtYmVyIHwgc3RyaW5nKVtdID0gW29wdHMubW9kZV07XG4gICAgaWYgKG9wdHMucmVkaXJlY3QpIHtcbiAgICAgIGFyZ3MucHVzaChcIlJFRElSRUNUXCIsIG9wdHMucmVkaXJlY3QpO1xuICAgIH1cbiAgICBpZiAob3B0cy5wcmVmaXhlcykge1xuICAgICAgb3B0cy5wcmVmaXhlcy5mb3JFYWNoKChwcmVmaXgpID0+IHtcbiAgICAgICAgYXJncy5wdXNoKFwiUFJFRklYXCIpO1xuICAgICAgICBhcmdzLnB1c2gocHJlZml4KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICBpZiAob3B0cy5iY2FzdCkge1xuICAgICAgYXJncy5wdXNoKFwiQkNBU1RcIik7XG4gICAgfVxuICAgIGlmIChvcHRzLm9wdEluKSB7XG4gICAgICBhcmdzLnB1c2goXCJPUFRJTlwiKTtcbiAgICB9XG4gICAgaWYgKG9wdHMub3B0T3V0KSB7XG4gICAgICBhcmdzLnB1c2goXCJPUFRPVVRcIik7XG4gICAgfVxuICAgIGlmIChvcHRzLm5vTG9vcCkge1xuICAgICAgYXJncy5wdXNoKFwiTk9MT09QXCIpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5leGVjU3RhdHVzUmVwbHkoXCJDTElFTlRcIiwgXCJUUkFDS0lOR1wiLCAuLi5hcmdzKTtcbiAgfVxuXG4gIGNsaWVudFRyYWNraW5nSW5mbygpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjQXJyYXlSZXBseShcIkNMSUVOVFwiLCBcIlRSQUNLSU5HSU5GT1wiKTtcbiAgfVxuXG4gIGNsaWVudFVuYmxvY2soXG4gICAgaWQ6IG51bWJlcixcbiAgICBiZWhhdmlvdXI/OiBDbGllbnRVbmJsb2NraW5nQmVoYXZpb3VyLFxuICApOiBQcm9taXNlPEludGVnZXI+IHtcbiAgICBpZiAoYmVoYXZpb3VyKSB7XG4gICAgICByZXR1cm4gdGhpcy5leGVjSW50ZWdlclJlcGx5KFwiQ0xJRU5UXCIsIFwiVU5CTE9DS1wiLCBpZCwgYmVoYXZpb3VyKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuZXhlY0ludGVnZXJSZXBseShcIkNMSUVOVFwiLCBcIlVOQkxPQ0tcIiwgaWQpO1xuICB9XG5cbiAgY2xpZW50VW5wYXVzZSgpOiBQcm9taXNlPFNpbXBsZVN0cmluZz4ge1xuICAgIHJldHVybiB0aGlzLmV4ZWNTdGF0dXNSZXBseShcIkNMSUVOVFwiLCBcIlVOUEFVU0VcIik7XG4gIH1cblxuICBhc2tpbmcoKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY1N0YXR1c1JlcGx5KFwiQVNLSU5HXCIpO1xuICB9XG5cbiAgY2x1c3RlckFkZFNsb3RzKC4uLnNsb3RzOiBudW1iZXJbXSkge1xuICAgIHJldHVybiB0aGlzLmV4ZWNTdGF0dXNSZXBseShcIkNMVVNURVJcIiwgXCJBRERTTE9UU1wiLCAuLi5zbG90cyk7XG4gIH1cblxuICBjbHVzdGVyQ291bnRGYWlsdXJlUmVwb3J0cyhub2RlSWQ6IHN0cmluZykge1xuICAgIHJldHVybiB0aGlzLmV4ZWNJbnRlZ2VyUmVwbHkoXCJDTFVTVEVSXCIsIFwiQ09VTlQtRkFJTFVSRS1SRVBPUlRTXCIsIG5vZGVJZCk7XG4gIH1cblxuICBjbHVzdGVyQ291bnRLZXlzSW5TbG90KHNsb3Q6IG51bWJlcikge1xuICAgIHJldHVybiB0aGlzLmV4ZWNJbnRlZ2VyUmVwbHkoXCJDTFVTVEVSXCIsIFwiQ09VTlRLRVlTSU5TTE9UXCIsIHNsb3QpO1xuICB9XG5cbiAgY2x1c3RlckRlbFNsb3RzKC4uLnNsb3RzOiBudW1iZXJbXSkge1xuICAgIHJldHVybiB0aGlzLmV4ZWNTdGF0dXNSZXBseShcIkNMVVNURVJcIiwgXCJERUxTTE9UU1wiLCAuLi5zbG90cyk7XG4gIH1cblxuICBjbHVzdGVyRmFpbG92ZXIobW9kZT86IENsdXN0ZXJGYWlsb3Zlck1vZGUpIHtcbiAgICBpZiAobW9kZSkge1xuICAgICAgcmV0dXJuIHRoaXMuZXhlY1N0YXR1c1JlcGx5KFwiQ0xVU1RFUlwiLCBcIkZBSUxPVkVSXCIsIG1vZGUpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5leGVjU3RhdHVzUmVwbHkoXCJDTFVTVEVSXCIsIFwiRkFJTE9WRVJcIik7XG4gIH1cblxuICBjbHVzdGVyRmx1c2hTbG90cygpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjU3RhdHVzUmVwbHkoXCJDTFVTVEVSXCIsIFwiRkxVU0hTTE9UU1wiKTtcbiAgfVxuXG4gIGNsdXN0ZXJGb3JnZXQobm9kZUlkOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjU3RhdHVzUmVwbHkoXCJDTFVTVEVSXCIsIFwiRk9SR0VUXCIsIG5vZGVJZCk7XG4gIH1cblxuICBjbHVzdGVyR2V0S2V5c0luU2xvdChzbG90OiBudW1iZXIsIGNvdW50OiBudW1iZXIpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjQXJyYXlSZXBseTxCdWxrU3RyaW5nPihcbiAgICAgIFwiQ0xVU1RFUlwiLFxuICAgICAgXCJHRVRLRVlTSU5TTE9UXCIsXG4gICAgICBzbG90LFxuICAgICAgY291bnQsXG4gICAgKTtcbiAgfVxuXG4gIGNsdXN0ZXJJbmZvKCkge1xuICAgIHJldHVybiB0aGlzLmV4ZWNTdGF0dXNSZXBseShcIkNMVVNURVJcIiwgXCJJTkZPXCIpO1xuICB9XG5cbiAgY2x1c3RlcktleVNsb3Qoa2V5OiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjSW50ZWdlclJlcGx5KFwiQ0xVU1RFUlwiLCBcIktFWVNMT1RcIiwga2V5KTtcbiAgfVxuXG4gIGNsdXN0ZXJNZWV0KGlwOiBzdHJpbmcsIHBvcnQ6IG51bWJlcikge1xuICAgIHJldHVybiB0aGlzLmV4ZWNTdGF0dXNSZXBseShcIkNMVVNURVJcIiwgXCJNRUVUXCIsIGlwLCBwb3J0KTtcbiAgfVxuXG4gIGNsdXN0ZXJNeUlEKCkge1xuICAgIHJldHVybiB0aGlzLmV4ZWNTdGF0dXNSZXBseShcIkNMVVNURVJcIiwgXCJNWUlEXCIpO1xuICB9XG5cbiAgY2x1c3Rlck5vZGVzKCkge1xuICAgIHJldHVybiB0aGlzLmV4ZWNCdWxrUmVwbHk8QnVsa1N0cmluZz4oXCJDTFVTVEVSXCIsIFwiTk9ERVNcIik7XG4gIH1cblxuICBjbHVzdGVyUmVwbGljYXMobm9kZUlkOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjQXJyYXlSZXBseTxCdWxrU3RyaW5nPihcIkNMVVNURVJcIiwgXCJSRVBMSUNBU1wiLCBub2RlSWQpO1xuICB9XG5cbiAgY2x1c3RlclJlcGxpY2F0ZShub2RlSWQ6IHN0cmluZykge1xuICAgIHJldHVybiB0aGlzLmV4ZWNTdGF0dXNSZXBseShcIkNMVVNURVJcIiwgXCJSRVBMSUNBVEVcIiwgbm9kZUlkKTtcbiAgfVxuXG4gIGNsdXN0ZXJSZXNldChtb2RlPzogQ2x1c3RlclJlc2V0TW9kZSkge1xuICAgIGlmIChtb2RlKSB7XG4gICAgICByZXR1cm4gdGhpcy5leGVjU3RhdHVzUmVwbHkoXCJDTFVTVEVSXCIsIFwiUkVTRVRcIiwgbW9kZSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmV4ZWNTdGF0dXNSZXBseShcIkNMVVNURVJcIiwgXCJSRVNFVFwiKTtcbiAgfVxuXG4gIGNsdXN0ZXJTYXZlQ29uZmlnKCkge1xuICAgIHJldHVybiB0aGlzLmV4ZWNTdGF0dXNSZXBseShcIkNMVVNURVJcIiwgXCJTQVZFQ09ORklHXCIpO1xuICB9XG5cbiAgY2x1c3RlclNldFNsb3QoXG4gICAgc2xvdDogbnVtYmVyLFxuICAgIHN1YmNvbW1hbmQ6IENsdXN0ZXJTZXRTbG90U3ViY29tbWFuZCxcbiAgICBub2RlSWQ/OiBzdHJpbmcsXG4gICkge1xuICAgIGlmIChub2RlSWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHRoaXMuZXhlY1N0YXR1c1JlcGx5KFxuICAgICAgICBcIkNMVVNURVJcIixcbiAgICAgICAgXCJTRVRTTE9UXCIsXG4gICAgICAgIHNsb3QsXG4gICAgICAgIHN1YmNvbW1hbmQsXG4gICAgICAgIG5vZGVJZCxcbiAgICAgICk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmV4ZWNTdGF0dXNSZXBseShcIkNMVVNURVJcIiwgXCJTRVRTTE9UXCIsIHNsb3QsIHN1YmNvbW1hbmQpO1xuICB9XG5cbiAgY2x1c3RlclNsYXZlcyhub2RlSWQ6IHN0cmluZykge1xuICAgIHJldHVybiB0aGlzLmV4ZWNBcnJheVJlcGx5PEJ1bGtTdHJpbmc+KFwiQ0xVU1RFUlwiLCBcIlNMQVZFU1wiLCBub2RlSWQpO1xuICB9XG5cbiAgY2x1c3RlclNsb3RzKCkge1xuICAgIHJldHVybiB0aGlzLmV4ZWNBcnJheVJlcGx5KFwiQ0xVU1RFUlwiLCBcIlNMT1RTXCIpO1xuICB9XG5cbiAgY29tbWFuZCgpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjQXJyYXlSZXBseShcIkNPTU1BTkRcIikgYXMgUHJvbWlzZTxcbiAgICAgIFtCdWxrU3RyaW5nLCBJbnRlZ2VyLCBCdWxrU3RyaW5nW10sIEludGVnZXIsIEludGVnZXIsIEludGVnZXJdW11cbiAgICA+O1xuICB9XG5cbiAgY29tbWFuZENvdW50KCkge1xuICAgIHJldHVybiB0aGlzLmV4ZWNJbnRlZ2VyUmVwbHkoXCJDT01NQU5EXCIsIFwiQ09VTlRcIik7XG4gIH1cblxuICBjb21tYW5kR2V0S2V5cygpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjQXJyYXlSZXBseTxCdWxrU3RyaW5nPihcIkNPTU1BTkRcIiwgXCJHRVRLRVlTXCIpO1xuICB9XG5cbiAgY29tbWFuZEluZm8oLi4uY29tbWFuZE5hbWVzOiBzdHJpbmdbXSkge1xuICAgIHJldHVybiB0aGlzLmV4ZWNBcnJheVJlcGx5KFwiQ09NTUFORFwiLCBcIklORk9cIiwgLi4uY29tbWFuZE5hbWVzKSBhcyBQcm9taXNlPFxuICAgICAgKFxuICAgICAgICB8IFtCdWxrU3RyaW5nLCBJbnRlZ2VyLCBCdWxrU3RyaW5nW10sIEludGVnZXIsIEludGVnZXIsIEludGVnZXJdXG4gICAgICAgIHwgQnVsa05pbFxuICAgICAgKVtdXG4gICAgPjtcbiAgfVxuXG4gIGNvbmZpZ0dldChwYXJhbWV0ZXI6IHN0cmluZykge1xuICAgIHJldHVybiB0aGlzLmV4ZWNBcnJheVJlcGx5PEJ1bGtTdHJpbmc+KFwiQ09ORklHXCIsIFwiR0VUXCIsIHBhcmFtZXRlcik7XG4gIH1cblxuICBjb25maWdSZXNldFN0YXQoKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY1N0YXR1c1JlcGx5KFwiQ09ORklHXCIsIFwiUkVTRVRTVEFUXCIpO1xuICB9XG5cbiAgY29uZmlnUmV3cml0ZSgpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjU3RhdHVzUmVwbHkoXCJDT05GSUdcIiwgXCJSRVdSSVRFXCIpO1xuICB9XG5cbiAgY29uZmlnU2V0KHBhcmFtZXRlcjogc3RyaW5nLCB2YWx1ZTogc3RyaW5nIHwgbnVtYmVyKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY1N0YXR1c1JlcGx5KFwiQ09ORklHXCIsIFwiU0VUXCIsIHBhcmFtZXRlciwgdmFsdWUpO1xuICB9XG5cbiAgZGJzaXplKCkge1xuICAgIHJldHVybiB0aGlzLmV4ZWNJbnRlZ2VyUmVwbHkoXCJEQlNJWkVcIik7XG4gIH1cblxuICBkZWJ1Z09iamVjdChrZXk6IHN0cmluZykge1xuICAgIHJldHVybiB0aGlzLmV4ZWNTdGF0dXNSZXBseShcIkRFQlVHXCIsIFwiT0JKRUNUXCIsIGtleSk7XG4gIH1cblxuICBkZWJ1Z1NlZ2ZhdWx0KCkge1xuICAgIHJldHVybiB0aGlzLmV4ZWNTdGF0dXNSZXBseShcIkRFQlVHXCIsIFwiU0VHRkFVTFRcIik7XG4gIH1cblxuICBkZWNyKGtleTogc3RyaW5nKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY0ludGVnZXJSZXBseShcIkRFQ1JcIiwga2V5KTtcbiAgfVxuXG4gIGRlY3JieShrZXk6IHN0cmluZywgZGVjcmVtZW50OiBudW1iZXIpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjSW50ZWdlclJlcGx5KFwiREVDUkJZXCIsIGtleSwgZGVjcmVtZW50KTtcbiAgfVxuXG4gIGRlbCguLi5rZXlzOiBzdHJpbmdbXSkge1xuICAgIHJldHVybiB0aGlzLmV4ZWNJbnRlZ2VyUmVwbHkoXCJERUxcIiwgLi4ua2V5cyk7XG4gIH1cblxuICBkaXNjYXJkKCkge1xuICAgIHJldHVybiB0aGlzLmV4ZWNTdGF0dXNSZXBseShcIkRJU0NBUkRcIik7XG4gIH1cblxuICBkdW1wKGtleTogc3RyaW5nKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY0JpbmFyeVJlcGx5KFwiRFVNUFwiLCBrZXkpO1xuICB9XG5cbiAgZWNobyhtZXNzYWdlOiBSZWRpc1ZhbHVlKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY0J1bGtSZXBseTxCdWxrU3RyaW5nPihcIkVDSE9cIiwgbWVzc2FnZSk7XG4gIH1cblxuICBldmFsKHNjcmlwdDogc3RyaW5nLCBrZXlzOiBzdHJpbmdbXSwgYXJnczogc3RyaW5nW10pIHtcbiAgICByZXR1cm4gdGhpcy5leGVjUmVwbHkoXG4gICAgICBcIkVWQUxcIixcbiAgICAgIHNjcmlwdCxcbiAgICAgIGtleXMubGVuZ3RoLFxuICAgICAgLi4ua2V5cyxcbiAgICAgIC4uLmFyZ3MsXG4gICAgKTtcbiAgfVxuXG4gIGV2YWxzaGEoc2hhMTogc3RyaW5nLCBrZXlzOiBzdHJpbmdbXSwgYXJnczogc3RyaW5nW10pIHtcbiAgICByZXR1cm4gdGhpcy5leGVjUmVwbHkoXG4gICAgICBcIkVWQUxTSEFcIixcbiAgICAgIHNoYTEsXG4gICAgICBrZXlzLmxlbmd0aCxcbiAgICAgIC4uLmtleXMsXG4gICAgICAuLi5hcmdzLFxuICAgICk7XG4gIH1cblxuICBleGVjKCkge1xuICAgIHJldHVybiB0aGlzLmV4ZWNBcnJheVJlcGx5KFwiRVhFQ1wiKTtcbiAgfVxuXG4gIGV4aXN0cyguLi5rZXlzOiBzdHJpbmdbXSkge1xuICAgIHJldHVybiB0aGlzLmV4ZWNJbnRlZ2VyUmVwbHkoXCJFWElTVFNcIiwgLi4ua2V5cyk7XG4gIH1cblxuICBleHBpcmUoa2V5OiBzdHJpbmcsIHNlY29uZHM6IG51bWJlcikge1xuICAgIHJldHVybiB0aGlzLmV4ZWNJbnRlZ2VyUmVwbHkoXCJFWFBJUkVcIiwga2V5LCBzZWNvbmRzKTtcbiAgfVxuXG4gIGV4cGlyZWF0KGtleTogc3RyaW5nLCB0aW1lc3RhbXA6IHN0cmluZykge1xuICAgIHJldHVybiB0aGlzLmV4ZWNJbnRlZ2VyUmVwbHkoXCJFWFBJUkVBVFwiLCBrZXksIHRpbWVzdGFtcCk7XG4gIH1cblxuICBmbHVzaGFsbChhc3luYz86IGJvb2xlYW4pIHtcbiAgICBpZiAoYXN5bmMpIHtcbiAgICAgIHJldHVybiB0aGlzLmV4ZWNTdGF0dXNSZXBseShcIkZMVVNIQUxMXCIsIFwiQVNZTkNcIik7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmV4ZWNTdGF0dXNSZXBseShcIkZMVVNIQUxMXCIpO1xuICB9XG5cbiAgZmx1c2hkYihhc3luYz86IGJvb2xlYW4pIHtcbiAgICBpZiAoYXN5bmMpIHtcbiAgICAgIHJldHVybiB0aGlzLmV4ZWNTdGF0dXNSZXBseShcIkZMVVNIREJcIiwgXCJBU1lOQ1wiKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuZXhlY1N0YXR1c1JlcGx5KFwiRkxVU0hEQlwiKTtcbiAgfVxuXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIGdlb2FkZChrZXk6IHN0cmluZywgLi4ucGFyYW1zOiBhbnlbXSkge1xuICAgIGNvbnN0IGFyZ3M6IChzdHJpbmcgfCBudW1iZXIpW10gPSBba2V5XTtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShwYXJhbXNbMF0pKSB7XG4gICAgICBhcmdzLnB1c2goLi4ucGFyYW1zLmZsYXRNYXAoKGUpID0+IGUpKTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBwYXJhbXNbMF0gPT09IFwib2JqZWN0XCIpIHtcbiAgICAgIGZvciAoY29uc3QgW21lbWJlciwgbG5nbGF0XSBvZiBPYmplY3QuZW50cmllcyhwYXJhbXNbMF0pKSB7XG4gICAgICAgIGFyZ3MucHVzaCguLi4obG5nbGF0IGFzIFtudW1iZXIsIG51bWJlcl0pLCBtZW1iZXIpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBhcmdzLnB1c2goLi4ucGFyYW1zKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuZXhlY0ludGVnZXJSZXBseShcIkdFT0FERFwiLCAuLi5hcmdzKTtcbiAgfVxuXG4gIGdlb2hhc2goa2V5OiBzdHJpbmcsIC4uLm1lbWJlcnM6IHN0cmluZ1tdKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY0FycmF5UmVwbHk8QnVsaz4oXCJHRU9IQVNIXCIsIGtleSwgLi4ubWVtYmVycyk7XG4gIH1cblxuICBnZW9wb3Moa2V5OiBzdHJpbmcsIC4uLm1lbWJlcnM6IHN0cmluZ1tdKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY0FycmF5UmVwbHkoXCJHRU9QT1NcIiwga2V5LCAuLi5tZW1iZXJzKSBhcyBQcm9taXNlPFxuICAgICAgKFtCdWxrU3RyaW5nLCBCdWxrU3RyaW5nXSB8IEJ1bGtOaWwgfCBbXSlbXVxuICAgID47XG4gIH1cblxuICBnZW9kaXN0KFxuICAgIGtleTogc3RyaW5nLFxuICAgIG1lbWJlcjE6IHN0cmluZyxcbiAgICBtZW1iZXIyOiBzdHJpbmcsXG4gICAgdW5pdD86IEdlb1VuaXQsXG4gICkge1xuICAgIGlmICh1bml0KSB7XG4gICAgICByZXR1cm4gdGhpcy5leGVjQnVsa1JlcGx5KFwiR0VPRElTVFwiLCBrZXksIG1lbWJlcjEsIG1lbWJlcjIsIHVuaXQpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5leGVjQnVsa1JlcGx5KFwiR0VPRElTVFwiLCBrZXksIG1lbWJlcjEsIG1lbWJlcjIpO1xuICB9XG5cbiAgZ2VvcmFkaXVzKFxuICAgIGtleTogc3RyaW5nLFxuICAgIGxvbmdpdHVkZTogbnVtYmVyLFxuICAgIGxhdGl0dWRlOiBudW1iZXIsXG4gICAgcmFkaXVzOiBudW1iZXIsXG4gICAgdW5pdDogXCJtXCIgfCBcImttXCIgfCBcImZ0XCIgfCBcIm1pXCIsXG4gICAgb3B0cz86IEdlb1JhZGl1c09wdHMsXG4gICkge1xuICAgIGNvbnN0IGFyZ3MgPSB0aGlzLnB1c2hHZW9SYWRpdXNPcHRzKFxuICAgICAgW2tleSwgbG9uZ2l0dWRlLCBsYXRpdHVkZSwgcmFkaXVzLCB1bml0XSxcbiAgICAgIG9wdHMsXG4gICAgKTtcbiAgICByZXR1cm4gdGhpcy5leGVjQXJyYXlSZXBseShcIkdFT1JBRElVU1wiLCAuLi5hcmdzKTtcbiAgfVxuXG4gIGdlb3JhZGl1c2J5bWVtYmVyKFxuICAgIGtleTogc3RyaW5nLFxuICAgIG1lbWJlcjogc3RyaW5nLFxuICAgIHJhZGl1czogbnVtYmVyLFxuICAgIHVuaXQ6IEdlb1VuaXQsXG4gICAgb3B0cz86IEdlb1JhZGl1c09wdHMsXG4gICkge1xuICAgIGNvbnN0IGFyZ3MgPSB0aGlzLnB1c2hHZW9SYWRpdXNPcHRzKFtrZXksIG1lbWJlciwgcmFkaXVzLCB1bml0XSwgb3B0cyk7XG4gICAgcmV0dXJuIHRoaXMuZXhlY0FycmF5UmVwbHkoXCJHRU9SQURJVVNCWU1FTUJFUlwiLCAuLi5hcmdzKTtcbiAgfVxuXG4gIHByaXZhdGUgcHVzaEdlb1JhZGl1c09wdHMoXG4gICAgYXJnczogKHN0cmluZyB8IG51bWJlcilbXSxcbiAgICBvcHRzPzogR2VvUmFkaXVzT3B0cyxcbiAgKSB7XG4gICAgaWYgKG9wdHM/LndpdGhDb29yZCkge1xuICAgICAgYXJncy5wdXNoKFwiV0lUSENPT1JEXCIpO1xuICAgIH1cbiAgICBpZiAob3B0cz8ud2l0aERpc3QpIHtcbiAgICAgIGFyZ3MucHVzaChcIldJVEhESVNUXCIpO1xuICAgIH1cbiAgICBpZiAob3B0cz8ud2l0aEhhc2gpIHtcbiAgICAgIGFyZ3MucHVzaChcIldJVEhIQVNIXCIpO1xuICAgIH1cbiAgICBpZiAob3B0cz8uY291bnQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgYXJncy5wdXNoKG9wdHMuY291bnQpO1xuICAgIH1cbiAgICBpZiAob3B0cz8uc29ydCkge1xuICAgICAgYXJncy5wdXNoKG9wdHMuc29ydCk7XG4gICAgfVxuICAgIGlmIChvcHRzPy5zdG9yZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBhcmdzLnB1c2gob3B0cy5zdG9yZSk7XG4gICAgfVxuICAgIGlmIChvcHRzPy5zdG9yZURpc3QgIT09IHVuZGVmaW5lZCkge1xuICAgICAgYXJncy5wdXNoKG9wdHMuc3RvcmVEaXN0KTtcbiAgICB9XG4gICAgcmV0dXJuIGFyZ3M7XG4gIH1cblxuICBnZXQoa2V5OiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjQnVsa1JlcGx5KFwiR0VUXCIsIGtleSk7XG4gIH1cblxuICBnZXRiaXQoa2V5OiBzdHJpbmcsIG9mZnNldDogbnVtYmVyKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY0ludGVnZXJSZXBseShcIkdFVEJJVFwiLCBrZXksIG9mZnNldCk7XG4gIH1cblxuICBnZXRyYW5nZShrZXk6IHN0cmluZywgc3RhcnQ6IG51bWJlciwgZW5kOiBudW1iZXIpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjQnVsa1JlcGx5PEJ1bGtTdHJpbmc+KFwiR0VUUkFOR0VcIiwga2V5LCBzdGFydCwgZW5kKTtcbiAgfVxuXG4gIGdldHNldChrZXk6IHN0cmluZywgdmFsdWU6IFJlZGlzVmFsdWUpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjQnVsa1JlcGx5KFwiR0VUU0VUXCIsIGtleSwgdmFsdWUpO1xuICB9XG5cbiAgaGRlbChrZXk6IHN0cmluZywgLi4uZmllbGRzOiBzdHJpbmdbXSkge1xuICAgIHJldHVybiB0aGlzLmV4ZWNJbnRlZ2VyUmVwbHkoXCJIREVMXCIsIGtleSwgLi4uZmllbGRzKTtcbiAgfVxuXG4gIGhleGlzdHMoa2V5OiBzdHJpbmcsIGZpZWxkOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjSW50ZWdlclJlcGx5KFwiSEVYSVNUU1wiLCBrZXksIGZpZWxkKTtcbiAgfVxuXG4gIGhnZXQoa2V5OiBzdHJpbmcsIGZpZWxkOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjQnVsa1JlcGx5KFwiSEdFVFwiLCBrZXksIGZpZWxkKTtcbiAgfVxuXG4gIGhnZXRhbGwoa2V5OiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjQXJyYXlSZXBseTxCdWxrU3RyaW5nPihcIkhHRVRBTExcIiwga2V5KTtcbiAgfVxuXG4gIGhpbmNyYnkoa2V5OiBzdHJpbmcsIGZpZWxkOiBzdHJpbmcsIGluY3JlbWVudDogbnVtYmVyKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY0ludGVnZXJSZXBseShcIkhJTkNSQllcIiwga2V5LCBmaWVsZCwgaW5jcmVtZW50KTtcbiAgfVxuXG4gIGhpbmNyYnlmbG9hdChrZXk6IHN0cmluZywgZmllbGQ6IHN0cmluZywgaW5jcmVtZW50OiBudW1iZXIpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjQnVsa1JlcGx5PEJ1bGtTdHJpbmc+KFxuICAgICAgXCJISU5DUkJZRkxPQVRcIixcbiAgICAgIGtleSxcbiAgICAgIGZpZWxkLFxuICAgICAgaW5jcmVtZW50LFxuICAgICk7XG4gIH1cblxuICBoa2V5cyhrZXk6IHN0cmluZykge1xuICAgIHJldHVybiB0aGlzLmV4ZWNBcnJheVJlcGx5PEJ1bGtTdHJpbmc+KFwiSEtFWVNcIiwga2V5KTtcbiAgfVxuXG4gIGhsZW4oa2V5OiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjSW50ZWdlclJlcGx5KFwiSExFTlwiLCBrZXkpO1xuICB9XG5cbiAgaG1nZXQoa2V5OiBzdHJpbmcsIC4uLmZpZWxkczogc3RyaW5nW10pIHtcbiAgICByZXR1cm4gdGhpcy5leGVjQXJyYXlSZXBseTxCdWxrPihcIkhNR0VUXCIsIGtleSwgLi4uZmllbGRzKTtcbiAgfVxuXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIGhtc2V0KGtleTogc3RyaW5nLCAuLi5wYXJhbXM6IGFueVtdKSB7XG4gICAgY29uc3QgYXJncyA9IFtrZXldIGFzIFJlZGlzVmFsdWVbXTtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShwYXJhbXNbMF0pKSB7XG4gICAgICBhcmdzLnB1c2goLi4ucGFyYW1zLmZsYXRNYXAoKGUpID0+IGUpKTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBwYXJhbXNbMF0gPT09IFwib2JqZWN0XCIpIHtcbiAgICAgIGZvciAoY29uc3QgW2ZpZWxkLCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMocGFyYW1zWzBdKSkge1xuICAgICAgICBhcmdzLnB1c2goZmllbGQsIHZhbHVlIGFzIFJlZGlzVmFsdWUpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBhcmdzLnB1c2goLi4ucGFyYW1zKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuZXhlY1N0YXR1c1JlcGx5KFwiSE1TRVRcIiwgLi4uYXJncyk7XG4gIH1cblxuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICBoc2V0KGtleTogc3RyaW5nLCAuLi5wYXJhbXM6IGFueVtdKSB7XG4gICAgY29uc3QgYXJncyA9IFtrZXldIGFzIFJlZGlzVmFsdWVbXTtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShwYXJhbXNbMF0pKSB7XG4gICAgICBhcmdzLnB1c2goLi4ucGFyYW1zLmZsYXRNYXAoKGUpID0+IGUpKTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBwYXJhbXNbMF0gPT09IFwib2JqZWN0XCIpIHtcbiAgICAgIGZvciAoY29uc3QgW2ZpZWxkLCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMocGFyYW1zWzBdKSkge1xuICAgICAgICBhcmdzLnB1c2goZmllbGQsIHZhbHVlIGFzIFJlZGlzVmFsdWUpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBhcmdzLnB1c2goLi4ucGFyYW1zKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuZXhlY0ludGVnZXJSZXBseShcIkhTRVRcIiwgLi4uYXJncyk7XG4gIH1cblxuICBoc2V0bngoa2V5OiBzdHJpbmcsIGZpZWxkOiBzdHJpbmcsIHZhbHVlOiBSZWRpc1ZhbHVlKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY0ludGVnZXJSZXBseShcIkhTRVROWFwiLCBrZXksIGZpZWxkLCB2YWx1ZSk7XG4gIH1cblxuICBoc3RybGVuKGtleTogc3RyaW5nLCBmaWVsZDogc3RyaW5nKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY0ludGVnZXJSZXBseShcIkhTVFJMRU5cIiwga2V5LCBmaWVsZCk7XG4gIH1cblxuICBodmFscyhrZXk6IHN0cmluZykge1xuICAgIHJldHVybiB0aGlzLmV4ZWNBcnJheVJlcGx5PEJ1bGtTdHJpbmc+KFwiSFZBTFNcIiwga2V5KTtcbiAgfVxuXG4gIGluY3Ioa2V5OiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjSW50ZWdlclJlcGx5KFwiSU5DUlwiLCBrZXkpO1xuICB9XG5cbiAgaW5jcmJ5KGtleTogc3RyaW5nLCBpbmNyZW1lbnQ6IG51bWJlcikge1xuICAgIHJldHVybiB0aGlzLmV4ZWNJbnRlZ2VyUmVwbHkoXCJJTkNSQllcIiwga2V5LCBpbmNyZW1lbnQpO1xuICB9XG5cbiAgaW5jcmJ5ZmxvYXQoa2V5OiBzdHJpbmcsIGluY3JlbWVudDogbnVtYmVyKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY0J1bGtSZXBseTxCdWxrU3RyaW5nPihcIklOQ1JCWUZMT0FUXCIsIGtleSwgaW5jcmVtZW50KTtcbiAgfVxuXG4gIGluZm8oc2VjdGlvbj86IHN0cmluZykge1xuICAgIGlmIChzZWN0aW9uICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB0aGlzLmV4ZWNTdGF0dXNSZXBseShcIklORk9cIiwgc2VjdGlvbik7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmV4ZWNTdGF0dXNSZXBseShcIklORk9cIik7XG4gIH1cblxuICBrZXlzKHBhdHRlcm46IHN0cmluZykge1xuICAgIHJldHVybiB0aGlzLmV4ZWNBcnJheVJlcGx5PEJ1bGtTdHJpbmc+KFwiS0VZU1wiLCBwYXR0ZXJuKTtcbiAgfVxuXG4gIGxhc3RzYXZlKCkge1xuICAgIHJldHVybiB0aGlzLmV4ZWNJbnRlZ2VyUmVwbHkoXCJMQVNUU0FWRVwiKTtcbiAgfVxuXG4gIGxpbmRleChrZXk6IHN0cmluZywgaW5kZXg6IG51bWJlcikge1xuICAgIHJldHVybiB0aGlzLmV4ZWNCdWxrUmVwbHkoXCJMSU5ERVhcIiwga2V5LCBpbmRleCk7XG4gIH1cblxuICBsaW5zZXJ0KGtleTogc3RyaW5nLCBsb2M6IExJbnNlcnRMb2NhdGlvbiwgcGl2b3Q6IHN0cmluZywgdmFsdWU6IFJlZGlzVmFsdWUpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjSW50ZWdlclJlcGx5KFwiTElOU0VSVFwiLCBrZXksIGxvYywgcGl2b3QsIHZhbHVlKTtcbiAgfVxuXG4gIGxsZW4oa2V5OiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjSW50ZWdlclJlcGx5KFwiTExFTlwiLCBrZXkpO1xuICB9XG5cbiAgbHBvcChrZXk6IHN0cmluZykge1xuICAgIHJldHVybiB0aGlzLmV4ZWNCdWxrUmVwbHkoXCJMUE9QXCIsIGtleSk7XG4gIH1cblxuICBscG9zKFxuICAgIGtleTogc3RyaW5nLFxuICAgIGVsZW1lbnQ6IFJlZGlzVmFsdWUsXG4gICAgb3B0cz86IExQb3NPcHRzLFxuICApOiBQcm9taXNlPEludGVnZXIgfCBCdWxrTmlsPjtcblxuICBscG9zKFxuICAgIGtleTogc3RyaW5nLFxuICAgIGVsZW1lbnQ6IFJlZGlzVmFsdWUsXG4gICAgb3B0czogTFBvc1dpdGhDb3VudE9wdHMsXG4gICk6IFByb21pc2U8SW50ZWdlcltdPjtcblxuICBscG9zKFxuICAgIGtleTogc3RyaW5nLFxuICAgIGVsZW1lbnQ6IFJlZGlzVmFsdWUsXG4gICAgb3B0cz86IExQb3NPcHRzIHwgTFBvc1dpdGhDb3VudE9wdHMsXG4gICk6IFByb21pc2U8SW50ZWdlciB8IEJ1bGtOaWwgfCBJbnRlZ2VyW10+IHtcbiAgICBjb25zdCBhcmdzID0gW2VsZW1lbnRdO1xuICAgIGlmIChvcHRzPy5yYW5rICE9IG51bGwpIHtcbiAgICAgIGFyZ3MucHVzaChcIlJBTktcIiwgU3RyaW5nKG9wdHMucmFuaykpO1xuICAgIH1cblxuICAgIGlmIChvcHRzPy5jb3VudCAhPSBudWxsKSB7XG4gICAgICBhcmdzLnB1c2goXCJDT1VOVFwiLCBTdHJpbmcob3B0cy5jb3VudCkpO1xuICAgIH1cblxuICAgIGlmIChvcHRzPy5tYXhsZW4gIT0gbnVsbCkge1xuICAgICAgYXJncy5wdXNoKFwiTUFYTEVOXCIsIFN0cmluZyhvcHRzLm1heGxlbikpO1xuICAgIH1cblxuICAgIHJldHVybiBvcHRzPy5jb3VudCA9PSBudWxsXG4gICAgICA/IHRoaXMuZXhlY0ludGVnZXJSZXBseShcIkxQT1NcIiwga2V5LCAuLi5hcmdzKVxuICAgICAgOiB0aGlzLmV4ZWNBcnJheVJlcGx5PEludGVnZXI+KFwiTFBPU1wiLCBrZXksIC4uLmFyZ3MpO1xuICB9XG5cbiAgbHB1c2goa2V5OiBzdHJpbmcsIC4uLmVsZW1lbnRzOiBSZWRpc1ZhbHVlW10pIHtcbiAgICByZXR1cm4gdGhpcy5leGVjSW50ZWdlclJlcGx5KFwiTFBVU0hcIiwga2V5LCAuLi5lbGVtZW50cyk7XG4gIH1cblxuICBscHVzaHgoa2V5OiBzdHJpbmcsIC4uLmVsZW1lbnRzOiBSZWRpc1ZhbHVlW10pIHtcbiAgICByZXR1cm4gdGhpcy5leGVjSW50ZWdlclJlcGx5KFwiTFBVU0hYXCIsIGtleSwgLi4uZWxlbWVudHMpO1xuICB9XG5cbiAgbHJhbmdlKGtleTogc3RyaW5nLCBzdGFydDogbnVtYmVyLCBzdG9wOiBudW1iZXIpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjQXJyYXlSZXBseTxCdWxrU3RyaW5nPihcIkxSQU5HRVwiLCBrZXksIHN0YXJ0LCBzdG9wKTtcbiAgfVxuXG4gIGxyZW0oa2V5OiBzdHJpbmcsIGNvdW50OiBudW1iZXIsIGVsZW1lbnQ6IHN0cmluZyB8IG51bWJlcikge1xuICAgIHJldHVybiB0aGlzLmV4ZWNJbnRlZ2VyUmVwbHkoXCJMUkVNXCIsIGtleSwgY291bnQsIGVsZW1lbnQpO1xuICB9XG5cbiAgbHNldChrZXk6IHN0cmluZywgaW5kZXg6IG51bWJlciwgZWxlbWVudDogc3RyaW5nIHwgbnVtYmVyKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY1N0YXR1c1JlcGx5KFwiTFNFVFwiLCBrZXksIGluZGV4LCBlbGVtZW50KTtcbiAgfVxuXG4gIGx0cmltKGtleTogc3RyaW5nLCBzdGFydDogbnVtYmVyLCBzdG9wOiBudW1iZXIpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjU3RhdHVzUmVwbHkoXCJMVFJJTVwiLCBrZXksIHN0YXJ0LCBzdG9wKTtcbiAgfVxuXG4gIG1lbW9yeURvY3RvcigpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjQnVsa1JlcGx5PEJ1bGtTdHJpbmc+KFwiTUVNT1JZXCIsIFwiRE9DVE9SXCIpO1xuICB9XG5cbiAgbWVtb3J5SGVscCgpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjQXJyYXlSZXBseTxCdWxrU3RyaW5nPihcIk1FTU9SWVwiLCBcIkhFTFBcIik7XG4gIH1cblxuICBtZW1vcnlNYWxsb2NTdGF0cygpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjQnVsa1JlcGx5PEJ1bGtTdHJpbmc+KFwiTUVNT1JZXCIsIFwiTUFMTE9DXCIsIFwiU1RBVFNcIik7XG4gIH1cblxuICBtZW1vcnlQdXJnZSgpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjU3RhdHVzUmVwbHkoXCJNRU1PUllcIiwgXCJQVVJHRVwiKTtcbiAgfVxuXG4gIG1lbW9yeVN0YXRzKCkge1xuICAgIHJldHVybiB0aGlzLmV4ZWNBcnJheVJlcGx5KFwiTUVNT1JZXCIsIFwiU1RBVFNcIik7XG4gIH1cblxuICBtZW1vcnlVc2FnZShrZXk6IHN0cmluZywgb3B0cz86IE1lbW9yeVVzYWdlT3B0cykge1xuICAgIGNvbnN0IGFyZ3M6IChudW1iZXIgfCBzdHJpbmcpW10gPSBba2V5XTtcbiAgICBpZiAob3B0cz8uc2FtcGxlcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBhcmdzLnB1c2goXCJTQU1QTEVTXCIsIG9wdHMuc2FtcGxlcyk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmV4ZWNJbnRlZ2VyUmVwbHkoXCJNRU1PUllcIiwgXCJVU0FHRVwiLCAuLi5hcmdzKTtcbiAgfVxuXG4gIG1nZXQoLi4ua2V5czogc3RyaW5nW10pIHtcbiAgICByZXR1cm4gdGhpcy5leGVjQXJyYXlSZXBseTxCdWxrPihcIk1HRVRcIiwgLi4ua2V5cyk7XG4gIH1cblxuICBtaWdyYXRlKFxuICAgIGhvc3Q6IHN0cmluZyxcbiAgICBwb3J0OiBudW1iZXIsXG4gICAga2V5OiBzdHJpbmcsXG4gICAgZGVzdGluYXRpb25EQjogc3RyaW5nLFxuICAgIHRpbWVvdXQ6IG51bWJlcixcbiAgICBvcHRzPzogTWlncmF0ZU9wdHMsXG4gICkge1xuICAgIGNvbnN0IGFyZ3MgPSBbaG9zdCwgcG9ydCwga2V5LCBkZXN0aW5hdGlvbkRCLCB0aW1lb3V0XTtcbiAgICBpZiAob3B0cz8uY29weSkge1xuICAgICAgYXJncy5wdXNoKFwiQ09QWVwiKTtcbiAgICB9XG4gICAgaWYgKG9wdHM/LnJlcGxhY2UpIHtcbiAgICAgIGFyZ3MucHVzaChcIlJFUExBQ0VcIik7XG4gICAgfVxuICAgIGlmIChvcHRzPy5hdXRoICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGFyZ3MucHVzaChcIkFVVEhcIiwgb3B0cy5hdXRoKTtcbiAgICB9XG4gICAgaWYgKG9wdHM/LmtleXMpIHtcbiAgICAgIGFyZ3MucHVzaChcIktFWVNcIiwgLi4ub3B0cy5rZXlzKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuZXhlY1N0YXR1c1JlcGx5KFwiTUlHUkFURVwiLCAuLi5hcmdzKTtcbiAgfVxuXG4gIG1vZHVsZUxpc3QoKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY0FycmF5UmVwbHk8QnVsa1N0cmluZz4oXCJNT0RVTEVcIiwgXCJMSVNUXCIpO1xuICB9XG5cbiAgbW9kdWxlTG9hZChwYXRoOiBzdHJpbmcsIC4uLmFyZ3M6IHN0cmluZ1tdKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY1N0YXR1c1JlcGx5KFwiTU9EVUxFXCIsIFwiTE9BRFwiLCBwYXRoLCAuLi5hcmdzKTtcbiAgfVxuXG4gIG1vZHVsZVVubG9hZChuYW1lOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjU3RhdHVzUmVwbHkoXCJNT0RVTEVcIiwgXCJVTkxPQURcIiwgbmFtZSk7XG4gIH1cblxuICBtb25pdG9yKCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIm5vdCBzdXBwb3J0ZWQgeWV0XCIpO1xuICB9XG5cbiAgbW92ZShrZXk6IHN0cmluZywgZGI6IHN0cmluZykge1xuICAgIHJldHVybiB0aGlzLmV4ZWNJbnRlZ2VyUmVwbHkoXCJNT1ZFXCIsIGtleSwgZGIpO1xuICB9XG5cbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgbXNldCguLi5wYXJhbXM6IGFueVtdKSB7XG4gICAgY29uc3QgYXJnczogUmVkaXNWYWx1ZVtdID0gW107XG4gICAgaWYgKEFycmF5LmlzQXJyYXkocGFyYW1zWzBdKSkge1xuICAgICAgYXJncy5wdXNoKC4uLnBhcmFtcy5mbGF0TWFwKChlKSA9PiBlKSk7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgcGFyYW1zWzBdID09PSBcIm9iamVjdFwiKSB7XG4gICAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhwYXJhbXNbMF0pKSB7XG4gICAgICAgIGFyZ3MucHVzaChrZXksIHZhbHVlIGFzIFJlZGlzVmFsdWUpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBhcmdzLnB1c2goLi4ucGFyYW1zKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuZXhlY1N0YXR1c1JlcGx5KFwiTVNFVFwiLCAuLi5hcmdzKTtcbiAgfVxuXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIG1zZXRueCguLi5wYXJhbXM6IGFueVtdKSB7XG4gICAgY29uc3QgYXJnczogUmVkaXNWYWx1ZVtdID0gW107XG4gICAgaWYgKEFycmF5LmlzQXJyYXkocGFyYW1zWzBdKSkge1xuICAgICAgYXJncy5wdXNoKC4uLnBhcmFtcy5mbGF0TWFwKChlKSA9PiBlKSk7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgcGFyYW1zWzBdID09PSBcIm9iamVjdFwiKSB7XG4gICAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhwYXJhbXNbMF0pKSB7XG4gICAgICAgIGFyZ3MucHVzaChrZXksIHZhbHVlIGFzIFJlZGlzVmFsdWUpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBhcmdzLnB1c2goLi4ucGFyYW1zKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuZXhlY0ludGVnZXJSZXBseShcIk1TRVROWFwiLCAuLi5hcmdzKTtcbiAgfVxuXG4gIG11bHRpKCkge1xuICAgIHJldHVybiB0aGlzLmV4ZWNTdGF0dXNSZXBseShcIk1VTFRJXCIpO1xuICB9XG5cbiAgb2JqZWN0RW5jb2Rpbmcoa2V5OiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjQnVsa1JlcGx5KFwiT0JKRUNUXCIsIFwiRU5DT0RJTkdcIiwga2V5KTtcbiAgfVxuXG4gIG9iamVjdEZyZXEoa2V5OiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjSW50ZWdlck9yTmlsUmVwbHkoXCJPQkpFQ1RcIiwgXCJGUkVRXCIsIGtleSk7XG4gIH1cblxuICBvYmplY3RIZWxwKCkge1xuICAgIHJldHVybiB0aGlzLmV4ZWNBcnJheVJlcGx5PEJ1bGtTdHJpbmc+KFwiT0JKRUNUXCIsIFwiSEVMUFwiKTtcbiAgfVxuXG4gIG9iamVjdElkbGV0aW1lKGtleTogc3RyaW5nKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY0ludGVnZXJPck5pbFJlcGx5KFwiT0JKRUNUXCIsIFwiSURMRVRJTUVcIiwga2V5KTtcbiAgfVxuXG4gIG9iamVjdFJlZkNvdW50KGtleTogc3RyaW5nKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY0ludGVnZXJPck5pbFJlcGx5KFwiT0JKRUNUXCIsIFwiUkVGQ09VTlRcIiwga2V5KTtcbiAgfVxuXG4gIHBlcnNpc3Qoa2V5OiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjSW50ZWdlclJlcGx5KFwiUEVSU0lTVFwiLCBrZXkpO1xuICB9XG5cbiAgcGV4cGlyZShrZXk6IHN0cmluZywgbWlsbGlzZWNvbmRzOiBudW1iZXIpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjSW50ZWdlclJlcGx5KFwiUEVYUElSRVwiLCBrZXksIG1pbGxpc2Vjb25kcyk7XG4gIH1cblxuICBwZXhwaXJlYXQoa2V5OiBzdHJpbmcsIG1pbGxpc2Vjb25kc1RpbWVzdGFtcDogbnVtYmVyKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY0ludGVnZXJSZXBseShcIlBFWFBJUkVBVFwiLCBrZXksIG1pbGxpc2Vjb25kc1RpbWVzdGFtcCk7XG4gIH1cblxuICBwZmFkZChrZXk6IHN0cmluZywgLi4uZWxlbWVudHM6IHN0cmluZ1tdKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY0ludGVnZXJSZXBseShcIlBGQUREXCIsIGtleSwgLi4uZWxlbWVudHMpO1xuICB9XG5cbiAgcGZjb3VudCguLi5rZXlzOiBzdHJpbmdbXSkge1xuICAgIHJldHVybiB0aGlzLmV4ZWNJbnRlZ2VyUmVwbHkoXCJQRkNPVU5UXCIsIC4uLmtleXMpO1xuICB9XG5cbiAgcGZtZXJnZShkZXN0a2V5OiBzdHJpbmcsIC4uLnNvdXJjZWtleXM6IHN0cmluZ1tdKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY1N0YXR1c1JlcGx5KFwiUEZNRVJHRVwiLCBkZXN0a2V5LCAuLi5zb3VyY2VrZXlzKTtcbiAgfVxuXG4gIHBpbmcobWVzc2FnZT86IFJlZGlzVmFsdWUpIHtcbiAgICBpZiAobWVzc2FnZSkge1xuICAgICAgcmV0dXJuIHRoaXMuZXhlY0J1bGtSZXBseTxCdWxrU3RyaW5nPihcIlBJTkdcIiwgbWVzc2FnZSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmV4ZWNTdGF0dXNSZXBseShcIlBJTkdcIik7XG4gIH1cblxuICBwc2V0ZXgoa2V5OiBzdHJpbmcsIG1pbGxpc2Vjb25kczogbnVtYmVyLCB2YWx1ZTogUmVkaXNWYWx1ZSkge1xuICAgIHJldHVybiB0aGlzLmV4ZWNTdGF0dXNSZXBseShcIlBTRVRFWFwiLCBrZXksIG1pbGxpc2Vjb25kcywgdmFsdWUpO1xuICB9XG5cbiAgcHVibGlzaChjaGFubmVsOiBzdHJpbmcsIG1lc3NhZ2U6IHN0cmluZykge1xuICAgIHJldHVybiB0aGlzLmV4ZWNJbnRlZ2VyUmVwbHkoXCJQVUJMSVNIXCIsIGNoYW5uZWwsIG1lc3NhZ2UpO1xuICB9XG5cbiAgc3Vic2NyaWJlPFRNZXNzYWdlIGV4dGVuZHMgc3RyaW5nIHwgc3RyaW5nW10gfCBVaW50OEFycmF5ID0gc3RyaW5nPihcbiAgICAuLi5jaGFubmVsczogc3RyaW5nW11cbiAgKSB7XG4gICAgcmV0dXJuIHN1YnNjcmliZTxUTWVzc2FnZT4odGhpcy5leGVjdXRvciwgLi4uY2hhbm5lbHMpO1xuICB9XG5cbiAgcHN1YnNjcmliZTxUTWVzc2FnZSBleHRlbmRzIHN0cmluZyB8IHN0cmluZ1tdIHwgVWludDhBcnJheSA9IHN0cmluZz4oXG4gICAgLi4ucGF0dGVybnM6IHN0cmluZ1tdXG4gICkge1xuICAgIHJldHVybiBwc3Vic2NyaWJlPFRNZXNzYWdlPih0aGlzLmV4ZWN1dG9yLCAuLi5wYXR0ZXJucyk7XG4gIH1cblxuICBwdWJzdWJDaGFubmVscyhwYXR0ZXJuPzogc3RyaW5nKSB7XG4gICAgaWYgKHBhdHRlcm4gIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHRoaXMuZXhlY0FycmF5UmVwbHk8QnVsa1N0cmluZz4oXCJQVUJTVUJcIiwgXCJDSEFOTkVMU1wiLCBwYXR0ZXJuKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuZXhlY0FycmF5UmVwbHk8QnVsa1N0cmluZz4oXCJQVUJTVUJcIiwgXCJDSEFOTkVMU1wiKTtcbiAgfVxuXG4gIHB1YnN1Yk51bXBhdCgpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjSW50ZWdlclJlcGx5KFwiUFVCU1VCXCIsIFwiTlVNUEFUXCIpO1xuICB9XG5cbiAgcHVic3ViTnVtc3ViKC4uLmNoYW5uZWxzOiBzdHJpbmdbXSkge1xuICAgIHJldHVybiB0aGlzLmV4ZWNBcnJheVJlcGx5PEJ1bGtTdHJpbmcgfCBJbnRlZ2VyPihcbiAgICAgIFwiUFVCU1VCXCIsXG4gICAgICBcIk5VTVNVQlwiLFxuICAgICAgLi4uY2hhbm5lbHMsXG4gICAgKTtcbiAgfVxuXG4gIHB0dGwoa2V5OiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjSW50ZWdlclJlcGx5KFwiUFRUTFwiLCBrZXkpO1xuICB9XG5cbiAgcXVpdCgpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjU3RhdHVzUmVwbHkoXCJRVUlUXCIpLmZpbmFsbHkoKCkgPT4gdGhpcy5jbG9zZSgpKTtcbiAgfVxuXG4gIHJhbmRvbWtleSgpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjQnVsa1JlcGx5KFwiUkFORE9NS0VZXCIpO1xuICB9XG5cbiAgcmVhZG9ubHkoKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY1N0YXR1c1JlcGx5KFwiUkVBRE9OTFlcIik7XG4gIH1cblxuICByZWFkd3JpdGUoKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY1N0YXR1c1JlcGx5KFwiUkVBRFdSSVRFXCIpO1xuICB9XG5cbiAgcmVuYW1lKGtleTogc3RyaW5nLCBuZXdrZXk6IHN0cmluZykge1xuICAgIHJldHVybiB0aGlzLmV4ZWNTdGF0dXNSZXBseShcIlJFTkFNRVwiLCBrZXksIG5ld2tleSk7XG4gIH1cblxuICByZW5hbWVueChrZXk6IHN0cmluZywgbmV3a2V5OiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjSW50ZWdlclJlcGx5KFwiUkVOQU1FTlhcIiwga2V5LCBuZXdrZXkpO1xuICB9XG5cbiAgcmVzdG9yZShcbiAgICBrZXk6IHN0cmluZyxcbiAgICB0dGw6IG51bWJlcixcbiAgICBzZXJpYWxpemVkVmFsdWU6IEJpbmFyeSxcbiAgICBvcHRzPzogUmVzdG9yZU9wdHMsXG4gICkge1xuICAgIGNvbnN0IGFyZ3MgPSBba2V5LCB0dGwsIHNlcmlhbGl6ZWRWYWx1ZV07XG4gICAgaWYgKG9wdHM/LnJlcGxhY2UpIHtcbiAgICAgIGFyZ3MucHVzaChcIlJFUExBQ0VcIik7XG4gICAgfVxuICAgIGlmIChvcHRzPy5hYnN0dGwpIHtcbiAgICAgIGFyZ3MucHVzaChcIkFCU1RUTFwiKTtcbiAgICB9XG4gICAgaWYgKG9wdHM/LmlkbGV0aW1lICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGFyZ3MucHVzaChcIklETEVUSU1FXCIsIG9wdHMuaWRsZXRpbWUpO1xuICAgIH1cbiAgICBpZiAob3B0cz8uZnJlcSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBhcmdzLnB1c2goXCJGUkVRXCIsIG9wdHMuZnJlcSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmV4ZWNTdGF0dXNSZXBseShcIlJFU1RPUkVcIiwgLi4uYXJncyk7XG4gIH1cblxuICByb2xlKCkge1xuICAgIHJldHVybiB0aGlzLmV4ZWNBcnJheVJlcGx5KFwiUk9MRVwiKSBhcyBQcm9taXNlPFxuICAgICAgfCBbXCJtYXN0ZXJcIiwgSW50ZWdlciwgQnVsa1N0cmluZ1tdW11dXG4gICAgICB8IFtcInNsYXZlXCIsIEJ1bGtTdHJpbmcsIEludGVnZXIsIEJ1bGtTdHJpbmcsIEludGVnZXJdXG4gICAgICB8IFtcInNlbnRpbmVsXCIsIEJ1bGtTdHJpbmdbXV1cbiAgICA+O1xuICB9XG5cbiAgcnBvcChrZXk6IHN0cmluZykge1xuICAgIHJldHVybiB0aGlzLmV4ZWNCdWxrUmVwbHkoXCJSUE9QXCIsIGtleSk7XG4gIH1cblxuICBycG9wbHB1c2goc291cmNlOiBzdHJpbmcsIGRlc3RpbmF0aW9uOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjQnVsa1JlcGx5KFwiUlBPUExQVVNIXCIsIHNvdXJjZSwgZGVzdGluYXRpb24pO1xuICB9XG5cbiAgcnB1c2goa2V5OiBzdHJpbmcsIC4uLmVsZW1lbnRzOiBSZWRpc1ZhbHVlW10pIHtcbiAgICByZXR1cm4gdGhpcy5leGVjSW50ZWdlclJlcGx5KFwiUlBVU0hcIiwga2V5LCAuLi5lbGVtZW50cyk7XG4gIH1cblxuICBycHVzaHgoa2V5OiBzdHJpbmcsIC4uLmVsZW1lbnRzOiBSZWRpc1ZhbHVlW10pIHtcbiAgICByZXR1cm4gdGhpcy5leGVjSW50ZWdlclJlcGx5KFwiUlBVU0hYXCIsIGtleSwgLi4uZWxlbWVudHMpO1xuICB9XG5cbiAgc2FkZChrZXk6IHN0cmluZywgLi4ubWVtYmVyczogc3RyaW5nW10pIHtcbiAgICByZXR1cm4gdGhpcy5leGVjSW50ZWdlclJlcGx5KFwiU0FERFwiLCBrZXksIC4uLm1lbWJlcnMpO1xuICB9XG5cbiAgc2F2ZSgpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjU3RhdHVzUmVwbHkoXCJTQVZFXCIpO1xuICB9XG5cbiAgc2NhcmQoa2V5OiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjSW50ZWdlclJlcGx5KFwiU0NBUkRcIiwga2V5KTtcbiAgfVxuXG4gIHNjcmlwdERlYnVnKG1vZGU6IFNjcmlwdERlYnVnTW9kZSkge1xuICAgIHJldHVybiB0aGlzLmV4ZWNTdGF0dXNSZXBseShcIlNDUklQVFwiLCBcIkRFQlVHXCIsIG1vZGUpO1xuICB9XG5cbiAgc2NyaXB0RXhpc3RzKC4uLnNoYTFzOiBzdHJpbmdbXSkge1xuICAgIHJldHVybiB0aGlzLmV4ZWNBcnJheVJlcGx5PEludGVnZXI+KFwiU0NSSVBUXCIsIFwiRVhJU1RTXCIsIC4uLnNoYTFzKTtcbiAgfVxuXG4gIHNjcmlwdEZsdXNoKCkge1xuICAgIHJldHVybiB0aGlzLmV4ZWNTdGF0dXNSZXBseShcIlNDUklQVFwiLCBcIkZMVVNIXCIpO1xuICB9XG5cbiAgc2NyaXB0S2lsbCgpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjU3RhdHVzUmVwbHkoXCJTQ1JJUFRcIiwgXCJLSUxMXCIpO1xuICB9XG5cbiAgc2NyaXB0TG9hZChzY3JpcHQ6IHN0cmluZykge1xuICAgIHJldHVybiB0aGlzLmV4ZWNTdGF0dXNSZXBseShcIlNDUklQVFwiLCBcIkxPQURcIiwgc2NyaXB0KTtcbiAgfVxuXG4gIHNkaWZmKC4uLmtleXM6IHN0cmluZ1tdKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY0FycmF5UmVwbHk8QnVsa1N0cmluZz4oXCJTRElGRlwiLCAuLi5rZXlzKTtcbiAgfVxuXG4gIHNkaWZmc3RvcmUoZGVzdGluYXRpb246IHN0cmluZywgLi4ua2V5czogc3RyaW5nW10pIHtcbiAgICByZXR1cm4gdGhpcy5leGVjSW50ZWdlclJlcGx5KFwiU0RJRkZTVE9SRVwiLCBkZXN0aW5hdGlvbiwgLi4ua2V5cyk7XG4gIH1cblxuICBzZWxlY3QoaW5kZXg6IG51bWJlcikge1xuICAgIHJldHVybiB0aGlzLmV4ZWNTdGF0dXNSZXBseShcIlNFTEVDVFwiLCBpbmRleCk7XG4gIH1cblxuICBzZXQoXG4gICAga2V5OiBzdHJpbmcsXG4gICAgdmFsdWU6IFJlZGlzVmFsdWUsXG4gICAgb3B0cz86IFNldE9wdHMsXG4gICk6IFByb21pc2U8U2ltcGxlU3RyaW5nPjtcbiAgc2V0KFxuICAgIGtleTogc3RyaW5nLFxuICAgIHZhbHVlOiBSZWRpc1ZhbHVlLFxuICAgIG9wdHM/OiBTZXRXaXRoTW9kZU9wdHMsXG4gICk6IFByb21pc2U8U2ltcGxlU3RyaW5nIHwgQnVsa05pbD47XG4gIHNldChcbiAgICBrZXk6IHN0cmluZyxcbiAgICB2YWx1ZTogUmVkaXNWYWx1ZSxcbiAgICBvcHRzPzogU2V0T3B0cyB8IFNldFdpdGhNb2RlT3B0cyxcbiAgKSB7XG4gICAgY29uc3QgYXJnczogUmVkaXNWYWx1ZVtdID0gW2tleSwgdmFsdWVdO1xuICAgIGlmIChvcHRzPy5leCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBhcmdzLnB1c2goXCJFWFwiLCBvcHRzLmV4KTtcbiAgICB9IGVsc2UgaWYgKG9wdHM/LnB4ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGFyZ3MucHVzaChcIlBYXCIsIG9wdHMucHgpO1xuICAgIH1cbiAgICBpZiAob3B0cz8ua2VlcHR0bCkge1xuICAgICAgYXJncy5wdXNoKFwiS0VFUFRUTFwiKTtcbiAgICB9XG4gICAgaWYgKChvcHRzIGFzIFNldFdpdGhNb2RlT3B0cyk/Lm1vZGUpIHtcbiAgICAgIGFyZ3MucHVzaCgob3B0cyBhcyBTZXRXaXRoTW9kZU9wdHMpLm1vZGUpO1xuICAgICAgcmV0dXJuIHRoaXMuZXhlY1N0YXR1c09yTmlsUmVwbHkoXCJTRVRcIiwgLi4uYXJncyk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmV4ZWNTdGF0dXNSZXBseShcIlNFVFwiLCAuLi5hcmdzKTtcbiAgfVxuXG4gIHNldGJpdChrZXk6IHN0cmluZywgb2Zmc2V0OiBudW1iZXIsIHZhbHVlOiBSZWRpc1ZhbHVlKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY0ludGVnZXJSZXBseShcIlNFVEJJVFwiLCBrZXksIG9mZnNldCwgdmFsdWUpO1xuICB9XG5cbiAgc2V0ZXgoa2V5OiBzdHJpbmcsIHNlY29uZHM6IG51bWJlciwgdmFsdWU6IFJlZGlzVmFsdWUpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjU3RhdHVzUmVwbHkoXCJTRVRFWFwiLCBrZXksIHNlY29uZHMsIHZhbHVlKTtcbiAgfVxuXG4gIHNldG54KGtleTogc3RyaW5nLCB2YWx1ZTogUmVkaXNWYWx1ZSkge1xuICAgIHJldHVybiB0aGlzLmV4ZWNJbnRlZ2VyUmVwbHkoXCJTRVROWFwiLCBrZXksIHZhbHVlKTtcbiAgfVxuXG4gIHNldHJhbmdlKGtleTogc3RyaW5nLCBvZmZzZXQ6IG51bWJlciwgdmFsdWU6IFJlZGlzVmFsdWUpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjSW50ZWdlclJlcGx5KFwiU0VUUkFOR0VcIiwga2V5LCBvZmZzZXQsIHZhbHVlKTtcbiAgfVxuXG4gIHNodXRkb3duKG1vZGU/OiBTaHV0ZG93bk1vZGUpIHtcbiAgICBpZiAobW9kZSkge1xuICAgICAgcmV0dXJuIHRoaXMuZXhlY1N0YXR1c1JlcGx5KFwiU0hVVERPV05cIiwgbW9kZSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmV4ZWNTdGF0dXNSZXBseShcIlNIVVRET1dOXCIpO1xuICB9XG5cbiAgc2ludGVyKC4uLmtleXM6IHN0cmluZ1tdKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY0FycmF5UmVwbHk8QnVsa1N0cmluZz4oXCJTSU5URVJcIiwgLi4ua2V5cyk7XG4gIH1cblxuICBzaW50ZXJzdG9yZShkZXN0aW5hdGlvbjogc3RyaW5nLCAuLi5rZXlzOiBzdHJpbmdbXSkge1xuICAgIHJldHVybiB0aGlzLmV4ZWNJbnRlZ2VyUmVwbHkoXCJTSU5URVJTVE9SRVwiLCBkZXN0aW5hdGlvbiwgLi4ua2V5cyk7XG4gIH1cblxuICBzaXNtZW1iZXIoa2V5OiBzdHJpbmcsIG1lbWJlcjogc3RyaW5nKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY0ludGVnZXJSZXBseShcIlNJU01FTUJFUlwiLCBrZXksIG1lbWJlcik7XG4gIH1cblxuICBzbGF2ZW9mKGhvc3Q6IHN0cmluZywgcG9ydDogbnVtYmVyKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY1N0YXR1c1JlcGx5KFwiU0xBVkVPRlwiLCBob3N0LCBwb3J0KTtcbiAgfVxuXG4gIHNsYXZlb2ZOb09uZSgpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjU3RhdHVzUmVwbHkoXCJTTEFWRU9GXCIsIFwiTk8gT05FXCIpO1xuICB9XG5cbiAgcmVwbGljYW9mKGhvc3Q6IHN0cmluZywgcG9ydDogbnVtYmVyKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY1N0YXR1c1JlcGx5KFwiUkVQTElDQU9GXCIsIGhvc3QsIHBvcnQpO1xuICB9XG5cbiAgcmVwbGljYW9mTm9PbmUoKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY1N0YXR1c1JlcGx5KFwiUkVQTElDQU9GXCIsIFwiTk8gT05FXCIpO1xuICB9XG5cbiAgc2xvd2xvZyhzdWJjb21tYW5kOiBzdHJpbmcsIC4uLmFyZ3M6IHN0cmluZ1tdKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY0FycmF5UmVwbHkoXCJTTE9XTE9HXCIsIHN1YmNvbW1hbmQsIC4uLmFyZ3MpO1xuICB9XG5cbiAgc21lbWJlcnMoa2V5OiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjQXJyYXlSZXBseTxCdWxrU3RyaW5nPihcIlNNRU1CRVJTXCIsIGtleSk7XG4gIH1cblxuICBzbW92ZShzb3VyY2U6IHN0cmluZywgZGVzdGluYXRpb246IHN0cmluZywgbWVtYmVyOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjSW50ZWdlclJlcGx5KFwiU01PVkVcIiwgc291cmNlLCBkZXN0aW5hdGlvbiwgbWVtYmVyKTtcbiAgfVxuXG4gIHNvcnQoXG4gICAga2V5OiBzdHJpbmcsXG4gICAgb3B0cz86IFNvcnRPcHRzLFxuICApOiBQcm9taXNlPEJ1bGtTdHJpbmdbXT47XG4gIHNvcnQoXG4gICAga2V5OiBzdHJpbmcsXG4gICAgb3B0cz86IFNvcnRXaXRoRGVzdGluYXRpb25PcHRzLFxuICApOiBQcm9taXNlPEludGVnZXI+O1xuICBzb3J0KFxuICAgIGtleTogc3RyaW5nLFxuICAgIG9wdHM/OiBTb3J0T3B0cyB8IFNvcnRXaXRoRGVzdGluYXRpb25PcHRzLFxuICApIHtcbiAgICBjb25zdCBhcmdzOiAobnVtYmVyIHwgc3RyaW5nKVtdID0gW2tleV07XG4gICAgaWYgKG9wdHM/LmJ5ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGFyZ3MucHVzaChcIkJZXCIsIG9wdHMuYnkpO1xuICAgIH1cbiAgICBpZiAob3B0cz8ubGltaXQpIHtcbiAgICAgIGFyZ3MucHVzaChcIkxJTUlUXCIsIG9wdHMubGltaXQub2Zmc2V0LCBvcHRzLmxpbWl0LmNvdW50KTtcbiAgICB9XG4gICAgaWYgKG9wdHM/LnBhdHRlcm5zKSB7XG4gICAgICBhcmdzLnB1c2goXCJHRVRcIiwgLi4ub3B0cy5wYXR0ZXJucyk7XG4gICAgfVxuICAgIGlmIChvcHRzPy5vcmRlcikge1xuICAgICAgYXJncy5wdXNoKG9wdHMub3JkZXIpO1xuICAgIH1cbiAgICBpZiAob3B0cz8uYWxwaGEpIHtcbiAgICAgIGFyZ3MucHVzaChcIkFMUEhBXCIpO1xuICAgIH1cbiAgICBpZiAoKG9wdHMgYXMgU29ydFdpdGhEZXN0aW5hdGlvbk9wdHMpPy5kZXN0aW5hdGlvbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBhcmdzLnB1c2goXCJTVE9SRVwiLCAob3B0cyBhcyBTb3J0V2l0aERlc3RpbmF0aW9uT3B0cykuZGVzdGluYXRpb24pO1xuICAgICAgcmV0dXJuIHRoaXMuZXhlY0ludGVnZXJSZXBseShcIlNPUlRcIiwgLi4uYXJncyk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmV4ZWNBcnJheVJlcGx5PEJ1bGtTdHJpbmc+KFwiU09SVFwiLCAuLi5hcmdzKTtcbiAgfVxuXG4gIHNwb3Aoa2V5OiBzdHJpbmcpOiBQcm9taXNlPEJ1bGs+O1xuICBzcG9wKGtleTogc3RyaW5nLCBjb3VudDogbnVtYmVyKTogUHJvbWlzZTxCdWxrU3RyaW5nW10+O1xuICBzcG9wKGtleTogc3RyaW5nLCBjb3VudD86IG51bWJlcikge1xuICAgIGlmIChjb3VudCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gdGhpcy5leGVjQXJyYXlSZXBseTxCdWxrU3RyaW5nPihcIlNQT1BcIiwga2V5LCBjb3VudCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmV4ZWNCdWxrUmVwbHkoXCJTUE9QXCIsIGtleSk7XG4gIH1cblxuICBzcmFuZG1lbWJlcihrZXk6IHN0cmluZyk6IFByb21pc2U8QnVsaz47XG4gIHNyYW5kbWVtYmVyKGtleTogc3RyaW5nLCBjb3VudDogbnVtYmVyKTogUHJvbWlzZTxCdWxrU3RyaW5nW10+O1xuICBzcmFuZG1lbWJlcihrZXk6IHN0cmluZywgY291bnQ/OiBudW1iZXIpIHtcbiAgICBpZiAoY291bnQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHRoaXMuZXhlY0FycmF5UmVwbHk8QnVsa1N0cmluZz4oXCJTUkFORE1FTUJFUlwiLCBrZXksIGNvdW50KTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuZXhlY0J1bGtSZXBseShcIlNSQU5ETUVNQkVSXCIsIGtleSk7XG4gIH1cblxuICBzcmVtKGtleTogc3RyaW5nLCAuLi5tZW1iZXJzOiBzdHJpbmdbXSkge1xuICAgIHJldHVybiB0aGlzLmV4ZWNJbnRlZ2VyUmVwbHkoXCJTUkVNXCIsIGtleSwgLi4ubWVtYmVycyk7XG4gIH1cblxuICBzdHJhbGdvKFxuICAgIGFsZ29yaXRobTogU3RyYWxnb0FsZ29yaXRobSxcbiAgICB0YXJnZXQ6IFN0cmFsZ29UYXJnZXQsXG4gICAgYTogc3RyaW5nLFxuICAgIGI6IHN0cmluZyxcbiAgICBvcHRzPzogU3RyYWxnb09wdHMsXG4gICkge1xuICAgIGNvbnN0IGFyZ3M6IChudW1iZXIgfCBzdHJpbmcpW10gPSBbXTtcbiAgICBpZiAob3B0cz8uaWR4KSB7XG4gICAgICBhcmdzLnB1c2goXCJJRFhcIik7XG4gICAgfVxuICAgIGlmIChvcHRzPy5sZW4pIHtcbiAgICAgIGFyZ3MucHVzaChcIkxFTlwiKTtcbiAgICB9XG4gICAgaWYgKG9wdHM/LndpdGhtYXRjaGxlbikge1xuICAgICAgYXJncy5wdXNoKFwiV0lUSE1BVENITEVOXCIpO1xuICAgIH1cbiAgICBpZiAob3B0cz8ubWlubWF0Y2hsZW4pIHtcbiAgICAgIGFyZ3MucHVzaChcIk1JTk1BVENITEVOXCIpO1xuICAgICAgYXJncy5wdXNoKG9wdHMubWlubWF0Y2hsZW4pO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5leGVjQnVsa1JlcGx5KFwiU1RSQUxHT1wiLCBhbGdvcml0aG0sIHRhcmdldCwgYSwgYiwgLi4uYXJncyk7XG4gIH1cblxuICBzdHJsZW4oa2V5OiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjSW50ZWdlclJlcGx5KFwiU1RSTEVOXCIsIGtleSk7XG4gIH1cblxuICBzdW5pb24oLi4ua2V5czogc3RyaW5nW10pIHtcbiAgICByZXR1cm4gdGhpcy5leGVjQXJyYXlSZXBseTxCdWxrU3RyaW5nPihcIlNVTklPTlwiLCAuLi5rZXlzKTtcbiAgfVxuXG4gIHN1bmlvbnN0b3JlKGRlc3RpbmF0aW9uOiBzdHJpbmcsIC4uLmtleXM6IHN0cmluZ1tdKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY0ludGVnZXJSZXBseShcIlNVTklPTlNUT1JFXCIsIGRlc3RpbmF0aW9uLCAuLi5rZXlzKTtcbiAgfVxuXG4gIHN3YXBkYihpbmRleDE6IG51bWJlciwgaW5kZXgyOiBudW1iZXIpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjU3RhdHVzUmVwbHkoXCJTV0FQREJcIiwgaW5kZXgxLCBpbmRleDIpO1xuICB9XG5cbiAgc3luYygpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJub3QgaW1wbGVtZW50ZWRcIik7XG4gIH1cblxuICB0aW1lKCkge1xuICAgIHJldHVybiB0aGlzLmV4ZWNBcnJheVJlcGx5KFwiVElNRVwiKSBhcyBQcm9taXNlPFtCdWxrU3RyaW5nLCBCdWxrU3RyaW5nXT47XG4gIH1cblxuICB0b3VjaCguLi5rZXlzOiBzdHJpbmdbXSkge1xuICAgIHJldHVybiB0aGlzLmV4ZWNJbnRlZ2VyUmVwbHkoXCJUT1VDSFwiLCAuLi5rZXlzKTtcbiAgfVxuXG4gIHR0bChrZXk6IHN0cmluZykge1xuICAgIHJldHVybiB0aGlzLmV4ZWNJbnRlZ2VyUmVwbHkoXCJUVExcIiwga2V5KTtcbiAgfVxuXG4gIHR5cGUoa2V5OiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjU3RhdHVzUmVwbHkoXCJUWVBFXCIsIGtleSk7XG4gIH1cblxuICB1bmxpbmsoLi4ua2V5czogc3RyaW5nW10pIHtcbiAgICByZXR1cm4gdGhpcy5leGVjSW50ZWdlclJlcGx5KFwiVU5MSU5LXCIsIC4uLmtleXMpO1xuICB9XG5cbiAgdW53YXRjaCgpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjU3RhdHVzUmVwbHkoXCJVTldBVENIXCIpO1xuICB9XG5cbiAgd2FpdChudW1yZXBsaWNhczogbnVtYmVyLCB0aW1lb3V0OiBudW1iZXIpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjSW50ZWdlclJlcGx5KFwiV0FJVFwiLCBudW1yZXBsaWNhcywgdGltZW91dCk7XG4gIH1cblxuICB3YXRjaCguLi5rZXlzOiBzdHJpbmdbXSkge1xuICAgIHJldHVybiB0aGlzLmV4ZWNTdGF0dXNSZXBseShcIldBVENIXCIsIC4uLmtleXMpO1xuICB9XG5cbiAgeGFjayhrZXk6IHN0cmluZywgZ3JvdXA6IHN0cmluZywgLi4ueGlkczogWElkSW5wdXRbXSkge1xuICAgIHJldHVybiB0aGlzLmV4ZWNJbnRlZ2VyUmVwbHkoXG4gICAgICBcIlhBQ0tcIixcbiAgICAgIGtleSxcbiAgICAgIGdyb3VwLFxuICAgICAgLi4ueGlkcy5tYXAoKHhpZCkgPT4geGlkc3RyKHhpZCkpLFxuICAgICk7XG4gIH1cblxuICB4YWRkKFxuICAgIGtleTogc3RyaW5nLFxuICAgIHhpZDogWElkQWRkLFxuICAgIGZpZWxkVmFsdWVzOiBYQWRkRmllbGRWYWx1ZXMsXG4gICAgbWF4bGVuOiBYTWF4bGVuIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkLFxuICApIHtcbiAgICBjb25zdCBhcmdzOiBSZWRpc1ZhbHVlW10gPSBba2V5XTtcblxuICAgIGlmIChtYXhsZW4pIHtcbiAgICAgIGFyZ3MucHVzaChcIk1BWExFTlwiKTtcbiAgICAgIGlmIChtYXhsZW4uYXBwcm94KSB7XG4gICAgICAgIGFyZ3MucHVzaChcIn5cIik7XG4gICAgICB9XG4gICAgICBhcmdzLnB1c2gobWF4bGVuLmVsZW1lbnRzLnRvU3RyaW5nKCkpO1xuICAgIH1cblxuICAgIGFyZ3MucHVzaCh4aWRzdHIoeGlkKSk7XG5cbiAgICBpZiAoZmllbGRWYWx1ZXMgaW5zdGFuY2VvZiBNYXApIHtcbiAgICAgIGZvciAoY29uc3QgW2YsIHZdIG9mIGZpZWxkVmFsdWVzKSB7XG4gICAgICAgIGFyZ3MucHVzaChmKTtcbiAgICAgICAgYXJncy5wdXNoKHYpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBmb3IgKGNvbnN0IFtmLCB2XSBvZiBPYmplY3QuZW50cmllcyhmaWVsZFZhbHVlcykpIHtcbiAgICAgICAgYXJncy5wdXNoKGYpO1xuICAgICAgICBhcmdzLnB1c2godik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuZXhlY0J1bGtSZXBseTxCdWxrU3RyaW5nPihcbiAgICAgIFwiWEFERFwiLFxuICAgICAgLi4uYXJncyxcbiAgICApLnRoZW4oKHJhd0lkKSA9PiBwYXJzZVhJZChyYXdJZCkpO1xuICB9XG5cbiAgeGNsYWltKGtleTogc3RyaW5nLCBvcHRzOiBYQ2xhaW1PcHRzLCAuLi54aWRzOiBYSWRJbnB1dFtdKSB7XG4gICAgY29uc3QgYXJncyA9IFtdO1xuICAgIGlmIChvcHRzLmlkbGUpIHtcbiAgICAgIGFyZ3MucHVzaChcIklETEVcIik7XG4gICAgICBhcmdzLnB1c2gob3B0cy5pZGxlKTtcbiAgICB9XG5cbiAgICBpZiAob3B0cy50aW1lKSB7XG4gICAgICBhcmdzLnB1c2goXCJUSU1FXCIpO1xuICAgICAgYXJncy5wdXNoKG9wdHMudGltZSk7XG4gICAgfVxuXG4gICAgaWYgKG9wdHMucmV0cnlDb3VudCkge1xuICAgICAgYXJncy5wdXNoKFwiUkVUUllDT1VOVFwiKTtcbiAgICAgIGFyZ3MucHVzaChvcHRzLnJldHJ5Q291bnQpO1xuICAgIH1cblxuICAgIGlmIChvcHRzLmZvcmNlKSB7XG4gICAgICBhcmdzLnB1c2goXCJGT1JDRVwiKTtcbiAgICB9XG5cbiAgICBpZiAob3B0cy5qdXN0WElkKSB7XG4gICAgICBhcmdzLnB1c2goXCJKVVNUSURcIik7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuZXhlY0FycmF5UmVwbHk8WFJlYWRJZERhdGEgfCBCdWxrU3RyaW5nPihcbiAgICAgIFwiWENMQUlNXCIsXG4gICAgICBrZXksXG4gICAgICBvcHRzLmdyb3VwLFxuICAgICAgb3B0cy5jb25zdW1lcixcbiAgICAgIG9wdHMubWluSWRsZVRpbWUsXG4gICAgICAuLi54aWRzLm1hcCgoeGlkKSA9PiB4aWRzdHIoeGlkKSksXG4gICAgICAuLi5hcmdzLFxuICAgICkudGhlbigocmF3KSA9PiB7XG4gICAgICBpZiAob3B0cy5qdXN0WElkKSB7XG4gICAgICAgIGNvbnN0IHhpZHMgPSBbXTtcbiAgICAgICAgZm9yIChjb25zdCByIG9mIHJhdykge1xuICAgICAgICAgIGlmICh0eXBlb2YgciA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICAgICAgeGlkcy5wdXNoKHBhcnNlWElkKHIpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcGF5bG9hZDogWENsYWltSnVzdFhJZCA9IHsga2luZDogXCJqdXN0eGlkXCIsIHhpZHMgfTtcbiAgICAgICAgcmV0dXJuIHBheWxvYWQ7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IG1lc3NhZ2VzID0gW107XG4gICAgICBmb3IgKGNvbnN0IHIgb2YgcmF3KSB7XG4gICAgICAgIGlmICh0eXBlb2YgciAhPT0gXCJzdHJpbmdcIikge1xuICAgICAgICAgIG1lc3NhZ2VzLnB1c2gocGFyc2VYTWVzc2FnZShyKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGNvbnN0IHBheWxvYWQ6IFhDbGFpbU1lc3NhZ2VzID0geyBraW5kOiBcIm1lc3NhZ2VzXCIsIG1lc3NhZ2VzIH07XG4gICAgICByZXR1cm4gcGF5bG9hZDtcbiAgICB9KTtcbiAgfVxuXG4gIHhkZWwoa2V5OiBzdHJpbmcsIC4uLnhpZHM6IFhJZElucHV0W10pIHtcbiAgICByZXR1cm4gdGhpcy5leGVjSW50ZWdlclJlcGx5KFxuICAgICAgXCJYREVMXCIsXG4gICAgICBrZXksXG4gICAgICAuLi54aWRzLm1hcCgocmF3SWQpID0+IHhpZHN0cihyYXdJZCkpLFxuICAgICk7XG4gIH1cblxuICB4bGVuKGtleTogc3RyaW5nKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY0ludGVnZXJSZXBseShcIlhMRU5cIiwga2V5KTtcbiAgfVxuXG4gIHhncm91cENyZWF0ZShcbiAgICBrZXk6IHN0cmluZyxcbiAgICBncm91cE5hbWU6IHN0cmluZyxcbiAgICB4aWQ6IFhJZElucHV0IHwgXCIkXCIsXG4gICAgbWtzdHJlYW0/OiBib29sZWFuLFxuICApIHtcbiAgICBjb25zdCBhcmdzID0gW107XG4gICAgaWYgKG1rc3RyZWFtKSB7XG4gICAgICBhcmdzLnB1c2goXCJNS1NUUkVBTVwiKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5leGVjU3RhdHVzUmVwbHkoXG4gICAgICBcIlhHUk9VUFwiLFxuICAgICAgXCJDUkVBVEVcIixcbiAgICAgIGtleSxcbiAgICAgIGdyb3VwTmFtZSxcbiAgICAgIHhpZHN0cih4aWQpLFxuICAgICAgLi4uYXJncyxcbiAgICApO1xuICB9XG5cbiAgeGdyb3VwRGVsQ29uc3VtZXIoXG4gICAga2V5OiBzdHJpbmcsXG4gICAgZ3JvdXBOYW1lOiBzdHJpbmcsXG4gICAgY29uc3VtZXJOYW1lOiBzdHJpbmcsXG4gICkge1xuICAgIHJldHVybiB0aGlzLmV4ZWNJbnRlZ2VyUmVwbHkoXG4gICAgICBcIlhHUk9VUFwiLFxuICAgICAgXCJERUxDT05TVU1FUlwiLFxuICAgICAga2V5LFxuICAgICAgZ3JvdXBOYW1lLFxuICAgICAgY29uc3VtZXJOYW1lLFxuICAgICk7XG4gIH1cblxuICB4Z3JvdXBEZXN0cm95KGtleTogc3RyaW5nLCBncm91cE5hbWU6IHN0cmluZykge1xuICAgIHJldHVybiB0aGlzLmV4ZWNJbnRlZ2VyUmVwbHkoXCJYR1JPVVBcIiwgXCJERVNUUk9ZXCIsIGtleSwgZ3JvdXBOYW1lKTtcbiAgfVxuXG4gIHhncm91cEhlbHAoKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY0J1bGtSZXBseTxCdWxrU3RyaW5nPihcIlhHUk9VUFwiLCBcIkhFTFBcIik7XG4gIH1cblxuICB4Z3JvdXBTZXRJRChcbiAgICBrZXk6IHN0cmluZyxcbiAgICBncm91cE5hbWU6IHN0cmluZyxcbiAgICB4aWQ6IFhJZCxcbiAgKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY1N0YXR1c1JlcGx5KFxuICAgICAgXCJYR1JPVVBcIixcbiAgICAgIFwiU0VUSURcIixcbiAgICAgIGtleSxcbiAgICAgIGdyb3VwTmFtZSxcbiAgICAgIHhpZHN0cih4aWQpLFxuICAgICk7XG4gIH1cblxuICB4aW5mb1N0cmVhbShrZXk6IHN0cmluZykge1xuICAgIHJldHVybiB0aGlzLmV4ZWNBcnJheVJlcGx5PFJhdz4oXCJYSU5GT1wiLCBcIlNUUkVBTVwiLCBrZXkpLnRoZW4oXG4gICAgICAocmF3KSA9PiB7XG4gICAgICAgIC8vIE5vdGUgdGhhdCB5b3Ugc2hvdWxkIG5vdCByZWx5IG9uIHRoZSBmaWVsZHNcbiAgICAgICAgLy8gZXhhY3QgcG9zaXRpb24sIG5vciBvbiB0aGUgbnVtYmVyIG9mIGZpZWxkcyxcbiAgICAgICAgLy8gbmV3IGZpZWxkcyBtYXkgYmUgYWRkZWQgaW4gdGhlIGZ1dHVyZS5cbiAgICAgICAgY29uc3QgZGF0YTogTWFwPHN0cmluZywgUmF3PiA9IGNvbnZlcnRNYXAocmF3KTtcblxuICAgICAgICBjb25zdCBmaXJzdEVudHJ5ID0gcGFyc2VYTWVzc2FnZShcbiAgICAgICAgICBkYXRhLmdldChcImZpcnN0LWVudHJ5XCIpIGFzIFhSZWFkSWREYXRhLFxuICAgICAgICApO1xuICAgICAgICBjb25zdCBsYXN0RW50cnkgPSBwYXJzZVhNZXNzYWdlKFxuICAgICAgICAgIGRhdGEuZ2V0KFwibGFzdC1lbnRyeVwiKSBhcyBYUmVhZElkRGF0YSxcbiAgICAgICAgKTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGxlbmd0aDogcmF3bnVtKGRhdGEuZ2V0KFwibGVuZ3RoXCIpID8/IG51bGwpLFxuICAgICAgICAgIHJhZGl4VHJlZUtleXM6IHJhd251bShkYXRhLmdldChcInJhZGl4LXRyZWUta2V5c1wiKSA/PyBudWxsKSxcbiAgICAgICAgICByYWRpeFRyZWVOb2RlczogcmF3bnVtKGRhdGEuZ2V0KFwicmFkaXgtdHJlZS1ub2Rlc1wiKSA/PyBudWxsKSxcbiAgICAgICAgICBncm91cHM6IHJhd251bShkYXRhLmdldChcImdyb3Vwc1wiKSA/PyBudWxsKSxcbiAgICAgICAgICBsYXN0R2VuZXJhdGVkSWQ6IHBhcnNlWElkKFxuICAgICAgICAgICAgcmF3c3RyKGRhdGEuZ2V0KFwibGFzdC1nZW5lcmF0ZWQtaWRcIikgPz8gbnVsbCksXG4gICAgICAgICAgKSxcbiAgICAgICAgICBmaXJzdEVudHJ5LFxuICAgICAgICAgIGxhc3RFbnRyeSxcbiAgICAgICAgfTtcbiAgICAgIH0sXG4gICAgKTtcbiAgfVxuXG4gIHhpbmZvU3RyZWFtRnVsbChrZXk6IHN0cmluZywgY291bnQ/OiBudW1iZXIpIHtcbiAgICBjb25zdCBhcmdzID0gW107XG4gICAgaWYgKGNvdW50KSB7XG4gICAgICBhcmdzLnB1c2goXCJDT1VOVFwiKTtcbiAgICAgIGFyZ3MucHVzaChjb3VudCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmV4ZWNBcnJheVJlcGx5PFJhdz4oXCJYSU5GT1wiLCBcIlNUUkVBTVwiLCBrZXksIFwiRlVMTFwiLCAuLi5hcmdzKVxuICAgICAgLnRoZW4oXG4gICAgICAgIChyYXcpID0+IHtcbiAgICAgICAgICAvLyBOb3RlIHRoYXQgeW91IHNob3VsZCBub3QgcmVseSBvbiB0aGUgZmllbGRzXG4gICAgICAgICAgLy8gZXhhY3QgcG9zaXRpb24sIG5vciBvbiB0aGUgbnVtYmVyIG9mIGZpZWxkcyxcbiAgICAgICAgICAvLyBuZXcgZmllbGRzIG1heSBiZSBhZGRlZCBpbiB0aGUgZnV0dXJlLlxuICAgICAgICAgIGlmIChyYXcgPT0gbnVsbCkgdGhyb3cgXCJubyBkYXRhXCI7XG5cbiAgICAgICAgICBjb25zdCBkYXRhOiBNYXA8c3RyaW5nLCBSYXc+ID0gY29udmVydE1hcChyYXcpO1xuICAgICAgICAgIGlmIChkYXRhID09PSB1bmRlZmluZWQpIHRocm93IFwibm8gZGF0YSBjb252ZXJ0ZWRcIjtcblxuICAgICAgICAgIGNvbnN0IGVudHJpZXMgPSAoZGF0YS5nZXQoXCJlbnRyaWVzXCIpIGFzIENvbmRpdGlvbmFsQXJyYXkpLm1hcCgoXG4gICAgICAgICAgICByYXc6IFJhdyxcbiAgICAgICAgICApID0+IHBhcnNlWE1lc3NhZ2UocmF3IGFzIFhSZWFkSWREYXRhKSk7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGxlbmd0aDogcmF3bnVtKGRhdGEuZ2V0KFwibGVuZ3RoXCIpID8/IG51bGwpLFxuICAgICAgICAgICAgcmFkaXhUcmVlS2V5czogcmF3bnVtKGRhdGEuZ2V0KFwicmFkaXgtdHJlZS1rZXlzXCIpID8/IG51bGwpLFxuICAgICAgICAgICAgcmFkaXhUcmVlTm9kZXM6IHJhd251bShkYXRhLmdldChcInJhZGl4LXRyZWUtbm9kZXNcIikgPz8gbnVsbCksXG4gICAgICAgICAgICBsYXN0R2VuZXJhdGVkSWQ6IHBhcnNlWElkKFxuICAgICAgICAgICAgICByYXdzdHIoZGF0YS5nZXQoXCJsYXN0LWdlbmVyYXRlZC1pZFwiKSA/PyBudWxsKSxcbiAgICAgICAgICAgICksXG4gICAgICAgICAgICBlbnRyaWVzLFxuICAgICAgICAgICAgZ3JvdXBzOiBwYXJzZVhHcm91cERldGFpbChkYXRhLmdldChcImdyb3Vwc1wiKSBhcyBDb25kaXRpb25hbEFycmF5KSxcbiAgICAgICAgICB9O1xuICAgICAgICB9LFxuICAgICAgKTtcbiAgfVxuXG4gIHhpbmZvR3JvdXBzKGtleTogc3RyaW5nKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY0FycmF5UmVwbHk8Q29uZGl0aW9uYWxBcnJheT4oXCJYSU5GT1wiLCBcIkdST1VQU1wiLCBrZXkpLnRoZW4oXG4gICAgICAocmF3cykgPT5cbiAgICAgICAgcmF3cy5tYXAoKHJhdykgPT4ge1xuICAgICAgICAgIGNvbnN0IGRhdGEgPSBjb252ZXJ0TWFwKHJhdyk7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIG5hbWU6IHJhd3N0cihkYXRhLmdldChcIm5hbWVcIikgPz8gbnVsbCksXG4gICAgICAgICAgICBjb25zdW1lcnM6IHJhd251bShkYXRhLmdldChcImNvbnN1bWVyc1wiKSA/PyBudWxsKSxcbiAgICAgICAgICAgIHBlbmRpbmc6IHJhd251bShkYXRhLmdldChcInBlbmRpbmdcIikgPz8gbnVsbCksXG4gICAgICAgICAgICBsYXN0RGVsaXZlcmVkSWQ6IHBhcnNlWElkKFxuICAgICAgICAgICAgICByYXdzdHIoZGF0YS5nZXQoXCJsYXN0LWRlbGl2ZXJlZC1pZFwiKSA/PyBudWxsKSxcbiAgICAgICAgICAgICksXG4gICAgICAgICAgfTtcbiAgICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIHhpbmZvQ29uc3VtZXJzKGtleTogc3RyaW5nLCBncm91cDogc3RyaW5nKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY0FycmF5UmVwbHk8Q29uZGl0aW9uYWxBcnJheT4oXG4gICAgICBcIlhJTkZPXCIsXG4gICAgICBcIkNPTlNVTUVSU1wiLFxuICAgICAga2V5LFxuICAgICAgZ3JvdXAsXG4gICAgKS50aGVuKFxuICAgICAgKHJhd3MpID0+XG4gICAgICAgIHJhd3MubWFwKChyYXcpID0+IHtcbiAgICAgICAgICBjb25zdCBkYXRhID0gY29udmVydE1hcChyYXcpO1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBuYW1lOiByYXdzdHIoZGF0YS5nZXQoXCJuYW1lXCIpID8/IG51bGwpLFxuICAgICAgICAgICAgcGVuZGluZzogcmF3bnVtKGRhdGEuZ2V0KFwicGVuZGluZ1wiKSA/PyBudWxsKSxcbiAgICAgICAgICAgIGlkbGU6IHJhd251bShkYXRhLmdldChcImlkbGVcIikgPz8gbnVsbCksXG4gICAgICAgICAgfTtcbiAgICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIHhwZW5kaW5nKFxuICAgIGtleTogc3RyaW5nLFxuICAgIGdyb3VwOiBzdHJpbmcsXG4gICkge1xuICAgIHJldHVybiB0aGlzLmV4ZWNBcnJheVJlcGx5PFJhdz4oXCJYUEVORElOR1wiLCBrZXksIGdyb3VwKVxuICAgICAgLnRoZW4oKHJhdykgPT4ge1xuICAgICAgICBpZiAoXG4gICAgICAgICAgaXNOdW1iZXIocmF3WzBdKSAmJiBpc1N0cmluZyhyYXdbMV0pICYmXG4gICAgICAgICAgaXNTdHJpbmcocmF3WzJdKSAmJiBpc0NvbmRBcnJheShyYXdbM10pXG4gICAgICAgICkge1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBjb3VudDogcmF3WzBdLFxuICAgICAgICAgICAgc3RhcnRJZDogcGFyc2VYSWQocmF3WzFdKSxcbiAgICAgICAgICAgIGVuZElkOiBwYXJzZVhJZChyYXdbMl0pLFxuICAgICAgICAgICAgY29uc3VtZXJzOiBwYXJzZVhQZW5kaW5nQ29uc3VtZXJzKHJhd1szXSksXG4gICAgICAgICAgfTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBcInBhcnNlIGVyclwiO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgfVxuXG4gIHhwZW5kaW5nQ291bnQoXG4gICAga2V5OiBzdHJpbmcsXG4gICAgZ3JvdXA6IHN0cmluZyxcbiAgICBzdGFydEVuZENvdW50OiBTdGFydEVuZENvdW50LFxuICAgIGNvbnN1bWVyPzogc3RyaW5nLFxuICApIHtcbiAgICBjb25zdCBhcmdzID0gW107XG4gICAgYXJncy5wdXNoKHN0YXJ0RW5kQ291bnQuc3RhcnQpO1xuICAgIGFyZ3MucHVzaChzdGFydEVuZENvdW50LmVuZCk7XG4gICAgYXJncy5wdXNoKHN0YXJ0RW5kQ291bnQuY291bnQpO1xuXG4gICAgaWYgKGNvbnN1bWVyKSB7XG4gICAgICBhcmdzLnB1c2goY29uc3VtZXIpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmV4ZWNBcnJheVJlcGx5PFJhdz4oXCJYUEVORElOR1wiLCBrZXksIGdyb3VwLCAuLi5hcmdzKVxuICAgICAgLnRoZW4oKHJhdykgPT4gcGFyc2VYUGVuZGluZ0NvdW50cyhyYXcpKTtcbiAgfVxuXG4gIHhyYW5nZShcbiAgICBrZXk6IHN0cmluZyxcbiAgICBzdGFydDogWElkTmVnLFxuICAgIGVuZDogWElkUG9zLFxuICAgIGNvdW50PzogbnVtYmVyLFxuICApIHtcbiAgICBjb25zdCBhcmdzOiAoc3RyaW5nIHwgbnVtYmVyKVtdID0gW2tleSwgeGlkc3RyKHN0YXJ0KSwgeGlkc3RyKGVuZCldO1xuICAgIGlmIChjb3VudCkge1xuICAgICAgYXJncy5wdXNoKFwiQ09VTlRcIik7XG4gICAgICBhcmdzLnB1c2goY291bnQpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5leGVjQXJyYXlSZXBseTxYUmVhZElkRGF0YT4oXCJYUkFOR0VcIiwgLi4uYXJncykudGhlbihcbiAgICAgIChyYXcpID0+IHJhdy5tYXAoKG0pID0+IHBhcnNlWE1lc3NhZ2UobSkpLFxuICAgICk7XG4gIH1cblxuICB4cmV2cmFuZ2UoXG4gICAga2V5OiBzdHJpbmcsXG4gICAgc3RhcnQ6IFhJZFBvcyxcbiAgICBlbmQ6IFhJZE5lZyxcbiAgICBjb3VudD86IG51bWJlcixcbiAgKSB7XG4gICAgY29uc3QgYXJnczogKHN0cmluZyB8IG51bWJlcilbXSA9IFtrZXksIHhpZHN0cihzdGFydCksIHhpZHN0cihlbmQpXTtcbiAgICBpZiAoY291bnQpIHtcbiAgICAgIGFyZ3MucHVzaChcIkNPVU5UXCIpO1xuICAgICAgYXJncy5wdXNoKGNvdW50KTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuZXhlY0FycmF5UmVwbHk8WFJlYWRJZERhdGE+KFwiWFJFVlJBTkdFXCIsIC4uLmFyZ3MpLnRoZW4oXG4gICAgICAocmF3KSA9PiByYXcubWFwKChtKSA9PiBwYXJzZVhNZXNzYWdlKG0pKSxcbiAgICApO1xuICB9XG5cbiAgeHJlYWQoXG4gICAga2V5WElkczogKFhLZXlJZCB8IFhLZXlJZExpa2UpW10sXG4gICAgb3B0cz86IFhSZWFkT3B0cyxcbiAgKSB7XG4gICAgY29uc3QgYXJncyA9IFtdO1xuICAgIGlmIChvcHRzKSB7XG4gICAgICBpZiAob3B0cy5jb3VudCkge1xuICAgICAgICBhcmdzLnB1c2goXCJDT1VOVFwiKTtcbiAgICAgICAgYXJncy5wdXNoKG9wdHMuY291bnQpO1xuICAgICAgfVxuICAgICAgaWYgKG9wdHMuYmxvY2spIHtcbiAgICAgICAgYXJncy5wdXNoKFwiQkxPQ0tcIik7XG4gICAgICAgIGFyZ3MucHVzaChvcHRzLmJsb2NrKTtcbiAgICAgIH1cbiAgICB9XG4gICAgYXJncy5wdXNoKFwiU1RSRUFNU1wiKTtcblxuICAgIGNvbnN0IHRoZUtleXMgPSBbXTtcbiAgICBjb25zdCB0aGVYSWRzID0gW107XG5cbiAgICBmb3IgKGNvbnN0IGEgb2Yga2V5WElkcykge1xuICAgICAgaWYgKGEgaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICAgICAvLyBYS2V5SWRMaWtlXG4gICAgICAgIHRoZUtleXMucHVzaChhWzBdKTtcbiAgICAgICAgdGhlWElkcy5wdXNoKHhpZHN0cihhWzFdKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBYS2V5SWRcbiAgICAgICAgdGhlS2V5cy5wdXNoKGEua2V5KTtcbiAgICAgICAgdGhlWElkcy5wdXNoKHhpZHN0cihhLnhpZCkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmV4ZWNBcnJheVJlcGx5PFhSZWFkU3RyZWFtUmF3PihcbiAgICAgIFwiWFJFQURcIixcbiAgICAgIC4uLmFyZ3MuY29uY2F0KHRoZUtleXMpLmNvbmNhdCh0aGVYSWRzKSxcbiAgICApLnRoZW4oKHJhdykgPT4gcGFyc2VYUmVhZFJlcGx5KHJhdykpO1xuICB9XG5cbiAgeHJlYWRncm91cChcbiAgICBrZXlYSWRzOiAoWEtleUlkR3JvdXAgfCBYS2V5SWRHcm91cExpa2UpW10sXG4gICAgeyBncm91cCwgY29uc3VtZXIsIGNvdW50LCBibG9jayB9OiBYUmVhZEdyb3VwT3B0cyxcbiAgKSB7XG4gICAgY29uc3QgYXJnczogKHN0cmluZyB8IG51bWJlcilbXSA9IFtcbiAgICAgIFwiR1JPVVBcIixcbiAgICAgIGdyb3VwLFxuICAgICAgY29uc3VtZXIsXG4gICAgXTtcblxuICAgIGlmIChjb3VudCkge1xuICAgICAgYXJncy5wdXNoKFwiQ09VTlRcIik7XG4gICAgICBhcmdzLnB1c2goY291bnQpO1xuICAgIH1cbiAgICBpZiAoYmxvY2spIHtcbiAgICAgIGFyZ3MucHVzaChcIkJMT0NLXCIpO1xuICAgICAgYXJncy5wdXNoKGJsb2NrKTtcbiAgICB9XG5cbiAgICBhcmdzLnB1c2goXCJTVFJFQU1TXCIpO1xuXG4gICAgY29uc3QgdGhlS2V5cyA9IFtdO1xuICAgIGNvbnN0IHRoZVhJZHMgPSBbXTtcblxuICAgIGZvciAoY29uc3QgYSBvZiBrZXlYSWRzKSB7XG4gICAgICBpZiAoYSBpbnN0YW5jZW9mIEFycmF5KSB7XG4gICAgICAgIC8vIFhLZXlJZEdyb3VwTGlrZVxuICAgICAgICB0aGVLZXlzLnB1c2goYVswXSk7XG4gICAgICAgIHRoZVhJZHMucHVzaChhWzFdID09PSBcIj5cIiA/IFwiPlwiIDogeGlkc3RyKGFbMV0pKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFhLZXlJZEdyb3VwXG4gICAgICAgIHRoZUtleXMucHVzaChhLmtleSk7XG4gICAgICAgIHRoZVhJZHMucHVzaChhLnhpZCA9PT0gXCI+XCIgPyBcIj5cIiA6IHhpZHN0cihhLnhpZCkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmV4ZWNBcnJheVJlcGx5PFhSZWFkU3RyZWFtUmF3PihcbiAgICAgIFwiWFJFQURHUk9VUFwiLFxuICAgICAgLi4uYXJncy5jb25jYXQodGhlS2V5cykuY29uY2F0KHRoZVhJZHMpLFxuICAgICkudGhlbigocmF3KSA9PiBwYXJzZVhSZWFkUmVwbHkocmF3KSk7XG4gIH1cblxuICB4dHJpbShrZXk6IHN0cmluZywgbWF4bGVuOiBYTWF4bGVuKSB7XG4gICAgY29uc3QgYXJncyA9IFtdO1xuICAgIGlmIChtYXhsZW4uYXBwcm94KSB7XG4gICAgICBhcmdzLnB1c2goXCJ+XCIpO1xuICAgIH1cblxuICAgIGFyZ3MucHVzaChtYXhsZW4uZWxlbWVudHMpO1xuXG4gICAgcmV0dXJuIHRoaXMuZXhlY0ludGVnZXJSZXBseShcIlhUUklNXCIsIGtleSwgXCJNQVhMRU5cIiwgLi4uYXJncyk7XG4gIH1cblxuICB6YWRkKFxuICAgIGtleTogc3RyaW5nLFxuICAgIHNjb3JlOiBudW1iZXIsXG4gICAgbWVtYmVyOiBzdHJpbmcsXG4gICAgb3B0cz86IFpBZGRPcHRzLFxuICApOiBQcm9taXNlPEludGVnZXI+O1xuICB6YWRkKFxuICAgIGtleTogc3RyaW5nLFxuICAgIHNjb3JlTWVtYmVyczogW251bWJlciwgc3RyaW5nXVtdLFxuICAgIG9wdHM/OiBaQWRkT3B0cyxcbiAgKTogUHJvbWlzZTxJbnRlZ2VyPjtcbiAgemFkZChcbiAgICBrZXk6IHN0cmluZyxcbiAgICBtZW1iZXJTY29yZXM6IFJlY29yZDxzdHJpbmcsIG51bWJlcj4sXG4gICAgb3B0cz86IFpBZGRPcHRzLFxuICApOiBQcm9taXNlPEludGVnZXI+O1xuICB6YWRkKFxuICAgIGtleTogc3RyaW5nLFxuICAgIHBhcmFtMTogbnVtYmVyIHwgW251bWJlciwgc3RyaW5nXVtdIHwgUmVjb3JkPHN0cmluZywgbnVtYmVyPixcbiAgICBwYXJhbTI/OiBzdHJpbmcgfCBaQWRkT3B0cyxcbiAgICBvcHRzPzogWkFkZE9wdHMsXG4gICkge1xuICAgIGNvbnN0IGFyZ3M6IChzdHJpbmcgfCBudW1iZXIpW10gPSBba2V5XTtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShwYXJhbTEpKSB7XG4gICAgICB0aGlzLnB1c2haQWRkT3B0cyhhcmdzLCBwYXJhbTIgYXMgWkFkZE9wdHMpO1xuICAgICAgYXJncy5wdXNoKC4uLnBhcmFtMS5mbGF0TWFwKChlKSA9PiBlKSk7XG4gICAgICBvcHRzID0gcGFyYW0yIGFzIFpBZGRPcHRzO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHBhcmFtMSA9PT0gXCJvYmplY3RcIikge1xuICAgICAgdGhpcy5wdXNoWkFkZE9wdHMoYXJncywgcGFyYW0yIGFzIFpBZGRPcHRzKTtcbiAgICAgIGZvciAoY29uc3QgW21lbWJlciwgc2NvcmVdIG9mIE9iamVjdC5lbnRyaWVzKHBhcmFtMSkpIHtcbiAgICAgICAgYXJncy5wdXNoKHNjb3JlIGFzIG51bWJlciwgbWVtYmVyKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5wdXNoWkFkZE9wdHMoYXJncywgb3B0cyk7XG4gICAgICBhcmdzLnB1c2gocGFyYW0xLCBwYXJhbTIgYXMgc3RyaW5nKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuZXhlY0ludGVnZXJSZXBseShcIlpBRERcIiwgLi4uYXJncyk7XG4gIH1cblxuICBwcml2YXRlIHB1c2haQWRkT3B0cyhcbiAgICBhcmdzOiAoc3RyaW5nIHwgbnVtYmVyKVtdLFxuICAgIG9wdHM/OiBaQWRkT3B0cyxcbiAgKTogdm9pZCB7XG4gICAgaWYgKG9wdHM/Lm1vZGUpIHtcbiAgICAgIGFyZ3MucHVzaChvcHRzLm1vZGUpO1xuICAgIH1cbiAgICBpZiAob3B0cz8uY2gpIHtcbiAgICAgIGFyZ3MucHVzaChcIkNIXCIpO1xuICAgIH1cbiAgfVxuXG4gIHphZGRJbmNyKFxuICAgIGtleTogc3RyaW5nLFxuICAgIHNjb3JlOiBudW1iZXIsXG4gICAgbWVtYmVyOiBzdHJpbmcsXG4gICAgb3B0cz86IFpBZGRPcHRzLFxuICApIHtcbiAgICBjb25zdCBhcmdzOiAoc3RyaW5nIHwgbnVtYmVyKVtdID0gW2tleV07XG4gICAgdGhpcy5wdXNoWkFkZE9wdHMoYXJncywgb3B0cyk7XG4gICAgYXJncy5wdXNoKFwiSU5DUlwiLCBzY29yZSwgbWVtYmVyKTtcbiAgICByZXR1cm4gdGhpcy5leGVjQnVsa1JlcGx5KFwiWkFERFwiLCAuLi5hcmdzKTtcbiAgfVxuXG4gIHpjYXJkKGtleTogc3RyaW5nKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY0ludGVnZXJSZXBseShcIlpDQVJEXCIsIGtleSk7XG4gIH1cblxuICB6Y291bnQoa2V5OiBzdHJpbmcsIG1pbjogbnVtYmVyLCBtYXg6IG51bWJlcikge1xuICAgIHJldHVybiB0aGlzLmV4ZWNJbnRlZ2VyUmVwbHkoXCJaQ09VTlRcIiwga2V5LCBtaW4sIG1heCk7XG4gIH1cblxuICB6aW5jcmJ5KGtleTogc3RyaW5nLCBpbmNyZW1lbnQ6IG51bWJlciwgbWVtYmVyOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdGhpcy5leGVjQnVsa1JlcGx5PEJ1bGtTdHJpbmc+KFwiWklOQ1JCWVwiLCBrZXksIGluY3JlbWVudCwgbWVtYmVyKTtcbiAgfVxuXG4gIHppbnRlcihcbiAgICBrZXlzOiBzdHJpbmdbXSB8IFtzdHJpbmcsIG51bWJlcl1bXSB8IFJlY29yZDxzdHJpbmcsIG51bWJlcj4sXG4gICAgb3B0cz86IFpJbnRlck9wdHMsXG4gICkge1xuICAgIGNvbnN0IGFyZ3MgPSB0aGlzLnB1c2haU3RvcmVBcmdzKFtdLCBrZXlzLCBvcHRzKTtcbiAgICBpZiAob3B0cz8ud2l0aFNjb3JlKSB7XG4gICAgICBhcmdzLnB1c2goXCJXSVRIU0NPUkVTXCIpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5leGVjQXJyYXlSZXBseShcIlpJTlRFUlwiLCAuLi5hcmdzKTtcbiAgfVxuXG4gIHppbnRlcnN0b3JlKFxuICAgIGRlc3RpbmF0aW9uOiBzdHJpbmcsXG4gICAga2V5czogc3RyaW5nW10gfCBbc3RyaW5nLCBudW1iZXJdW10gfCBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+LFxuICAgIG9wdHM/OiBaSW50ZXJzdG9yZU9wdHMsXG4gICkge1xuICAgIGNvbnN0IGFyZ3MgPSB0aGlzLnB1c2haU3RvcmVBcmdzKFtkZXN0aW5hdGlvbl0sIGtleXMsIG9wdHMpO1xuICAgIHJldHVybiB0aGlzLmV4ZWNJbnRlZ2VyUmVwbHkoXCJaSU5URVJTVE9SRVwiLCAuLi5hcmdzKTtcbiAgfVxuXG4gIHp1bmlvbnN0b3JlKFxuICAgIGRlc3RpbmF0aW9uOiBzdHJpbmcsXG4gICAga2V5czogc3RyaW5nW10gfCBbc3RyaW5nLCBudW1iZXJdW10gfCBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+LFxuICAgIG9wdHM/OiBaVW5pb25zdG9yZU9wdHMsXG4gICkge1xuICAgIGNvbnN0IGFyZ3MgPSB0aGlzLnB1c2haU3RvcmVBcmdzKFtkZXN0aW5hdGlvbl0sIGtleXMsIG9wdHMpO1xuICAgIHJldHVybiB0aGlzLmV4ZWNJbnRlZ2VyUmVwbHkoXCJaVU5JT05TVE9SRVwiLCAuLi5hcmdzKTtcbiAgfVxuXG4gIHByaXZhdGUgcHVzaFpTdG9yZUFyZ3MoXG4gICAgYXJnczogKG51bWJlciB8IHN0cmluZylbXSxcbiAgICBrZXlzOiBzdHJpbmdbXSB8IFtzdHJpbmcsIG51bWJlcl1bXSB8IFJlY29yZDxzdHJpbmcsIG51bWJlcj4sXG4gICAgb3B0cz86IFpJbnRlcnN0b3JlT3B0cyB8IFpVbmlvbnN0b3JlT3B0cyxcbiAgKSB7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkoa2V5cykpIHtcbiAgICAgIGFyZ3MucHVzaChrZXlzLmxlbmd0aCk7XG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShrZXlzWzBdKSkge1xuICAgICAgICBrZXlzID0ga2V5cyBhcyBbc3RyaW5nLCBudW1iZXJdW107XG4gICAgICAgIGFyZ3MucHVzaCguLi5rZXlzLm1hcCgoZSkgPT4gZVswXSkpO1xuICAgICAgICBhcmdzLnB1c2goXCJXRUlHSFRTXCIpO1xuICAgICAgICBhcmdzLnB1c2goLi4ua2V5cy5tYXAoKGUpID0+IGVbMV0pKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGFyZ3MucHVzaCguLi4oa2V5cyBhcyBzdHJpbmdbXSkpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBhcmdzLnB1c2goT2JqZWN0LmtleXMoa2V5cykubGVuZ3RoKTtcbiAgICAgIGFyZ3MucHVzaCguLi5PYmplY3Qua2V5cyhrZXlzKSk7XG4gICAgICBhcmdzLnB1c2goXCJXRUlHSFRTXCIpO1xuICAgICAgYXJncy5wdXNoKC4uLk9iamVjdC52YWx1ZXMoa2V5cykpO1xuICAgIH1cbiAgICBpZiAob3B0cz8uYWdncmVnYXRlKSB7XG4gICAgICBhcmdzLnB1c2goXCJBR0dSRUdBVEVcIiwgb3B0cy5hZ2dyZWdhdGUpO1xuICAgIH1cbiAgICByZXR1cm4gYXJncztcbiAgfVxuXG4gIHpsZXhjb3VudChrZXk6IHN0cmluZywgbWluOiBzdHJpbmcsIG1heDogc3RyaW5nKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY0ludGVnZXJSZXBseShcIlpMRVhDT1VOVFwiLCBrZXksIG1pbiwgbWF4KTtcbiAgfVxuXG4gIHpwb3BtYXgoa2V5OiBzdHJpbmcsIGNvdW50PzogbnVtYmVyKSB7XG4gICAgaWYgKGNvdW50ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB0aGlzLmV4ZWNBcnJheVJlcGx5PEJ1bGtTdHJpbmc+KFwiWlBPUE1BWFwiLCBrZXksIGNvdW50KTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuZXhlY0FycmF5UmVwbHk8QnVsa1N0cmluZz4oXCJaUE9QTUFYXCIsIGtleSk7XG4gIH1cblxuICB6cG9wbWluKGtleTogc3RyaW5nLCBjb3VudD86IG51bWJlcikge1xuICAgIGlmIChjb3VudCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gdGhpcy5leGVjQXJyYXlSZXBseTxCdWxrU3RyaW5nPihcIlpQT1BNSU5cIiwga2V5LCBjb3VudCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmV4ZWNBcnJheVJlcGx5PEJ1bGtTdHJpbmc+KFwiWlBPUE1JTlwiLCBrZXkpO1xuICB9XG5cbiAgenJhbmdlKFxuICAgIGtleTogc3RyaW5nLFxuICAgIHN0YXJ0OiBudW1iZXIsXG4gICAgc3RvcDogbnVtYmVyLFxuICAgIG9wdHM/OiBaUmFuZ2VPcHRzLFxuICApIHtcbiAgICBjb25zdCBhcmdzID0gdGhpcy5wdXNoWlJhbmdlT3B0cyhba2V5LCBzdGFydCwgc3RvcF0sIG9wdHMpO1xuICAgIHJldHVybiB0aGlzLmV4ZWNBcnJheVJlcGx5PEJ1bGtTdHJpbmc+KFwiWlJBTkdFXCIsIC4uLmFyZ3MpO1xuICB9XG5cbiAgenJhbmdlYnlsZXgoXG4gICAga2V5OiBzdHJpbmcsXG4gICAgbWluOiBzdHJpbmcsXG4gICAgbWF4OiBzdHJpbmcsXG4gICAgb3B0cz86IFpSYW5nZUJ5TGV4T3B0cyxcbiAgKSB7XG4gICAgY29uc3QgYXJncyA9IHRoaXMucHVzaFpSYW5nZU9wdHMoW2tleSwgbWluLCBtYXhdLCBvcHRzKTtcbiAgICByZXR1cm4gdGhpcy5leGVjQXJyYXlSZXBseTxCdWxrU3RyaW5nPihcIlpSQU5HRUJZTEVYXCIsIC4uLmFyZ3MpO1xuICB9XG5cbiAgenJhbmdlYnlzY29yZShcbiAgICBrZXk6IHN0cmluZyxcbiAgICBtaW46IG51bWJlciB8IHN0cmluZyxcbiAgICBtYXg6IG51bWJlciB8IHN0cmluZyxcbiAgICBvcHRzPzogWlJhbmdlQnlTY29yZU9wdHMsXG4gICkge1xuICAgIGNvbnN0IGFyZ3MgPSB0aGlzLnB1c2haUmFuZ2VPcHRzKFtrZXksIG1pbiwgbWF4XSwgb3B0cyk7XG4gICAgcmV0dXJuIHRoaXMuZXhlY0FycmF5UmVwbHk8QnVsa1N0cmluZz4oXCJaUkFOR0VCWVNDT1JFXCIsIC4uLmFyZ3MpO1xuICB9XG5cbiAgenJhbmsoa2V5OiBzdHJpbmcsIG1lbWJlcjogc3RyaW5nKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY0ludGVnZXJPck5pbFJlcGx5KFwiWlJBTktcIiwga2V5LCBtZW1iZXIpO1xuICB9XG5cbiAgenJlbShrZXk6IHN0cmluZywgLi4ubWVtYmVyczogc3RyaW5nW10pIHtcbiAgICByZXR1cm4gdGhpcy5leGVjSW50ZWdlclJlcGx5KFwiWlJFTVwiLCBrZXksIC4uLm1lbWJlcnMpO1xuICB9XG5cbiAgenJlbXJhbmdlYnlsZXgoa2V5OiBzdHJpbmcsIG1pbjogc3RyaW5nLCBtYXg6IHN0cmluZykge1xuICAgIHJldHVybiB0aGlzLmV4ZWNJbnRlZ2VyUmVwbHkoXCJaUkVNUkFOR0VCWUxFWFwiLCBrZXksIG1pbiwgbWF4KTtcbiAgfVxuXG4gIHpyZW1yYW5nZWJ5cmFuayhrZXk6IHN0cmluZywgc3RhcnQ6IG51bWJlciwgc3RvcDogbnVtYmVyKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY0ludGVnZXJSZXBseShcIlpSRU1SQU5HRUJZUkFOS1wiLCBrZXksIHN0YXJ0LCBzdG9wKTtcbiAgfVxuXG4gIHpyZW1yYW5nZWJ5c2NvcmUoa2V5OiBzdHJpbmcsIG1pbjogbnVtYmVyIHwgc3RyaW5nLCBtYXg6IG51bWJlciB8IHN0cmluZykge1xuICAgIHJldHVybiB0aGlzLmV4ZWNJbnRlZ2VyUmVwbHkoXCJaUkVNUkFOR0VCWVNDT1JFXCIsIGtleSwgbWluLCBtYXgpO1xuICB9XG5cbiAgenJldnJhbmdlKFxuICAgIGtleTogc3RyaW5nLFxuICAgIHN0YXJ0OiBudW1iZXIsXG4gICAgc3RvcDogbnVtYmVyLFxuICAgIG9wdHM/OiBaUmFuZ2VPcHRzLFxuICApIHtcbiAgICBjb25zdCBhcmdzID0gdGhpcy5wdXNoWlJhbmdlT3B0cyhba2V5LCBzdGFydCwgc3RvcF0sIG9wdHMpO1xuICAgIHJldHVybiB0aGlzLmV4ZWNBcnJheVJlcGx5PEJ1bGtTdHJpbmc+KFwiWlJFVlJBTkdFXCIsIC4uLmFyZ3MpO1xuICB9XG5cbiAgenJldnJhbmdlYnlsZXgoXG4gICAga2V5OiBzdHJpbmcsXG4gICAgbWF4OiBzdHJpbmcsXG4gICAgbWluOiBzdHJpbmcsXG4gICAgb3B0cz86IFpSYW5nZUJ5TGV4T3B0cyxcbiAgKSB7XG4gICAgY29uc3QgYXJncyA9IHRoaXMucHVzaFpSYW5nZU9wdHMoW2tleSwgbWluLCBtYXhdLCBvcHRzKTtcbiAgICByZXR1cm4gdGhpcy5leGVjQXJyYXlSZXBseTxCdWxrU3RyaW5nPihcIlpSRVZSQU5HRUJZTEVYXCIsIC4uLmFyZ3MpO1xuICB9XG5cbiAgenJldnJhbmdlYnlzY29yZShcbiAgICBrZXk6IHN0cmluZyxcbiAgICBtYXg6IG51bWJlcixcbiAgICBtaW46IG51bWJlcixcbiAgICBvcHRzPzogWlJhbmdlQnlTY29yZU9wdHMsXG4gICkge1xuICAgIGNvbnN0IGFyZ3MgPSB0aGlzLnB1c2haUmFuZ2VPcHRzKFtrZXksIG1heCwgbWluXSwgb3B0cyk7XG4gICAgcmV0dXJuIHRoaXMuZXhlY0FycmF5UmVwbHk8QnVsa1N0cmluZz4oXCJaUkVWUkFOR0VCWVNDT1JFXCIsIC4uLmFyZ3MpO1xuICB9XG5cbiAgcHJpdmF0ZSBwdXNoWlJhbmdlT3B0cyhcbiAgICBhcmdzOiAobnVtYmVyIHwgc3RyaW5nKVtdLFxuICAgIG9wdHM/OiBaUmFuZ2VPcHRzIHwgWlJhbmdlQnlMZXhPcHRzIHwgWlJhbmdlQnlTY29yZU9wdHMsXG4gICkge1xuICAgIGlmICgob3B0cyBhcyBaUmFuZ2VCeVNjb3JlT3B0cyk/LndpdGhTY29yZSkge1xuICAgICAgYXJncy5wdXNoKFwiV0lUSFNDT1JFU1wiKTtcbiAgICB9XG4gICAgaWYgKChvcHRzIGFzIFpSYW5nZUJ5U2NvcmVPcHRzKT8ubGltaXQpIHtcbiAgICAgIGFyZ3MucHVzaChcbiAgICAgICAgXCJMSU1JVFwiLFxuICAgICAgICAob3B0cyBhcyBaUmFuZ2VCeVNjb3JlT3B0cykubGltaXQhLm9mZnNldCxcbiAgICAgICAgKG9wdHMgYXMgWlJhbmdlQnlTY29yZU9wdHMpLmxpbWl0IS5jb3VudCxcbiAgICAgICk7XG4gICAgfVxuICAgIHJldHVybiBhcmdzO1xuICB9XG5cbiAgenJldnJhbmsoa2V5OiBzdHJpbmcsIG1lbWJlcjogc3RyaW5nKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY0ludGVnZXJPck5pbFJlcGx5KFwiWlJFVlJBTktcIiwga2V5LCBtZW1iZXIpO1xuICB9XG5cbiAgenNjb3JlKGtleTogc3RyaW5nLCBtZW1iZXI6IHN0cmluZykge1xuICAgIHJldHVybiB0aGlzLmV4ZWNCdWxrUmVwbHkoXCJaU0NPUkVcIiwga2V5LCBtZW1iZXIpO1xuICB9XG5cbiAgc2NhbihcbiAgICBjdXJzb3I6IG51bWJlcixcbiAgICBvcHRzPzogU2Nhbk9wdHMsXG4gICkge1xuICAgIGNvbnN0IGFyZ3MgPSB0aGlzLnB1c2hTY2FuT3B0cyhbY3Vyc29yXSwgb3B0cyk7XG4gICAgcmV0dXJuIHRoaXMuZXhlY0FycmF5UmVwbHkoXCJTQ0FOXCIsIC4uLmFyZ3MpIGFzIFByb21pc2U8XG4gICAgICBbQnVsa1N0cmluZywgQnVsa1N0cmluZ1tdXVxuICAgID47XG4gIH1cblxuICBzc2NhbihcbiAgICBrZXk6IHN0cmluZyxcbiAgICBjdXJzb3I6IG51bWJlcixcbiAgICBvcHRzPzogU1NjYW5PcHRzLFxuICApIHtcbiAgICBjb25zdCBhcmdzID0gdGhpcy5wdXNoU2Nhbk9wdHMoW2tleSwgY3Vyc29yXSwgb3B0cyk7XG4gICAgcmV0dXJuIHRoaXMuZXhlY0FycmF5UmVwbHkoXCJTU0NBTlwiLCAuLi5hcmdzKSBhcyBQcm9taXNlPFxuICAgICAgW0J1bGtTdHJpbmcsIEJ1bGtTdHJpbmdbXV1cbiAgICA+O1xuICB9XG5cbiAgaHNjYW4oXG4gICAga2V5OiBzdHJpbmcsXG4gICAgY3Vyc29yOiBudW1iZXIsXG4gICAgb3B0cz86IEhTY2FuT3B0cyxcbiAgKSB7XG4gICAgY29uc3QgYXJncyA9IHRoaXMucHVzaFNjYW5PcHRzKFtrZXksIGN1cnNvcl0sIG9wdHMpO1xuICAgIHJldHVybiB0aGlzLmV4ZWNBcnJheVJlcGx5KFwiSFNDQU5cIiwgLi4uYXJncykgYXMgUHJvbWlzZTxcbiAgICAgIFtCdWxrU3RyaW5nLCBCdWxrU3RyaW5nW11dXG4gICAgPjtcbiAgfVxuXG4gIHpzY2FuKFxuICAgIGtleTogc3RyaW5nLFxuICAgIGN1cnNvcjogbnVtYmVyLFxuICAgIG9wdHM/OiBaU2Nhbk9wdHMsXG4gICkge1xuICAgIGNvbnN0IGFyZ3MgPSB0aGlzLnB1c2hTY2FuT3B0cyhba2V5LCBjdXJzb3JdLCBvcHRzKTtcbiAgICByZXR1cm4gdGhpcy5leGVjQXJyYXlSZXBseShcIlpTQ0FOXCIsIC4uLmFyZ3MpIGFzIFByb21pc2U8XG4gICAgICBbQnVsa1N0cmluZywgQnVsa1N0cmluZ1tdXVxuICAgID47XG4gIH1cblxuICBwcml2YXRlIHB1c2hTY2FuT3B0cyhcbiAgICBhcmdzOiAobnVtYmVyIHwgc3RyaW5nKVtdLFxuICAgIG9wdHM/OiBTY2FuT3B0cyB8IEhTY2FuT3B0cyB8IFpTY2FuT3B0cyB8IFNTY2FuT3B0cyxcbiAgKSB7XG4gICAgaWYgKG9wdHM/LnBhdHRlcm4gIT09IHVuZGVmaW5lZCkge1xuICAgICAgYXJncy5wdXNoKFwiTUFUQ0hcIiwgb3B0cy5wYXR0ZXJuKTtcbiAgICB9XG4gICAgaWYgKG9wdHM/LmNvdW50ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGFyZ3MucHVzaChcIkNPVU5UXCIsIG9wdHMuY291bnQpO1xuICAgIH1cbiAgICBpZiAoKG9wdHMgYXMgU2Nhbk9wdHMpPy50eXBlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGFyZ3MucHVzaChcIlRZUEVcIiwgKG9wdHMgYXMgU2Nhbk9wdHMpLnR5cGUhKTtcbiAgICB9XG4gICAgcmV0dXJuIGFyZ3M7XG4gIH1cblxuICB0eCgpIHtcbiAgICByZXR1cm4gY3JlYXRlUmVkaXNQaXBlbGluZSh0aGlzLmV4ZWN1dG9yLmNvbm5lY3Rpb24sIHRydWUpO1xuICB9XG5cbiAgcGlwZWxpbmUoKSB7XG4gICAgcmV0dXJuIGNyZWF0ZVJlZGlzUGlwZWxpbmUodGhpcy5leGVjdXRvci5jb25uZWN0aW9uKTtcbiAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFJlZGlzQ29ubmVjdE9wdGlvbnMgZXh0ZW5kcyBSZWRpc0Nvbm5lY3Rpb25PcHRpb25zIHtcbiAgaG9zdG5hbWU6IHN0cmluZztcbiAgcG9ydD86IG51bWJlciB8IHN0cmluZztcbn1cblxuLyoqXG4gKiBDb25uZWN0IHRvIFJlZGlzIHNlcnZlclxuICogQHBhcmFtIG9wdGlvbnNcbiAqIEBleGFtcGxlXG4gKiBgYGB0c1xuICogaW1wb3J0IHsgY29ubmVjdCB9IGZyb20gXCIuL21vZC50c1wiO1xuICogY29uc3QgY29ubjEgPSBhd2FpdCBjb25uZWN0KHtob3N0bmFtZTogXCIxMjcuMC4wLjFcIiwgcG9ydDogNjM3OX0pOyAvLyAtPiBUQ1AsIDEyNy4wLjAuMTo2Mzc5XG4gKiBjb25zdCBjb25uMiA9IGF3YWl0IGNvbm5lY3Qoe2hvc3RuYW1lOiBcInJlZGlzLnByb3h5XCIsIHBvcnQ6IDQ0MywgdGxzOiB0cnVlfSk7IC8vIC0+IFRMUywgcmVkaXMucHJveHk6NDQzXG4gKiBgYGBcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNvbm5lY3Qob3B0aW9uczogUmVkaXNDb25uZWN0T3B0aW9ucyk6IFByb21pc2U8UmVkaXM+IHtcbiAgY29uc3QgY29ubmVjdGlvbiA9IGNyZWF0ZVJlZGlzQ29ubmVjdGlvbihvcHRpb25zKTtcbiAgYXdhaXQgY29ubmVjdGlvbi5jb25uZWN0KCk7XG4gIGNvbnN0IGV4ZWN1dG9yID0gbmV3IE11eEV4ZWN1dG9yKGNvbm5lY3Rpb24pO1xuICByZXR1cm4gY3JlYXRlKGV4ZWN1dG9yKTtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYSBsYXp5IFJlZGlzIGNsaWVudCB0aGF0IHdpbGwgbm90IGVzdGFibGlzaCBhIGNvbm5lY3Rpb24gdW50aWwgYSBjb21tYW5kIGlzIGFjdHVhbGx5IGV4ZWN1dGVkLlxuICpcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBjcmVhdGVMYXp5Q2xpZW50IH0gZnJvbSBcIi4vbW9kLnRzXCI7XG4gKlxuICogY29uc3QgY2xpZW50ID0gY3JlYXRlTGF6eUNsaWVudCh7IGhvc3RuYW1lOiBcIjEyNy4wLjAuMVwiLCBwb3J0OiA2Mzc5IH0pO1xuICogY29uc29sZS5hc3NlcnQoIWNsaWVudC5pc0Nvbm5lY3RlZCk7XG4gKiBhd2FpdCBjbGllbnQuZ2V0KFwiZm9vXCIpO1xuICogY29uc29sZS5hc3NlcnQoY2xpZW50LmlzQ29ubmVjdGVkKTtcbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTGF6eUNsaWVudChvcHRpb25zOiBSZWRpc0Nvbm5lY3RPcHRpb25zKTogUmVkaXMge1xuICBjb25zdCBjb25uZWN0aW9uID0gY3JlYXRlUmVkaXNDb25uZWN0aW9uKG9wdGlvbnMpO1xuICBjb25zdCBleGVjdXRvciA9IGNyZWF0ZUxhenlFeGVjdXRvcihjb25uZWN0aW9uKTtcbiAgcmV0dXJuIGNyZWF0ZShleGVjdXRvcik7XG59XG5cbi8qKlxuICogQ3JlYXRlIGEgcmVkaXMgY2xpZW50IGZyb20gYENvbW1hbmRFeGVjdXRvcmBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZShleGVjdXRvcjogQ29tbWFuZEV4ZWN1dG9yKTogUmVkaXMge1xuICByZXR1cm4gbmV3IFJlZGlzSW1wbChleGVjdXRvcik7XG59XG5cbi8qKlxuICogRXh0cmFjdCBSZWRpc0Nvbm5lY3RPcHRpb25zIGZyb20gcmVkaXMgVVJMXG4gKiBAcGFyYW0gdXJsXG4gKiBAZXhhbXBsZVxuICogYGBgdHNcbiAqIGltcG9ydCB7IHBhcnNlVVJMIH0gZnJvbSBcIi4vbW9kLnRzXCI7XG4gKlxuICogcGFyc2VVUkwoXCJyZWRpczovL2ZvbzpiYXJAbG9jYWxob3N0OjYzNzkvMVwiKTsgLy8gLT4ge2hvc3RuYW1lOiBcImxvY2FsaG9zdFwiLCBwb3J0OiBcIjYzNzlcIiwgdGxzOiBmYWxzZSwgZGI6IDEsIG5hbWU6IGZvbywgcGFzc3dvcmQ6IGJhcn1cbiAqIHBhcnNlVVJMKFwicmVkaXNzOi8vMTI3LjAuMC4xOjQ0My8/ZGI9MiZwYXNzd29yZD1iYXJcIik7IC8vIC0+IHtob3N0bmFtZTogXCIxMjcuMC4wLjFcIiwgcG9ydDogXCI0NDNcIiwgdGxzOiB0cnVlLCBkYjogMiwgbmFtZTogdW5kZWZpbmVkLCBwYXNzd29yZDogYmFyfVxuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVVSTCh1cmw6IHN0cmluZyk6IFJlZGlzQ29ubmVjdE9wdGlvbnMge1xuICBjb25zdCB7XG4gICAgcHJvdG9jb2wsXG4gICAgaG9zdG5hbWUsXG4gICAgcG9ydCxcbiAgICB1c2VybmFtZSxcbiAgICBwYXNzd29yZCxcbiAgICBwYXRobmFtZSxcbiAgICBzZWFyY2hQYXJhbXMsXG4gIH0gPSBuZXcgVVJMKHVybCk7XG4gIGNvbnN0IGRiID0gcGF0aG5hbWUucmVwbGFjZShcIi9cIiwgXCJcIikgIT09IFwiXCJcbiAgICA/IHBhdGhuYW1lLnJlcGxhY2UoXCIvXCIsIFwiXCIpXG4gICAgOiBzZWFyY2hQYXJhbXMuZ2V0KFwiZGJcIikgPz8gdW5kZWZpbmVkO1xuICByZXR1cm4ge1xuICAgIGhvc3RuYW1lOiBob3N0bmFtZSAhPT0gXCJcIiA/IGhvc3RuYW1lIDogXCJsb2NhbGhvc3RcIixcbiAgICBwb3J0OiBwb3J0ICE9PSBcIlwiID8gcGFyc2VJbnQocG9ydCwgMTApIDogNjM3OSxcbiAgICB0bHM6IHByb3RvY29sID09IFwicmVkaXNzOlwiID8gdHJ1ZSA6IHNlYXJjaFBhcmFtcy5nZXQoXCJzc2xcIikgPT09IFwidHJ1ZVwiLFxuICAgIGRiOiBkYiA/IHBhcnNlSW50KGRiLCAxMCkgOiB1bmRlZmluZWQsXG4gICAgbmFtZTogdXNlcm5hbWUgIT09IFwiXCIgPyB1c2VybmFtZSA6IHVuZGVmaW5lZCxcbiAgICBwYXNzd29yZDogcGFzc3dvcmQgIT09IFwiXCJcbiAgICAgID8gcGFzc3dvcmRcbiAgICAgIDogc2VhcmNoUGFyYW1zLmdldChcInBhc3N3b3JkXCIpID8/IHVuZGVmaW5lZCxcbiAgfTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlUmVkaXNDb25uZWN0aW9uKG9wdGlvbnM6IFJlZGlzQ29ubmVjdE9wdGlvbnMpOiBDb25uZWN0aW9uIHtcbiAgY29uc3QgeyBob3N0bmFtZSwgcG9ydCA9IDYzNzksIC4uLm9wdHMgfSA9IG9wdGlvbnM7XG4gIHJldHVybiBuZXcgUmVkaXNDb25uZWN0aW9uKGhvc3RuYW1lLCBwb3J0LCBvcHRzKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlTGF6eUV4ZWN1dG9yKGNvbm5lY3Rpb246IENvbm5lY3Rpb24pOiBDb21tYW5kRXhlY3V0b3Ige1xuICBsZXQgZXhlY3V0b3I6IENvbW1hbmRFeGVjdXRvciB8IG51bGwgPSBudWxsO1xuICByZXR1cm4ge1xuICAgIGdldCBjb25uZWN0aW9uKCkge1xuICAgICAgcmV0dXJuIGNvbm5lY3Rpb247XG4gICAgfSxcbiAgICBhc3luYyBleGVjKGNvbW1hbmQsIC4uLmFyZ3MpIHtcbiAgICAgIGlmICghZXhlY3V0b3IpIHtcbiAgICAgICAgZXhlY3V0b3IgPSBuZXcgTXV4RXhlY3V0b3IoY29ubmVjdGlvbik7XG4gICAgICAgIGF3YWl0IGNvbm5lY3Rpb24uY29ubmVjdCgpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGV4ZWN1dG9yLmV4ZWMoY29tbWFuZCwgLi4uYXJncyk7XG4gICAgfSxcbiAgICBjbG9zZSgpIHtcbiAgICAgIGlmIChleGVjdXRvcikge1xuICAgICAgICByZXR1cm4gZXhlY3V0b3IuY2xvc2UoKTtcbiAgICAgIH1cbiAgICB9LFxuICB9O1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQTJDQSxTQUFTLGVBQWUsUUFBUSxrQkFBa0I7QUFHbEQsU0FBMEIsV0FBVyxRQUFRLGdCQUFnQjtBQWE3RCxTQUFTLG1CQUFtQixRQUFRLGdCQUFnQjtBQUNwRCxTQUFTLFVBQVUsRUFBRSxTQUFTLFFBQVEsY0FBYztBQUNwRCxTQUNFLFVBQVUsRUFDVixXQUFXLEVBQ1gsUUFBUSxFQUNSLFFBQVEsRUFDUixpQkFBaUIsRUFDakIsUUFBUSxFQUNSLGFBQWEsRUFDYixzQkFBc0IsRUFDdEIsbUJBQW1CLEVBQ25CLGVBQWUsRUFDZixNQUFNLEVBQ04sTUFBTSxFQVdOLE1BQU0sUUFVRCxjQUFjO0FBYXJCLE1BQU07RUFDYSxTQUEwQjtFQUUzQyxJQUFJLFdBQVc7SUFDYixPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLFFBQVE7RUFDMUM7RUFFQSxJQUFJLGNBQWM7SUFDaEIsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxXQUFXO0VBQzdDO0VBRUEsWUFBWSxRQUF5QixDQUFFO0lBQ3JD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
// denoCacheMetadata=5551485545135314074,17120443499850881457