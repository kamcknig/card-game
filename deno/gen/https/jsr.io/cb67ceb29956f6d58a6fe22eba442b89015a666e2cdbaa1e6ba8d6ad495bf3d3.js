// deno-lint-ignore-file no-explicit-any
import * as dt from 'jsr:@std/datetime@0.224.3';
function getDefaultConsoleConfig() {
  return {
    prefixFormat: '[{T}]{C}[{L}] ',
    timeFormat: 'MM-dd HH:mm:ss.SSS',
    levelAlignment: 'right',
    enabledLevels: [
      'error',
      'warn',
      'info',
      'log',
      'timer',
      'func',
      'debug'
    ],
    prefixEmptyLines: false,
    indentSize: 2,
    colors: {
      error: 'red',
      warn: 'yellow',
      log: 'lightgray',
      info: 'blue',
      debug: 'gray',
      timer: 'green',
      func: 'purple'
    }
  };
}
function getDefaultFileConfig() {
  return {
    prefixFormat: '[{T}]{C}[{L}] ',
    timeFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
    levelAlignment: 'right',
    enabledLevels: [
      'error',
      'warn',
      'info',
      'log',
      'timer',
      'func',
      'debug'
    ],
    prefixEmptyLines: false,
    indentSize: 4,
    colors: {
      error: 'red',
      warn: 'yellow',
      log: 'lightgray',
      info: 'blue',
      debug: 'gray',
      timer: 'green',
      func: 'purple'
    }
  };
}
let fileLogger;
const consoleConfig = getDefaultConsoleConfig();
const fileConfig = getDefaultFileConfig();
const rawConsole = {
  ...globalThis.console
};
const timers = {};
let currentIndent = 0;
export function init() {
  for (const k of [
    'error',
    'warn',
    'log',
    'info',
    'debug'
  ]){
    globalThis.console[k] = (...data)=>timestampedLeveledLog(k, data);
  }
  globalThis.console.time = (label = 'default')=>{
    if (timers[label]) return console.warn(`Timer ${label} already exists.`, timers);
    timers[label] = performance.now();
  };
  globalThis.console.timeLog = (label = 'default', ...data)=>{
    const logTime = performance.now();
    const startTime = timers[label];
    if (!startTime) return console.warn(`Timer ${label} doesn't exist.`, timers);
    timestampedLeveledLog('timer', [
      `${label}: ${(logTime - startTime).toLocaleString(undefined, {
        maximumFractionDigits: 0
      })}ms`,
      ...data
    ]);
  };
  globalThis.console.timeEnd = (label = 'default')=>{
    const endTime = performance.now();
    const startTime = timers[label];
    if (!startTime) return console.warn(`Timer ${label} doesn't exist.`, timers);
    timestampedLeveledLog('timer', [
      `${label}: ${(endTime - startTime).toLocaleString(undefined, {
        maximumFractionDigits: 0
      })}ms - timer ended`
    ]);
    delete timers[label];
  };
}
function getFileLogger() {
  if (fileLogger) return fileLogger;
  const name = Deno.mainModule.replace(/.*\/([^\\]+)\.ts$/, '$1');
  try {
    Deno.statSync('./logs/');
  } catch  {
    Deno.mkdirSync('./logs/');
  }
  fileLogger = Deno.createSync(`./logs/${name}-${dt.format(new Date, 'yyyyMMdd-HHmmss')}.log`);
  return fileLogger;
}
function timestampedLeveledLog(level, data) {
  // count '%c' in a string but ignore '%%c'
  const findColorSpecifiers = (s)=>{
    const r = [];
    for(let i = 0; i < s.length - 1; ++i){
      if (s[i] === '%' && s[i + 1] === 'c' && (i === 0 || s[i - 1] !== '%')) r.push(i);
    }
    return r;
  };
  const removeColorSpecifiers = (s, removeLimit)=>{
    const cs = findColorSpecifiers(s).slice(0, removeLimit);
    let r = '';
    let p = 0;
    for (const c of cs){
      r += s.slice(p, c);
      p = c + 2;
    }
    r += s.slice(p);
    return r;
  };
  const breakDataToColoredLines = (data)=>{
    const formatParams = (data)=>{
      const records = [];
      for(let i = 0; i < data.length; ++i)records.push(typeof data[i] === 'string' ? data[i] : Deno.inspect(data[i]));
      return records.join(' ');
    };
    if (data.length === 0) data = [
      ''
    ];
    let fi = 1;
    const cls = [];
    if (typeof data[0] === 'string') {
      const lines = data[0].split('\n');
      for (const l of lines){
        const c = findColorSpecifiers(l).length;
        cls.push({
          l,
          colors: data.slice(fi, fi + c)
        });
        fi += c;
      }
    } else {
      cls.push(...formatParams([
        data[0]
      ]).split('\n').map((l)=>({
          l,
          colors: []
        })));
    }
    if (fi < data.length) {
      const remainingLines = formatParams(data.slice(fi)).split('\n');
      cls[cls.length - 1].l += ' ' + remainingLines.shift();
      for (const l of remainingLines){
        cls.push({
          l,
          colors: []
        });
      }
    }
    return cls;
  };
  const computeLogLines = (lines, cfg)=>{
    const skipPrefix = data.length === 0 && cfg.prefixEmptyLines === false;
    const dateStr = dt.format(new Date(), cfg.timeFormat);
    const alignFuncs = {
      left: (s)=>s.padEnd(5, ' '),
      right: (s)=>s.padStart(5, ' '),
      none: (s)=>s
    };
    const levelStr = alignFuncs[cfg.levelAlignment](level);
    const indent = ' '.repeat(currentIndent * cfg.indentSize);
    const levelColor = `color:${cfg.colors[level]}`;
    let currentUserColorFormat = levelColor;
    const logs = [];
    const colors = [];
    for(let i = 0; i < lines.length; ++i){
      const l = lines[i];
      const connector = lines.length === 1 ? '─' : i === 0 ? '┬' : i === lines.length - 1 ? '└' : '├';
      if (skipPrefix) {
        logs.push(l.l);
        colors.push(...l.colors);
      } else {
        const prefix = cfg.prefixFormat.replaceAll('{T}', dateStr).replaceAll('{l}', levelStr).replaceAll('{L}', levelStr.toUpperCase()).replaceAll('{C}', connector);
        logs.push(`%c${prefix}%c${indent}` + l.l);
        colors.push(levelColor, currentUserColorFormat, ...l.colors);
      }
      if (l.colors.length > 0) currentUserColorFormat = l.colors[l.colors.length - 1];
    }
    return {
      logs,
      colors
    };
  };
  const outputToConsole = consoleConfig.enabledLevels.includes(level);
  const outputToFile = fileConfig.enabledLevels.includes(level);
  if (!outputToConsole && !outputToFile) return;
  const lines = breakDataToColoredLines(data);
  if (outputToConsole) {
    const { logs, colors } = computeLogLines(lines, consoleConfig);
    rawConsole[level === 'timer' || level === 'func' ? 'log' : level](logs.join('\n'), ...colors);
  }
  if (outputToFile) {
    const { logs, colors } = computeLogLines(lines, fileConfig);
    const file = getFileLogger();
    file.write(new TextEncoder().encode(removeColorSpecifiers(logs.join('\n'), colors.length) + '\n'));
  }
}
/** Set log config
 * @param config new config
 * @param applyTo file or console or all
 */ export function setConfig(config, applyTo = 'all') {
  if (applyTo === 'all' || applyTo === 'console') Object.assign(consoleConfig, config);
  if (applyTo === 'all' || applyTo === 'file') Object.assign(fileConfig, config);
}
/**
 * Set log enabled levels to >= the specified level, as the following order:
 * - error
 * - warn
 * - info
 * - log = timer = func
 * - debug
 * @param level expected log level
 * @param applyTo file or console or all
 */ export function setLogLevel(level, applyTo = 'all') {
  const levels = [
    'debug',
    'log',
    'func',
    'timer',
    'info',
    'warn',
    'error'
  ];
  const index = levels.indexOf(level);
  const enabledLevels = levels.slice(index);
  setConfig({
    enabledLevels
  }, applyTo);
}
/**
 * This function need to be called by `using` statement.
 * It will issue a log "xxx enters" with 'info' level immediately, and a log 
 * "xxx leaves" will be automatically issued when current scope ends
 * All other logs issued in this scope will be promoted using spaces by 1 indent level
 * @example
  * function init() {
 *   using x = traceScope('Init')
 *   ...
 *   console.log('another log inside init')
 *   ...
 * }
 */ export function traceScope(name, context = '', leaveLog = false, level = 'info') {
  const contextText = context ? ` (${context})` : '';
  timestampedLeveledLog(level, [
    `${name} enters${contextText}`
  ]);
  currentIndent++;
  return {
    [Symbol.dispose] () {
      currentIndent--;
      if (leaveLog) timestampedLeveledLog(level, [
        `${name} leaves`
      ]);
    }
  };
}
/**
 * This function need to be called by `using` statement. 
 * It will issue a log "${funcName} called" with 'func' level immediately, and a log
 * 
 */ export function traceFunction(args = null, leaveLog = false) {
  const l = new Error().stack?.split('\n')[2];
  const name = l?.match(/at (.+) \(/)?.[1] || l?.match(/\/([^\/]+)$/)?.[1] || 'anonymous';
  return traceScope(name, args ? 'args: ' + JSON.stringify([
    ...args
  ]) : '', leaveLog, 'func');
}
/**
 * Get the raw console object in case you need to use the original console
 */ export const raw = rawConsole;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0B0aW1lcHAvZW5oYW5jZWQtZGVuby1sb2cvMC40LjEvbG9nLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIGRlbm8tbGludC1pZ25vcmUtZmlsZSBuby1leHBsaWNpdC1hbnlcblxuaW1wb3J0ICogYXMgZHQgZnJvbSAnanNyOkBzdGQvZGF0ZXRpbWVAMC4yMjQuMydcblxudHlwZSBMb2dMZXZlbCA9ICdlcnJvcicgfCAnd2FybicgfCAnbG9nJyB8ICdpbmZvJyB8ICdkZWJ1ZycgfCAndGltZXInIHwgJ2Z1bmMnXG50eXBlIExvZ0NvbmZpZyA9IHtcblx0Ly8gU3BlY2lhbCBmb3JtYXQgc3BlY2lmaWVyc1xuXHQvLyB7VH06IHRpbWUsIGN1cnJlbnQgbG9jYWwgdGltZSBmb3JtYXRlZCBieSBgdGltZUZvcm1hdGBcblx0Ly8ge2x9OiBsb2cgbGV2ZWwgaW4gbG93ZXJjYXNlXG5cdC8vIHtMfTogbG9nIGxldmVsIGluIHVwcGVyY2FzZVxuXHQvLyB7Q306IG11bHRpLWxpbmUgY29ubmVjdG9yXG5cdHByZWZpeEZvcm1hdDogc3RyaW5nLFxuXG5cdC8vIHRoZSBmb3JtYXQgb2YgdGhlIHRpbWUgcGFydCBpbiB0aGUgcHJlZml4XG5cdC8vIHNlZSBodHRwczovL2Rlbm8ubGFuZC9zdGQvZGF0ZXRpbWUvbW9kLnRzIGZvciBtb3JlIGluZm9ybWF0aW9uXG5cdHRpbWVGb3JtYXQ6IHN0cmluZyxcblxuXHQvLyBob3cgdG8gYWxpZ24gdGhlIGxldmVsIHN0cmluZyBpbiB0aGUgcHJlZml4XG5cdGxldmVsQWxpZ25tZW50OiAnbGVmdCcgfCAncmlnaHQnIHwgJ25vbmUnLFxuXG5cdHByZWZpeEVtcHR5TGluZXM6IGJvb2xlYW4sXG5cdGVuYWJsZWRMZXZlbHM6IExvZ0xldmVsW10sXG5cdGluZGVudFNpemU6IG51bWJlcixcblx0Y29sb3JzOiBSZWNvcmQ8TG9nTGV2ZWwsIHN0cmluZz5cbn1cblxuZnVuY3Rpb24gZ2V0RGVmYXVsdENvbnNvbGVDb25maWcoKSA6IExvZ0NvbmZpZyB7XG5cdHJldHVybiB7XG5cdFx0cHJlZml4Rm9ybWF0OiAnW3tUfV17Q31be0x9XSAnLFxuXHRcdHRpbWVGb3JtYXQ6ICdNTS1kZCBISDptbTpzcy5TU1MnLFxuXHRcdGxldmVsQWxpZ25tZW50OiAncmlnaHQnLFxuXHRcdGVuYWJsZWRMZXZlbHM6IFsnZXJyb3InLCAnd2FybicsICdpbmZvJywgJ2xvZycsICd0aW1lcicsICdmdW5jJywgJ2RlYnVnJ10sXG5cdFx0cHJlZml4RW1wdHlMaW5lczogZmFsc2UsXG5cdFx0aW5kZW50U2l6ZTogMixcblx0XHRjb2xvcnM6IHtlcnJvcjogJ3JlZCcsIHdhcm46ICd5ZWxsb3cnLCBsb2c6ICdsaWdodGdyYXknLCBpbmZvOiAnYmx1ZScsIGRlYnVnOiAnZ3JheScsIHRpbWVyOiAnZ3JlZW4nLCBmdW5jOiAncHVycGxlJ31cblx0fVxufVxuZnVuY3Rpb24gZ2V0RGVmYXVsdEZpbGVDb25maWcoKSA6IExvZ0NvbmZpZyB7XG5cdHJldHVybiB7XG5cdFx0cHJlZml4Rm9ybWF0OiAnW3tUfV17Q31be0x9XSAnLFxuXHRcdHRpbWVGb3JtYXQ6ICd5eXl5LU1NLWRkIEhIOm1tOnNzLlNTUycsXG5cdFx0bGV2ZWxBbGlnbm1lbnQ6ICdyaWdodCcsXG5cdFx0ZW5hYmxlZExldmVsczogWydlcnJvcicsICd3YXJuJywgJ2luZm8nLCAnbG9nJywgJ3RpbWVyJywgJ2Z1bmMnLCAnZGVidWcnXSxcblx0XHRwcmVmaXhFbXB0eUxpbmVzOiBmYWxzZSxcblx0XHRpbmRlbnRTaXplOiA0LFxuXHRcdGNvbG9yczoge2Vycm9yOiAncmVkJywgd2FybjogJ3llbGxvdycsIGxvZzogJ2xpZ2h0Z3JheScsIGluZm86ICdibHVlJywgZGVidWc6ICdncmF5JywgdGltZXI6ICdncmVlbicsIGZ1bmM6ICdwdXJwbGUnfVxuXHR9XG59XG5cbmxldCBmaWxlTG9nZ2VyOiBEZW5vLkZzRmlsZVxuY29uc3QgY29uc29sZUNvbmZpZyA9IGdldERlZmF1bHRDb25zb2xlQ29uZmlnKClcbmNvbnN0IGZpbGVDb25maWcgPSBnZXREZWZhdWx0RmlsZUNvbmZpZygpXG5jb25zdCByYXdDb25zb2xlID0gey4uLmdsb2JhbFRoaXMuY29uc29sZX1cbmNvbnN0IHRpbWVyczogUmVjb3JkPHN0cmluZywgbnVtYmVyPiA9IHt9XG5sZXQgY3VycmVudEluZGVudCA9IDBcblxuZXhwb3J0IGZ1bmN0aW9uIGluaXQoKSB7XG5cdGZvciAoY29uc3QgayBvZiBbJ2Vycm9yJywgJ3dhcm4nLCAnbG9nJywgJ2luZm8nLCAnZGVidWcnXSBhcyBjb25zdCkge1xuXHRcdGdsb2JhbFRoaXMuY29uc29sZVtrXSA9ICguLi5kYXRhOiBhbnlbXSkgPT4gdGltZXN0YW1wZWRMZXZlbGVkTG9nKGssIGRhdGEpXG5cdH1cblx0XG5cdGdsb2JhbFRoaXMuY29uc29sZS50aW1lID0gKGxhYmVsID0gJ2RlZmF1bHQnKSA9PiB7XG5cdFx0aWYgKHRpbWVyc1tsYWJlbF0pXG5cdFx0XHRyZXR1cm4gY29uc29sZS53YXJuKGBUaW1lciAke2xhYmVsfSBhbHJlYWR5IGV4aXN0cy5gLCB0aW1lcnMpXG5cdFx0dGltZXJzW2xhYmVsXSA9IHBlcmZvcm1hbmNlLm5vdygpXG5cdH1cblx0Z2xvYmFsVGhpcy5jb25zb2xlLnRpbWVMb2cgPSAobGFiZWwgPSAnZGVmYXVsdCcsIC4uLmRhdGE6IGFueVtdKSA9PiB7XG5cdFx0Y29uc3QgbG9nVGltZSA9IHBlcmZvcm1hbmNlLm5vdygpXG5cdFx0Y29uc3Qgc3RhcnRUaW1lID0gdGltZXJzW2xhYmVsXVxuXHRcdGlmICghc3RhcnRUaW1lKVxuXHRcdFx0cmV0dXJuIGNvbnNvbGUud2FybihgVGltZXIgJHtsYWJlbH0gZG9lc24ndCBleGlzdC5gLCB0aW1lcnMpXG5cdFx0dGltZXN0YW1wZWRMZXZlbGVkTG9nKCd0aW1lcicsIFtgJHtsYWJlbH06ICR7KGxvZ1RpbWUgLSBzdGFydFRpbWUpLnRvTG9jYWxlU3RyaW5nKHVuZGVmaW5lZCwgeyBtYXhpbXVtRnJhY3Rpb25EaWdpdHM6IDAgfSl9bXNgLCAuLi5kYXRhXSlcblx0fVxuXHRnbG9iYWxUaGlzLmNvbnNvbGUudGltZUVuZCA9IChsYWJlbCA9ICdkZWZhdWx0JykgPT4ge1xuXHRcdGNvbnN0IGVuZFRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKVxuXHRcdGNvbnN0IHN0YXJ0VGltZSA9IHRpbWVyc1tsYWJlbF1cblx0XHRpZiAoIXN0YXJ0VGltZSlcblx0XHRcdHJldHVybiBjb25zb2xlLndhcm4oYFRpbWVyICR7bGFiZWx9IGRvZXNuJ3QgZXhpc3QuYCwgdGltZXJzKVxuXHRcdHRpbWVzdGFtcGVkTGV2ZWxlZExvZygndGltZXInLCBbYCR7bGFiZWx9OiAkeyhlbmRUaW1lIC0gc3RhcnRUaW1lKS50b0xvY2FsZVN0cmluZyh1bmRlZmluZWQsIHsgbWF4aW11bUZyYWN0aW9uRGlnaXRzOiAwIH0pfW1zIC0gdGltZXIgZW5kZWRgXSlcblx0XHRkZWxldGUgdGltZXJzW2xhYmVsXVxuXHR9XG59XG5cbmZ1bmN0aW9uIGdldEZpbGVMb2dnZXIoKSB7XG5cdGlmIChmaWxlTG9nZ2VyKSByZXR1cm4gZmlsZUxvZ2dlclxuXG5cdGNvbnN0IG5hbWUgPSBEZW5vLm1haW5Nb2R1bGUucmVwbGFjZSgvLipcXC8oW15cXFxcXSspXFwudHMkLywgJyQxJylcblx0dHJ5IHsgRGVuby5zdGF0U3luYygnLi9sb2dzLycpIH0gY2F0Y2ggeyBEZW5vLm1rZGlyU3luYygnLi9sb2dzLycpIH1cblx0ZmlsZUxvZ2dlciA9IERlbm8uY3JlYXRlU3luYyhgLi9sb2dzLyR7bmFtZX0tJHtkdC5mb3JtYXQobmV3IERhdGUsICd5eXl5TU1kZC1ISG1tc3MnKX0ubG9nYClcblx0cmV0dXJuIGZpbGVMb2dnZXJcbn1cblxuZnVuY3Rpb24gdGltZXN0YW1wZWRMZXZlbGVkTG9nIChsZXZlbDogTG9nTGV2ZWwsIGRhdGE6IGFueVtdKSB7XG5cdC8vIGNvdW50ICclYycgaW4gYSBzdHJpbmcgYnV0IGlnbm9yZSAnJSVjJ1xuXHRjb25zdCBmaW5kQ29sb3JTcGVjaWZpZXJzID0gKHM6IHN0cmluZykgPT4ge1xuXHRcdGNvbnN0IHIgPSBbXVxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgcy5sZW5ndGggLSAxOyArK2kpIHtcblx0XHRcdGlmIChzW2ldID09PSAnJScgJiYgc1tpICsgMV0gPT09ICdjJyAmJiAoaSA9PT0gMCB8fCBzW2kgLSAxXSAhPT0gJyUnKSlcblx0XHRcdFx0ci5wdXNoKGkpXG5cdFx0fVxuXHRcdHJldHVybiByXG5cdH1cblxuXHRjb25zdCByZW1vdmVDb2xvclNwZWNpZmllcnMgPSAoczogc3RyaW5nLCByZW1vdmVMaW1pdDogbnVtYmVyKSA9PiB7XG5cdFx0Y29uc3QgY3MgPSBmaW5kQ29sb3JTcGVjaWZpZXJzKHMpLnNsaWNlKDAsIHJlbW92ZUxpbWl0KVxuXHRcdGxldCByID0gJydcblx0XHRsZXQgcCA9IDBcblx0XHRmb3IgKGNvbnN0IGMgb2YgY3MpIHtcblx0XHRcdHIgKz0gcy5zbGljZShwLCBjKVxuXHRcdFx0cCA9IGMgKyAyXG5cdFx0fVxuXHRcdHIgKz0gcy5zbGljZShwKVxuXHRcdHJldHVybiByXG5cdH1cblxuXHRjb25zdCBicmVha0RhdGFUb0NvbG9yZWRMaW5lcyA9IChkYXRhOiBhbnlbXSkgPT4ge1xuXHRcdGNvbnN0IGZvcm1hdFBhcmFtcyA9IChkYXRhOiBhbnlbXSkgPT4ge1xuXHRcdFx0Y29uc3QgcmVjb3JkcyA9IFtdXG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGRhdGEubGVuZ3RoOyArK2kpXG5cdFx0XHRcdHJlY29yZHMucHVzaCgodHlwZW9mIGRhdGFbaV0gPT09ICdzdHJpbmcnKSA/IGRhdGFbaV0gOiBEZW5vLmluc3BlY3QoZGF0YVtpXSkpXG5cdFx0XHRyZXR1cm4gcmVjb3Jkcy5qb2luKCcgJylcblx0XHR9XG5cblx0XHRpZiAoZGF0YS5sZW5ndGggPT09IDApIGRhdGEgPSBbJyddXG5cdFx0bGV0IGZpID0gMVxuXHRcdGNvbnN0IGNsczoge2w6IHN0cmluZywgY29sb3JzOiBzdHJpbmdbXX1bXSA9IFtdXG5cdFx0aWYgKHR5cGVvZiBkYXRhWzBdID09PSAnc3RyaW5nJykge1xuXHRcdFx0Y29uc3QgbGluZXMgPSBkYXRhWzBdLnNwbGl0KCdcXG4nKVxuXHRcdFx0Zm9yIChjb25zdCBsIG9mIGxpbmVzKSB7XG5cdFx0XHRcdGNvbnN0IGMgPSBmaW5kQ29sb3JTcGVjaWZpZXJzKGwpLmxlbmd0aFxuXHRcdFx0XHRjbHMucHVzaCh7bCwgY29sb3JzOiBkYXRhLnNsaWNlKGZpLCBmaSArIGMpfSlcblx0XHRcdFx0ZmkgKz0gY1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRjbHMucHVzaCguLi5mb3JtYXRQYXJhbXMoW2RhdGFbMF1dKS5zcGxpdCgnXFxuJykubWFwKGwgPT4gKHtsLCBjb2xvcnM6IFtdfSkpKVxuXHRcdH1cblx0XG5cdFx0aWYgKGZpIDwgZGF0YS5sZW5ndGgpIHtcblx0XHRcdGNvbnN0IHJlbWFpbmluZ0xpbmVzID0gZm9ybWF0UGFyYW1zKGRhdGEuc2xpY2UoZmkpKS5zcGxpdCgnXFxuJylcblx0XHRcdGNsc1tjbHMubGVuZ3RoIC0gMV0ubCArPSAnICcrIHJlbWFpbmluZ0xpbmVzLnNoaWZ0KClcblx0XHRcdGZvciAoY29uc3QgbCBvZiByZW1haW5pbmdMaW5lcykge1xuXHRcdFx0XHRjbHMucHVzaCh7IGwsIGNvbG9yczogW10gfSlcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gY2xzXG5cdH1cblxuXHRjb25zdCBjb21wdXRlTG9nTGluZXMgPSAobGluZXM6IHtsOiBzdHJpbmcsIGNvbG9yczogc3RyaW5nW119W10sIGNmZzogTG9nQ29uZmlnKSA9PiB7XG5cdFx0Y29uc3Qgc2tpcFByZWZpeCA9IGRhdGEubGVuZ3RoID09PSAwICYmIGNmZy5wcmVmaXhFbXB0eUxpbmVzID09PSBmYWxzZVxuXHRcdGNvbnN0IGRhdGVTdHIgPSBkdC5mb3JtYXQobmV3IERhdGUoKSwgY2ZnLnRpbWVGb3JtYXQpXG5cdFx0Y29uc3QgYWxpZ25GdW5jcyA9IHtcblx0XHRcdGxlZnQ6IChzOiBzdHJpbmcpID0+IHMucGFkRW5kKDUsICcgJyksXG5cdFx0XHRyaWdodDogKHM6IHN0cmluZykgPT4gcy5wYWRTdGFydCg1LCAnICcpLFxuXHRcdFx0bm9uZTogKHM6IHN0cmluZykgPT4gc1xuXHRcdH1cblx0XHRjb25zdCBsZXZlbFN0ciA9IGFsaWduRnVuY3NbY2ZnLmxldmVsQWxpZ25tZW50XShsZXZlbClcblx0XHRjb25zdCBpbmRlbnQgPSAnICcucmVwZWF0KGN1cnJlbnRJbmRlbnQgKiBjZmcuaW5kZW50U2l6ZSlcblx0XHRjb25zdCBsZXZlbENvbG9yID0gYGNvbG9yOiR7Y2ZnLmNvbG9yc1tsZXZlbF19YFxuXHRcdGxldCBjdXJyZW50VXNlckNvbG9yRm9ybWF0ID0gbGV2ZWxDb2xvclxuXHRcdGNvbnN0IGxvZ3MgPSBbXVxuXHRcdGNvbnN0IGNvbG9ycyA9IFtdXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBsaW5lcy5sZW5ndGg7ICsraSkge1xuXHRcdFx0Y29uc3QgbCA9IGxpbmVzW2ldXG5cdFx0XHRjb25zdCBjb25uZWN0b3IgPSBsaW5lcy5sZW5ndGggPT09IDEgPyAn4pSAJyA6IChpID09PSAwID8gJ+KUrCcgOiBpID09PSBsaW5lcy5sZW5ndGggLSAxID8gJ+KUlCcgOiAn4pScJylcblx0XHRcdGlmIChza2lwUHJlZml4KSB7XG5cdFx0XHRcdGxvZ3MucHVzaChsLmwpXG5cdFx0XHRcdGNvbG9ycy5wdXNoKC4uLmwuY29sb3JzKVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3QgcHJlZml4ID0gY2ZnLnByZWZpeEZvcm1hdFxuXHRcdFx0XHRcdC5yZXBsYWNlQWxsKCd7VH0nLCBkYXRlU3RyKVxuXHRcdFx0XHRcdC5yZXBsYWNlQWxsKCd7bH0nLCBsZXZlbFN0cilcblx0XHRcdFx0XHQucmVwbGFjZUFsbCgne0x9JywgbGV2ZWxTdHIudG9VcHBlckNhc2UoKSlcblx0XHRcdFx0XHQucmVwbGFjZUFsbCgne0N9JywgY29ubmVjdG9yKVxuXHRcdFx0XHRsb2dzLnB1c2goYCVjJHtwcmVmaXh9JWMke2luZGVudH1gICsgbC5sKVxuXHRcdFx0XHRjb2xvcnMucHVzaChsZXZlbENvbG9yLCBjdXJyZW50VXNlckNvbG9yRm9ybWF0LCAuLi5sLmNvbG9ycylcblx0XHRcdH1cblx0XHRcdGlmIChsLmNvbG9ycy5sZW5ndGggPiAwKSBjdXJyZW50VXNlckNvbG9yRm9ybWF0ID0gbC5jb2xvcnNbbC5jb2xvcnMubGVuZ3RoIC0gMV1cblx0XHR9XG5cdFx0cmV0dXJuIHtsb2dzLCBjb2xvcnN9XG5cdH1cblxuXHRjb25zdCBvdXRwdXRUb0NvbnNvbGUgPSBjb25zb2xlQ29uZmlnLmVuYWJsZWRMZXZlbHMuaW5jbHVkZXMobGV2ZWwpXG5cdGNvbnN0IG91dHB1dFRvRmlsZSA9IGZpbGVDb25maWcuZW5hYmxlZExldmVscy5pbmNsdWRlcyhsZXZlbClcblx0aWYgKCFvdXRwdXRUb0NvbnNvbGUgJiYgIW91dHB1dFRvRmlsZSkgcmV0dXJuXG5cblx0Y29uc3QgbGluZXMgPSBicmVha0RhdGFUb0NvbG9yZWRMaW5lcyhkYXRhKVxuXHRcblx0aWYgKG91dHB1dFRvQ29uc29sZSkge1xuXHRcdGNvbnN0IHtsb2dzLCBjb2xvcnN9ID0gY29tcHV0ZUxvZ0xpbmVzKGxpbmVzLCBjb25zb2xlQ29uZmlnKVxuXHRcdHJhd0NvbnNvbGVbbGV2ZWwgPT09ICd0aW1lcicgfHwgbGV2ZWwgPT09ICdmdW5jJz8gJ2xvZycgOiBsZXZlbF0obG9ncy5qb2luKCdcXG4nKSwgLi4uY29sb3JzKVxuXHR9XG5cblx0aWYgKG91dHB1dFRvRmlsZSkge1xuXHRcdGNvbnN0IHtsb2dzLCBjb2xvcnN9ID0gY29tcHV0ZUxvZ0xpbmVzKGxpbmVzLCBmaWxlQ29uZmlnKVxuXHRcdGNvbnN0IGZpbGUgPSBnZXRGaWxlTG9nZ2VyKClcblx0XHRmaWxlLndyaXRlKG5ldyBUZXh0RW5jb2RlcigpLmVuY29kZShyZW1vdmVDb2xvclNwZWNpZmllcnMobG9ncy5qb2luKCdcXG4nKSwgY29sb3JzLmxlbmd0aCkgKyAnXFxuJykpXG5cdH1cbn1cblxuLyoqIFNldCBsb2cgY29uZmlnXG4gKiBAcGFyYW0gY29uZmlnIG5ldyBjb25maWdcbiAqIEBwYXJhbSBhcHBseVRvIGZpbGUgb3IgY29uc29sZSBvciBhbGxcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNldENvbmZpZyhjb25maWc6IFBhcnRpYWw8TG9nQ29uZmlnPiwgYXBwbHlUbzogJ2NvbnNvbGUnIHwgJ2ZpbGUnIHwgJ2FsbCcgPSAnYWxsJykge1xuXHRpZiAoYXBwbHlUbyA9PT0gJ2FsbCcgfHwgYXBwbHlUbyA9PT0gJ2NvbnNvbGUnKSBPYmplY3QuYXNzaWduKGNvbnNvbGVDb25maWcsIGNvbmZpZylcblx0aWYgKGFwcGx5VG8gPT09ICdhbGwnIHx8IGFwcGx5VG8gPT09ICdmaWxlJykgT2JqZWN0LmFzc2lnbihmaWxlQ29uZmlnLCBjb25maWcpXG59XG5cbi8qKlxuICogU2V0IGxvZyBlbmFibGVkIGxldmVscyB0byA+PSB0aGUgc3BlY2lmaWVkIGxldmVsLCBhcyB0aGUgZm9sbG93aW5nIG9yZGVyOlxuICogLSBlcnJvclxuICogLSB3YXJuXG4gKiAtIGluZm9cbiAqIC0gbG9nID0gdGltZXIgPSBmdW5jXG4gKiAtIGRlYnVnXG4gKiBAcGFyYW0gbGV2ZWwgZXhwZWN0ZWQgbG9nIGxldmVsXG4gKiBAcGFyYW0gYXBwbHlUbyBmaWxlIG9yIGNvbnNvbGUgb3IgYWxsXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzZXRMb2dMZXZlbChsZXZlbDogJ2Vycm9yJyB8ICd3YXJuJyB8ICdpbmZvJyB8ICdsb2cnIHwgJ2RlYnVnJywgYXBwbHlUbzogJ2NvbnNvbGUnIHwgJ2ZpbGUnIHwgJ2FsbCcgPSAnYWxsJykge1xuXHRjb25zdCBsZXZlbHM6IExvZ0xldmVsW10gPSBbJ2RlYnVnJywgJ2xvZycsICdmdW5jJywgJ3RpbWVyJywgJ2luZm8nLCAnd2FybicsICdlcnJvciddXG5cdGNvbnN0IGluZGV4ID0gbGV2ZWxzLmluZGV4T2YobGV2ZWwpXG5cdGNvbnN0IGVuYWJsZWRMZXZlbHMgPSBsZXZlbHMuc2xpY2UoaW5kZXgpXG5cdHNldENvbmZpZyh7ZW5hYmxlZExldmVsc30sIGFwcGx5VG8pXG59XG5cbi8qKlxuICogVGhpcyBmdW5jdGlvbiBuZWVkIHRvIGJlIGNhbGxlZCBieSBgdXNpbmdgIHN0YXRlbWVudC5cbiAqIEl0IHdpbGwgaXNzdWUgYSBsb2cgXCJ4eHggZW50ZXJzXCIgd2l0aCAnaW5mbycgbGV2ZWwgaW1tZWRpYXRlbHksIGFuZCBhIGxvZyBcbiAqIFwieHh4IGxlYXZlc1wiIHdpbGwgYmUgYXV0b21hdGljYWxseSBpc3N1ZWQgd2hlbiBjdXJyZW50IHNjb3BlIGVuZHNcbiAqIEFsbCBvdGhlciBsb2dzIGlzc3VlZCBpbiB0aGlzIHNjb3BlIHdpbGwgYmUgcHJvbW90ZWQgdXNpbmcgc3BhY2VzIGJ5IDEgaW5kZW50IGxldmVsXG4gKiBAZXhhbXBsZVxuICAqIGZ1bmN0aW9uIGluaXQoKSB7XG4gKiAgIHVzaW5nIHggPSB0cmFjZVNjb3BlKCdJbml0JylcbiAqICAgLi4uXG4gKiAgIGNvbnNvbGUubG9nKCdhbm90aGVyIGxvZyBpbnNpZGUgaW5pdCcpXG4gKiAgIC4uLlxuICogfVxuICovXG5leHBvcnQgZnVuY3Rpb24gdHJhY2VTY29wZShuYW1lOiBzdHJpbmcsIGNvbnRleHQgPSAnJywgbGVhdmVMb2cgPSBmYWxzZSwgbGV2ZWw6IExvZ0xldmVsID0gJ2luZm8nKSA6IHsgW1N5bWJvbC5kaXNwb3NlXSgpOiB2b2lkIH0ge1xuXHRjb25zdCBjb250ZXh0VGV4dCA9IGNvbnRleHQgPyBgICgke2NvbnRleHR9KWAgOiAnJ1xuXHR0aW1lc3RhbXBlZExldmVsZWRMb2cobGV2ZWwsIFtgJHtuYW1lfSBlbnRlcnMke2NvbnRleHRUZXh0fWBdKVxuXHRjdXJyZW50SW5kZW50Kytcblx0cmV0dXJuIHsgW1N5bWJvbC5kaXNwb3NlXSgpe1xuXHRcdGN1cnJlbnRJbmRlbnQtLVxuXHRcdGlmIChsZWF2ZUxvZykgdGltZXN0YW1wZWRMZXZlbGVkTG9nKGxldmVsLCBbYCR7bmFtZX0gbGVhdmVzYF0pXG5cdH19XG59XG5cbi8qKlxuICogVGhpcyBmdW5jdGlvbiBuZWVkIHRvIGJlIGNhbGxlZCBieSBgdXNpbmdgIHN0YXRlbWVudC4gXG4gKiBJdCB3aWxsIGlzc3VlIGEgbG9nIFwiJHtmdW5jTmFtZX0gY2FsbGVkXCIgd2l0aCAnZnVuYycgbGV2ZWwgaW1tZWRpYXRlbHksIGFuZCBhIGxvZ1xuICogXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0cmFjZUZ1bmN0aW9uKGFyZ3M6IElBcmd1bWVudHN8bnVsbCA9IG51bGwsIGxlYXZlTG9nID0gZmFsc2UpIDogeyBbU3ltYm9sLmRpc3Bvc2VdKCk6IHZvaWQgfSB7XG5cdGNvbnN0IGwgPSBuZXcgRXJyb3IoKS5zdGFjaz8uc3BsaXQoJ1xcbicpWzJdXG5cdGNvbnN0IG5hbWUgPSBsPy5tYXRjaCgvYXQgKC4rKSBcXCgvKT8uWzFdIHx8IGw/Lm1hdGNoKC9cXC8oW15cXC9dKykkLyk/LlsxXSB8fCAnYW5vbnltb3VzJ1xuXHRyZXR1cm4gdHJhY2VTY29wZShuYW1lLCBhcmdzID8gJ2FyZ3M6ICcgKyBKU09OLnN0cmluZ2lmeShbLi4uYXJnc10pIDogJycsIGxlYXZlTG9nLCAnZnVuYycpXG59XG5cbi8qKlxuICogR2V0IHRoZSByYXcgY29uc29sZSBvYmplY3QgaW4gY2FzZSB5b3UgbmVlZCB0byB1c2UgdGhlIG9yaWdpbmFsIGNvbnNvbGVcbiAqL1xuZXhwb3J0IGNvbnN0IHJhdyA9IHJhd0NvbnNvbGVcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSx3Q0FBd0M7QUFFeEMsWUFBWSxRQUFRLDRCQUEyQjtBQXdCL0MsU0FBUztFQUNSLE9BQU87SUFDTixjQUFjO0lBQ2QsWUFBWTtJQUNaLGdCQUFnQjtJQUNoQixlQUFlO01BQUM7TUFBUztNQUFRO01BQVE7TUFBTztNQUFTO01BQVE7S0FBUTtJQUN6RSxrQkFBa0I7SUFDbEIsWUFBWTtJQUNaLFFBQVE7TUFBQyxPQUFPO01BQU8sTUFBTTtNQUFVLEtBQUs7TUFB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
// denoCacheMetadata=3852681223863209244,11617580966240590982