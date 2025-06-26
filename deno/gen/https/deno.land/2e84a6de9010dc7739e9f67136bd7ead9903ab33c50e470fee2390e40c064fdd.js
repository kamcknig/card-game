// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { assert } from "../_util/assert.ts";
import { BytesList } from "../bytes/bytes_list.ts";
import { concat, copy } from "../bytes/mod.ts";
// MIN_READ is the minimum ArrayBuffer size passed to a read call by
// buffer.ReadFrom. As long as the Buffer has at least MIN_READ bytes beyond
// what is required to hold the contents of r, readFrom() will not grow the
// underlying buffer.
const MIN_READ = 32 * 1024;
const MAX_SIZE = 2 ** 32 - 2;
/** A variable-sized buffer of bytes with `read()` and `write()` methods.
 *
 * Buffer is almost always used with some I/O like files and sockets. It allows
 * one to buffer up a download from a socket. Buffer grows and shrinks as
 * necessary.
 *
 * Buffer is NOT the same thing as Node's Buffer. Node's Buffer was created in
 * 2009 before JavaScript had the concept of ArrayBuffers. It's simply a
 * non-standard ArrayBuffer.
 *
 * ArrayBuffer is a fixed memory allocation. Buffer is implemented on top of
 * ArrayBuffer.
 *
 * Based on [Go Buffer](https://golang.org/pkg/bytes/#Buffer). */ export class Buffer {
  #buf;
  #off = 0;
  constructor(ab){
    this.#buf = ab === undefined ? new Uint8Array(0) : new Uint8Array(ab);
  }
  /** Returns a slice holding the unread portion of the buffer.
   *
   * The slice is valid for use only until the next buffer modification (that
   * is, only until the next call to a method like `read()`, `write()`,
   * `reset()`, or `truncate()`). If `options.copy` is false the slice aliases the buffer content at
   * least until the next buffer modification, so immediate changes to the
   * slice will affect the result of future reads.
   * @param options Defaults to `{ copy: true }`
   */ bytes(options = {
    copy: true
  }) {
    if (options.copy === false) return this.#buf.subarray(this.#off);
    return this.#buf.slice(this.#off);
  }
  /** Returns whether the unread portion of the buffer is empty. */ empty() {
    return this.#buf.byteLength <= this.#off;
  }
  /** A read only number of bytes of the unread portion of the buffer. */ get length() {
    return this.#buf.byteLength - this.#off;
  }
  /** The read only capacity of the buffer's underlying byte slice, that is,
   * the total space allocated for the buffer's data. */ get capacity() {
    return this.#buf.buffer.byteLength;
  }
  /** Discards all but the first `n` unread bytes from the buffer but
   * continues to use the same allocated storage. It throws if `n` is
   * negative or greater than the length of the buffer. */ truncate(n) {
    if (n === 0) {
      this.reset();
      return;
    }
    if (n < 0 || n > this.length) {
      throw Error("bytes.Buffer: truncation out of range");
    }
    this.#reslice(this.#off + n);
  }
  reset() {
    this.#reslice(0);
    this.#off = 0;
  }
  #tryGrowByReslice(n) {
    const l = this.#buf.byteLength;
    if (n <= this.capacity - l) {
      this.#reslice(l + n);
      return l;
    }
    return -1;
  }
  #reslice(len) {
    assert(len <= this.#buf.buffer.byteLength);
    this.#buf = new Uint8Array(this.#buf.buffer, 0, len);
  }
  /** Reads the next `p.length` bytes from the buffer or until the buffer is
   * drained. Returns the number of bytes read. If the buffer has no data to
   * return, the return is EOF (`null`). */ readSync(p) {
    if (this.empty()) {
      // Buffer is empty, reset to recover space.
      this.reset();
      if (p.byteLength === 0) {
        // this edge case is tested in 'bufferReadEmptyAtEOF' test
        return 0;
      }
      return null;
    }
    const nread = copy(this.#buf.subarray(this.#off), p);
    this.#off += nread;
    return nread;
  }
  /** Reads the next `p.length` bytes from the buffer or until the buffer is
   * drained. Resolves to the number of bytes read. If the buffer has no
   * data to return, resolves to EOF (`null`).
   *
   * NOTE: This methods reads bytes synchronously; it's provided for
   * compatibility with `Reader` interfaces.
   */ read(p) {
    const rr = this.readSync(p);
    return Promise.resolve(rr);
  }
  writeSync(p) {
    const m = this.#grow(p.byteLength);
    return copy(p, this.#buf, m);
  }
  /** NOTE: This methods writes bytes synchronously; it's provided for
   * compatibility with `Writer` interface. */ write(p) {
    const n = this.writeSync(p);
    return Promise.resolve(n);
  }
  #grow(n) {
    const m = this.length;
    // If buffer is empty, reset to recover space.
    if (m === 0 && this.#off !== 0) {
      this.reset();
    }
    // Fast: Try to grow by means of a reslice.
    const i = this.#tryGrowByReslice(n);
    if (i >= 0) {
      return i;
    }
    const c = this.capacity;
    if (n <= Math.floor(c / 2) - m) {
      // We can slide things down instead of allocating a new
      // ArrayBuffer. We only need m+n <= c to slide, but
      // we instead let capacity get twice as large so we
      // don't spend all our time copying.
      copy(this.#buf.subarray(this.#off), this.#buf);
    } else if (c + n > MAX_SIZE) {
      throw new Error("The buffer cannot be grown beyond the maximum size.");
    } else {
      // Not enough space anywhere, we need to allocate.
      const buf = new Uint8Array(Math.min(2 * c + n, MAX_SIZE));
      copy(this.#buf.subarray(this.#off), buf);
      this.#buf = buf;
    }
    // Restore this.#off and len(this.#buf).
    this.#off = 0;
    this.#reslice(Math.min(m + n, MAX_SIZE));
    return m;
  }
  /** Grows the buffer's capacity, if necessary, to guarantee space for
   * another `n` bytes. After `.grow(n)`, at least `n` bytes can be written to
   * the buffer without another allocation. If `n` is negative, `.grow()` will
   * throw. If the buffer can't grow it will throw an error.
   *
   * Based on Go Lang's
   * [Buffer.Grow](https://golang.org/pkg/bytes/#Buffer.Grow). */ grow(n) {
    if (n < 0) {
      throw Error("Buffer.grow: negative count");
    }
    const m = this.#grow(n);
    this.#reslice(m);
  }
  /** Reads data from `r` until EOF (`null`) and appends it to the buffer,
   * growing the buffer as needed. It resolves to the number of bytes read.
   * If the buffer becomes too large, `.readFrom()` will reject with an error.
   *
   * Based on Go Lang's
   * [Buffer.ReadFrom](https://golang.org/pkg/bytes/#Buffer.ReadFrom). */ async readFrom(r) {
    let n = 0;
    const tmp = new Uint8Array(MIN_READ);
    while(true){
      const shouldGrow = this.capacity - this.length < MIN_READ;
      // read into tmp buffer if there's not enough room
      // otherwise read directly into the internal buffer
      const buf = shouldGrow ? tmp : new Uint8Array(this.#buf.buffer, this.length);
      const nread = await r.read(buf);
      if (nread === null) {
        return n;
      }
      // write will grow if needed
      if (shouldGrow) this.writeSync(buf.subarray(0, nread));
      else this.#reslice(this.length + nread);
      n += nread;
    }
  }
  /** Reads data from `r` until EOF (`null`) and appends it to the buffer,
   * growing the buffer as needed. It returns the number of bytes read. If the
   * buffer becomes too large, `.readFromSync()` will throw an error.
   *
   * Based on Go Lang's
   * [Buffer.ReadFrom](https://golang.org/pkg/bytes/#Buffer.ReadFrom). */ readFromSync(r) {
    let n = 0;
    const tmp = new Uint8Array(MIN_READ);
    while(true){
      const shouldGrow = this.capacity - this.length < MIN_READ;
      // read into tmp buffer if there's not enough room
      // otherwise read directly into the internal buffer
      const buf = shouldGrow ? tmp : new Uint8Array(this.#buf.buffer, this.length);
      const nread = r.readSync(buf);
      if (nread === null) {
        return n;
      }
      // write will grow if needed
      if (shouldGrow) this.writeSync(buf.subarray(0, nread));
      else this.#reslice(this.length + nread);
      n += nread;
    }
  }
}
const DEFAULT_BUF_SIZE = 4096;
const MIN_BUF_SIZE = 16;
const MAX_CONSECUTIVE_EMPTY_READS = 100;
const CR = "\r".charCodeAt(0);
const LF = "\n".charCodeAt(0);
export class BufferFullError extends Error {
  partial;
  name;
  constructor(partial){
    super("Buffer full"), this.partial = partial, this.name = "BufferFullError";
  }
}
export class PartialReadError extends Error {
  name = "PartialReadError";
  partial;
  constructor(){
    super("Encountered UnexpectedEof, data only partially read");
  }
}
/** BufReader implements buffering for a Reader object. */ export class BufReader {
  #buf;
  #rd;
  #r = 0;
  #w = 0;
  #eof = false;
  // private lastByte: number;
  // private lastCharSize: number;
  /** return new BufReader unless r is BufReader */ static create(r, size = DEFAULT_BUF_SIZE) {
    return r instanceof BufReader ? r : new BufReader(r, size);
  }
  constructor(rd, size = DEFAULT_BUF_SIZE){
    if (size < MIN_BUF_SIZE) {
      size = MIN_BUF_SIZE;
    }
    this.#reset(new Uint8Array(size), rd);
  }
  /** Returns the size of the underlying buffer in bytes. */ size() {
    return this.#buf.byteLength;
  }
  buffered() {
    return this.#w - this.#r;
  }
  // Reads a new chunk into the buffer.
  #fill = async ()=>{
    // Slide existing data to beginning.
    if (this.#r > 0) {
      this.#buf.copyWithin(0, this.#r, this.#w);
      this.#w -= this.#r;
      this.#r = 0;
    }
    if (this.#w >= this.#buf.byteLength) {
      throw Error("bufio: tried to fill full buffer");
    }
    // Read new data: try a limited number of times.
    for(let i = MAX_CONSECUTIVE_EMPTY_READS; i > 0; i--){
      const rr = await this.#rd.read(this.#buf.subarray(this.#w));
      if (rr === null) {
        this.#eof = true;
        return;
      }
      assert(rr >= 0, "negative read");
      this.#w += rr;
      if (rr > 0) {
        return;
      }
    }
    throw new Error(`No progress after ${MAX_CONSECUTIVE_EMPTY_READS} read() calls`);
  };
  /** Discards any buffered data, resets all state, and switches
   * the buffered reader to read from r.
   */ reset(r) {
    this.#reset(this.#buf, r);
  }
  #reset = (buf, rd)=>{
    this.#buf = buf;
    this.#rd = rd;
    this.#eof = false;
  // this.lastByte = -1;
  // this.lastCharSize = -1;
  };
  /** reads data into p.
   * It returns the number of bytes read into p.
   * The bytes are taken from at most one Read on the underlying Reader,
   * hence n may be less than len(p).
   * To read exactly len(p) bytes, use io.ReadFull(b, p).
   */ async read(p) {
    let rr = p.byteLength;
    if (p.byteLength === 0) return rr;
    if (this.#r === this.#w) {
      if (p.byteLength >= this.#buf.byteLength) {
        // Large read, empty buffer.
        // Read directly into p to avoid copy.
        const rr = await this.#rd.read(p);
        const nread = rr ?? 0;
        assert(nread >= 0, "negative read");
        // if (rr.nread > 0) {
        //   this.lastByte = p[rr.nread - 1];
        //   this.lastCharSize = -1;
        // }
        return rr;
      }
      // One read.
      // Do not use this.fill, which will loop.
      this.#r = 0;
      this.#w = 0;
      rr = await this.#rd.read(this.#buf);
      if (rr === 0 || rr === null) return rr;
      assert(rr >= 0, "negative read");
      this.#w += rr;
    }
    // copy as much as we can
    const copied = copy(this.#buf.subarray(this.#r, this.#w), p, 0);
    this.#r += copied;
    // this.lastByte = this.buf[this.r - 1];
    // this.lastCharSize = -1;
    return copied;
  }
  /** reads exactly `p.length` bytes into `p`.
   *
   * If successful, `p` is returned.
   *
   * If the end of the underlying stream has been reached, and there are no more
   * bytes available in the buffer, `readFull()` returns `null` instead.
   *
   * An error is thrown if some bytes could be read, but not enough to fill `p`
   * entirely before the underlying stream reported an error or EOF. Any error
   * thrown will have a `partial` property that indicates the slice of the
   * buffer that has been successfully filled with data.
   *
   * Ported from https://golang.org/pkg/io/#ReadFull
   */ async readFull(p) {
    let bytesRead = 0;
    while(bytesRead < p.length){
      try {
        const rr = await this.read(p.subarray(bytesRead));
        if (rr === null) {
          if (bytesRead === 0) {
            return null;
          } else {
            throw new PartialReadError();
          }
        }
        bytesRead += rr;
      } catch (err) {
        if (err instanceof PartialReadError) {
          err.partial = p.subarray(0, bytesRead);
        } else if (err instanceof Error) {
          const e = new PartialReadError();
          e.partial = p.subarray(0, bytesRead);
          e.stack = err.stack;
          e.message = err.message;
          e.cause = err.cause;
          throw err;
        }
        throw err;
      }
    }
    return p;
  }
  /** Returns the next byte [0, 255] or `null`. */ async readByte() {
    while(this.#r === this.#w){
      if (this.#eof) return null;
      await this.#fill(); // buffer is empty.
    }
    const c = this.#buf[this.#r];
    this.#r++;
    // this.lastByte = c;
    return c;
  }
  /** readString() reads until the first occurrence of delim in the input,
   * returning a string containing the data up to and including the delimiter.
   * If ReadString encounters an error before finding a delimiter,
   * it returns the data read before the error and the error itself
   * (often `null`).
   * ReadString returns err != nil if and only if the returned data does not end
   * in delim.
   * For simple uses, a Scanner may be more convenient.
   */ async readString(delim) {
    if (delim.length !== 1) {
      throw new Error("Delimiter should be a single character");
    }
    const buffer = await this.readSlice(delim.charCodeAt(0));
    if (buffer === null) return null;
    return new TextDecoder().decode(buffer);
  }
  /** `readLine()` is a low-level line-reading primitive. Most callers should
   * use `readString('\n')` instead or use a Scanner.
   *
   * `readLine()` tries to return a single line, not including the end-of-line
   * bytes. If the line was too long for the buffer then `more` is set and the
   * beginning of the line is returned. The rest of the line will be returned
   * from future calls. `more` will be false when returning the last fragment
   * of the line. The returned buffer is only valid until the next call to
   * `readLine()`.
   *
   * The text returned from ReadLine does not include the line end ("\r\n" or
   * "\n").
   *
   * When the end of the underlying stream is reached, the final bytes in the
   * stream are returned. No indication or error is given if the input ends
   * without a final line end. When there are no more trailing bytes to read,
   * `readLine()` returns `null`.
   *
   * Calling `unreadByte()` after `readLine()` will always unread the last byte
   * read (possibly a character belonging to the line end) even if that byte is
   * not part of the line returned by `readLine()`.
   */ async readLine() {
    let line = null;
    try {
      line = await this.readSlice(LF);
    } catch (err) {
      let partial;
      if (err instanceof PartialReadError) {
        partial = err.partial;
        assert(partial instanceof Uint8Array, "bufio: caught error from `readSlice()` without `partial` property");
      }
      // Don't throw if `readSlice()` failed with `BufferFullError`, instead we
      // just return whatever is available and set the `more` flag.
      if (!(err instanceof BufferFullError)) {
        throw err;
      }
      partial = err.partial;
      // Handle the case where "\r\n" straddles the buffer.
      if (!this.#eof && partial && partial.byteLength > 0 && partial[partial.byteLength - 1] === CR) {
        // Put the '\r' back on buf and drop it from line.
        // Let the next call to ReadLine check for "\r\n".
        assert(this.#r > 0, "bufio: tried to rewind past start of buffer");
        this.#r--;
        partial = partial.subarray(0, partial.byteLength - 1);
      }
      if (partial) {
        return {
          line: partial,
          more: !this.#eof
        };
      }
    }
    if (line === null) {
      return null;
    }
    if (line.byteLength === 0) {
      return {
        line,
        more: false
      };
    }
    if (line[line.byteLength - 1] == LF) {
      let drop = 1;
      if (line.byteLength > 1 && line[line.byteLength - 2] === CR) {
        drop = 2;
      }
      line = line.subarray(0, line.byteLength - drop);
    }
    return {
      line,
      more: false
    };
  }
  /** `readSlice()` reads until the first occurrence of `delim` in the input,
   * returning a slice pointing at the bytes in the buffer. The bytes stop
   * being valid at the next read.
   *
   * If `readSlice()` encounters an error before finding a delimiter, or the
   * buffer fills without finding a delimiter, it throws an error with a
   * `partial` property that contains the entire buffer.
   *
   * If `readSlice()` encounters the end of the underlying stream and there are
   * any bytes left in the buffer, the rest of the buffer is returned. In other
   * words, EOF is always treated as a delimiter. Once the buffer is empty,
   * it returns `null`.
   *
   * Because the data returned from `readSlice()` will be overwritten by the
   * next I/O operation, most clients should use `readString()` instead.
   */ async readSlice(delim) {
    let s = 0; // search start index
    let slice;
    while(true){
      // Search buffer.
      let i = this.#buf.subarray(this.#r + s, this.#w).indexOf(delim);
      if (i >= 0) {
        i += s;
        slice = this.#buf.subarray(this.#r, this.#r + i + 1);
        this.#r += i + 1;
        break;
      }
      // EOF?
      if (this.#eof) {
        if (this.#r === this.#w) {
          return null;
        }
        slice = this.#buf.subarray(this.#r, this.#w);
        this.#r = this.#w;
        break;
      }
      // Buffer full?
      if (this.buffered() >= this.#buf.byteLength) {
        this.#r = this.#w;
        // #4521 The internal buffer should not be reused across reads because it causes corruption of data.
        const oldbuf = this.#buf;
        const newbuf = this.#buf.slice(0);
        this.#buf = newbuf;
        throw new BufferFullError(oldbuf);
      }
      s = this.#w - this.#r; // do not rescan area we scanned before
      // Buffer is not full.
      try {
        await this.#fill();
      } catch (err) {
        if (err instanceof PartialReadError) {
          err.partial = slice;
        } else if (err instanceof Error) {
          const e = new PartialReadError();
          e.partial = slice;
          e.stack = err.stack;
          e.message = err.message;
          e.cause = err.cause;
          throw err;
        }
        throw err;
      }
    }
    // Handle last byte, if any.
    // const i = slice.byteLength - 1;
    // if (i >= 0) {
    //   this.lastByte = slice[i];
    //   this.lastCharSize = -1
    // }
    return slice;
  }
  /** `peek()` returns the next `n` bytes without advancing the reader. The
   * bytes stop being valid at the next read call.
   *
   * When the end of the underlying stream is reached, but there are unread
   * bytes left in the buffer, those bytes are returned. If there are no bytes
   * left in the buffer, it returns `null`.
   *
   * If an error is encountered before `n` bytes are available, `peek()` throws
   * an error with the `partial` property set to a slice of the buffer that
   * contains the bytes that were available before the error occurred.
   */ async peek(n) {
    if (n < 0) {
      throw Error("negative count");
    }
    let avail = this.#w - this.#r;
    while(avail < n && avail < this.#buf.byteLength && !this.#eof){
      try {
        await this.#fill();
      } catch (err) {
        if (err instanceof PartialReadError) {
          err.partial = this.#buf.subarray(this.#r, this.#w);
        } else if (err instanceof Error) {
          const e = new PartialReadError();
          e.partial = this.#buf.subarray(this.#r, this.#w);
          e.stack = err.stack;
          e.message = err.message;
          e.cause = err.cause;
          throw err;
        }
        throw err;
      }
      avail = this.#w - this.#r;
    }
    if (avail === 0 && this.#eof) {
      return null;
    } else if (avail < n && this.#eof) {
      return this.#buf.subarray(this.#r, this.#r + avail);
    } else if (avail < n) {
      throw new BufferFullError(this.#buf.subarray(this.#r, this.#w));
    }
    return this.#buf.subarray(this.#r, this.#r + n);
  }
}
class AbstractBufBase {
  buf;
  usedBufferBytes = 0;
  err = null;
  constructor(buf){
    this.buf = buf;
  }
  /** Size returns the size of the underlying buffer in bytes. */ size() {
    return this.buf.byteLength;
  }
  /** Returns how many bytes are unused in the buffer. */ available() {
    return this.buf.byteLength - this.usedBufferBytes;
  }
  /** buffered returns the number of bytes that have been written into the
   * current buffer.
   */ buffered() {
    return this.usedBufferBytes;
  }
}
/** BufWriter implements buffering for an deno.Writer object.
 * If an error occurs writing to a Writer, no more data will be
 * accepted and all subsequent writes, and flush(), will return the error.
 * After all data has been written, the client should call the
 * flush() method to guarantee all data has been forwarded to
 * the underlying deno.Writer.
 */ export class BufWriter extends AbstractBufBase {
  #writer;
  /** return new BufWriter unless writer is BufWriter */ static create(writer, size = DEFAULT_BUF_SIZE) {
    return writer instanceof BufWriter ? writer : new BufWriter(writer, size);
  }
  constructor(writer, size = DEFAULT_BUF_SIZE){
    super(new Uint8Array(size <= 0 ? DEFAULT_BUF_SIZE : size));
    this.#writer = writer;
  }
  /** Discards any unflushed buffered data, clears any error, and
   * resets buffer to write its output to w.
   */ reset(w) {
    this.err = null;
    this.usedBufferBytes = 0;
    this.#writer = w;
  }
  /** Flush writes any buffered data to the underlying io.Writer. */ async flush() {
    if (this.err !== null) throw this.err;
    if (this.usedBufferBytes === 0) return;
    try {
      const p = this.buf.subarray(0, this.usedBufferBytes);
      let nwritten = 0;
      while(nwritten < p.length){
        nwritten += await this.#writer.write(p.subarray(nwritten));
      }
    } catch (e) {
      if (e instanceof Error) {
        this.err = e;
      }
      throw e;
    }
    this.buf = new Uint8Array(this.buf.length);
    this.usedBufferBytes = 0;
  }
  /** Writes the contents of `data` into the buffer.  If the contents won't fully
   * fit into the buffer, those bytes that can are copied into the buffer, the
   * buffer is the flushed to the writer and the remaining bytes are copied into
   * the now empty buffer.
   *
   * @return the number of bytes written to the buffer.
   */ async write(data) {
    if (this.err !== null) throw this.err;
    if (data.length === 0) return 0;
    let totalBytesWritten = 0;
    let numBytesWritten = 0;
    while(data.byteLength > this.available()){
      if (this.buffered() === 0) {
        // Large write, empty buffer.
        // Write directly from data to avoid copy.
        try {
          numBytesWritten = await this.#writer.write(data);
        } catch (e) {
          if (e instanceof Error) {
            this.err = e;
          }
          throw e;
        }
      } else {
        numBytesWritten = copy(data, this.buf, this.usedBufferBytes);
        this.usedBufferBytes += numBytesWritten;
        await this.flush();
      }
      totalBytesWritten += numBytesWritten;
      data = data.subarray(numBytesWritten);
    }
    numBytesWritten = copy(data, this.buf, this.usedBufferBytes);
    this.usedBufferBytes += numBytesWritten;
    totalBytesWritten += numBytesWritten;
    return totalBytesWritten;
  }
}
/** BufWriterSync implements buffering for a deno.WriterSync object.
 * If an error occurs writing to a WriterSync, no more data will be
 * accepted and all subsequent writes, and flush(), will return the error.
 * After all data has been written, the client should call the
 * flush() method to guarantee all data has been forwarded to
 * the underlying deno.WriterSync.
 */ export class BufWriterSync extends AbstractBufBase {
  #writer;
  /** return new BufWriterSync unless writer is BufWriterSync */ static create(writer, size = DEFAULT_BUF_SIZE) {
    return writer instanceof BufWriterSync ? writer : new BufWriterSync(writer, size);
  }
  constructor(writer, size = DEFAULT_BUF_SIZE){
    super(new Uint8Array(size <= 0 ? DEFAULT_BUF_SIZE : size));
    this.#writer = writer;
  }
  /** Discards any unflushed buffered data, clears any error, and
   * resets buffer to write its output to w.
   */ reset(w) {
    this.err = null;
    this.usedBufferBytes = 0;
    this.#writer = w;
  }
  /** Flush writes any buffered data to the underlying io.WriterSync. */ flush() {
    if (this.err !== null) throw this.err;
    if (this.usedBufferBytes === 0) return;
    try {
      const p = this.buf.subarray(0, this.usedBufferBytes);
      let nwritten = 0;
      while(nwritten < p.length){
        nwritten += this.#writer.writeSync(p.subarray(nwritten));
      }
    } catch (e) {
      if (e instanceof Error) {
        this.err = e;
      }
      throw e;
    }
    this.buf = new Uint8Array(this.buf.length);
    this.usedBufferBytes = 0;
  }
  /** Writes the contents of `data` into the buffer.  If the contents won't fully
   * fit into the buffer, those bytes that can are copied into the buffer, the
   * buffer is the flushed to the writer and the remaining bytes are copied into
   * the now empty buffer.
   *
   * @return the number of bytes written to the buffer.
   */ writeSync(data) {
    if (this.err !== null) throw this.err;
    if (data.length === 0) return 0;
    let totalBytesWritten = 0;
    let numBytesWritten = 0;
    while(data.byteLength > this.available()){
      if (this.buffered() === 0) {
        // Large write, empty buffer.
        // Write directly from data to avoid copy.
        try {
          numBytesWritten = this.#writer.writeSync(data);
        } catch (e) {
          if (e instanceof Error) {
            this.err = e;
          }
          throw e;
        }
      } else {
        numBytesWritten = copy(data, this.buf, this.usedBufferBytes);
        this.usedBufferBytes += numBytesWritten;
        this.flush();
      }
      totalBytesWritten += numBytesWritten;
      data = data.subarray(numBytesWritten);
    }
    numBytesWritten = copy(data, this.buf, this.usedBufferBytes);
    this.usedBufferBytes += numBytesWritten;
    totalBytesWritten += numBytesWritten;
    return totalBytesWritten;
  }
}
/** Generate longest proper prefix which is also suffix array. */ function createLPS(pat) {
  const lps = new Uint8Array(pat.length);
  lps[0] = 0;
  let prefixEnd = 0;
  let i = 1;
  while(i < lps.length){
    if (pat[i] == pat[prefixEnd]) {
      prefixEnd++;
      lps[i] = prefixEnd;
      i++;
    } else if (prefixEnd === 0) {
      lps[i] = 0;
      i++;
    } else {
      prefixEnd = lps[prefixEnd - 1];
    }
  }
  return lps;
}
/** Read delimited bytes from a Reader. */ export async function* readDelim(reader, delim) {
  // Avoid unicode problems
  const delimLen = delim.length;
  const delimLPS = createLPS(delim);
  const chunks = new BytesList();
  const bufSize = Math.max(1024, delimLen + 1);
  // Modified KMP
  let inspectIndex = 0;
  let matchIndex = 0;
  while(true){
    const inspectArr = new Uint8Array(bufSize);
    const result = await reader.read(inspectArr);
    if (result === null) {
      // Yield last chunk.
      yield chunks.concat();
      return;
    } else if (result < 0) {
      // Discard all remaining and silently fail.
      return;
    }
    chunks.add(inspectArr, 0, result);
    let localIndex = 0;
    while(inspectIndex < chunks.size()){
      if (inspectArr[localIndex] === delim[matchIndex]) {
        inspectIndex++;
        localIndex++;
        matchIndex++;
        if (matchIndex === delimLen) {
          // Full match
          const matchEnd = inspectIndex - delimLen;
          const readyBytes = chunks.slice(0, matchEnd);
          yield readyBytes;
          // Reset match, different from KMP.
          chunks.shift(inspectIndex);
          inspectIndex = 0;
          matchIndex = 0;
        }
      } else {
        if (matchIndex === 0) {
          inspectIndex++;
          localIndex++;
        } else {
          matchIndex = delimLPS[matchIndex - 1];
        }
      }
    }
  }
}
/** Read delimited strings from a Reader. */ export async function* readStringDelim(reader, delim, decoderOpts) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder(decoderOpts?.encoding, decoderOpts);
  for await (const chunk of readDelim(reader, encoder.encode(delim))){
    yield decoder.decode(chunk);
  }
}
/** Read strings line-by-line from a Reader. */ export async function* readLines(reader, decoderOpts) {
  const bufReader = new BufReader(reader);
  let chunks = [];
  const decoder = new TextDecoder(decoderOpts?.encoding, decoderOpts);
  while(true){
    const res = await bufReader.readLine();
    if (!res) {
      if (chunks.length > 0) {
        yield decoder.decode(concat(...chunks));
      }
      break;
    }
    chunks.push(res.line);
    if (!res.more) {
      yield decoder.decode(concat(...chunks));
      chunks = [];
    }
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE1OC4wL2lvL2J1ZmZlci50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuaW1wb3J0IHsgYXNzZXJ0IH0gZnJvbSBcIi4uL191dGlsL2Fzc2VydC50c1wiO1xuaW1wb3J0IHsgQnl0ZXNMaXN0IH0gZnJvbSBcIi4uL2J5dGVzL2J5dGVzX2xpc3QudHNcIjtcbmltcG9ydCB7IGNvbmNhdCwgY29weSB9IGZyb20gXCIuLi9ieXRlcy9tb2QudHNcIjtcbmltcG9ydCB0eXBlIHsgUmVhZGVyLCBSZWFkZXJTeW5jLCBXcml0ZXIsIFdyaXRlclN5bmMgfSBmcm9tIFwiLi90eXBlcy5kLnRzXCI7XG5cbi8vIE1JTl9SRUFEIGlzIHRoZSBtaW5pbXVtIEFycmF5QnVmZmVyIHNpemUgcGFzc2VkIHRvIGEgcmVhZCBjYWxsIGJ5XG4vLyBidWZmZXIuUmVhZEZyb20uIEFzIGxvbmcgYXMgdGhlIEJ1ZmZlciBoYXMgYXQgbGVhc3QgTUlOX1JFQUQgYnl0ZXMgYmV5b25kXG4vLyB3aGF0IGlzIHJlcXVpcmVkIHRvIGhvbGQgdGhlIGNvbnRlbnRzIG9mIHIsIHJlYWRGcm9tKCkgd2lsbCBub3QgZ3JvdyB0aGVcbi8vIHVuZGVybHlpbmcgYnVmZmVyLlxuY29uc3QgTUlOX1JFQUQgPSAzMiAqIDEwMjQ7XG5jb25zdCBNQVhfU0laRSA9IDIgKiogMzIgLSAyO1xuXG4vKiogQSB2YXJpYWJsZS1zaXplZCBidWZmZXIgb2YgYnl0ZXMgd2l0aCBgcmVhZCgpYCBhbmQgYHdyaXRlKClgIG1ldGhvZHMuXG4gKlxuICogQnVmZmVyIGlzIGFsbW9zdCBhbHdheXMgdXNlZCB3aXRoIHNvbWUgSS9PIGxpa2UgZmlsZXMgYW5kIHNvY2tldHMuIEl0IGFsbG93c1xuICogb25lIHRvIGJ1ZmZlciB1cCBhIGRvd25sb2FkIGZyb20gYSBzb2NrZXQuIEJ1ZmZlciBncm93cyBhbmQgc2hyaW5rcyBhc1xuICogbmVjZXNzYXJ5LlxuICpcbiAqIEJ1ZmZlciBpcyBOT1QgdGhlIHNhbWUgdGhpbmcgYXMgTm9kZSdzIEJ1ZmZlci4gTm9kZSdzIEJ1ZmZlciB3YXMgY3JlYXRlZCBpblxuICogMjAwOSBiZWZvcmUgSmF2YVNjcmlwdCBoYWQgdGhlIGNvbmNlcHQgb2YgQXJyYXlCdWZmZXJzLiBJdCdzIHNpbXBseSBhXG4gKiBub24tc3RhbmRhcmQgQXJyYXlCdWZmZXIuXG4gKlxuICogQXJyYXlCdWZmZXIgaXMgYSBmaXhlZCBtZW1vcnkgYWxsb2NhdGlvbi4gQnVmZmVyIGlzIGltcGxlbWVudGVkIG9uIHRvcCBvZlxuICogQXJyYXlCdWZmZXIuXG4gKlxuICogQmFzZWQgb24gW0dvIEJ1ZmZlcl0oaHR0cHM6Ly9nb2xhbmcub3JnL3BrZy9ieXRlcy8jQnVmZmVyKS4gKi9cblxuZXhwb3J0IGNsYXNzIEJ1ZmZlciB7XG4gICNidWY6IFVpbnQ4QXJyYXk7IC8vIGNvbnRlbnRzIGFyZSB0aGUgYnl0ZXMgYnVmW29mZiA6IGxlbihidWYpXVxuICAjb2ZmID0gMDsgLy8gcmVhZCBhdCBidWZbb2ZmXSwgd3JpdGUgYXQgYnVmW2J1Zi5ieXRlTGVuZ3RoXVxuXG4gIGNvbnN0cnVjdG9yKGFiPzogQXJyYXlCdWZmZXJMaWtlIHwgQXJyYXlMaWtlPG51bWJlcj4pIHtcbiAgICB0aGlzLiNidWYgPSBhYiA9PT0gdW5kZWZpbmVkID8gbmV3IFVpbnQ4QXJyYXkoMCkgOiBuZXcgVWludDhBcnJheShhYik7XG4gIH1cblxuICAvKiogUmV0dXJucyBhIHNsaWNlIGhvbGRpbmcgdGhlIHVucmVhZCBwb3J0aW9uIG9mIHRoZSBidWZmZXIuXG4gICAqXG4gICAqIFRoZSBzbGljZSBpcyB2YWxpZCBmb3IgdXNlIG9ubHkgdW50aWwgdGhlIG5leHQgYnVmZmVyIG1vZGlmaWNhdGlvbiAodGhhdFxuICAgKiBpcywgb25seSB1bnRpbCB0aGUgbmV4dCBjYWxsIHRvIGEgbWV0aG9kIGxpa2UgYHJlYWQoKWAsIGB3cml0ZSgpYCxcbiAgICogYHJlc2V0KClgLCBvciBgdHJ1bmNhdGUoKWApLiBJZiBgb3B0aW9ucy5jb3B5YCBpcyBmYWxzZSB0aGUgc2xpY2UgYWxpYXNlcyB0aGUgYnVmZmVyIGNvbnRlbnQgYXRcbiAgICogbGVhc3QgdW50aWwgdGhlIG5leHQgYnVmZmVyIG1vZGlmaWNhdGlvbiwgc28gaW1tZWRpYXRlIGNoYW5nZXMgdG8gdGhlXG4gICAqIHNsaWNlIHdpbGwgYWZmZWN0IHRoZSByZXN1bHQgb2YgZnV0dXJlIHJlYWRzLlxuICAgKiBAcGFyYW0gb3B0aW9ucyBEZWZhdWx0cyB0byBgeyBjb3B5OiB0cnVlIH1gXG4gICAqL1xuICBieXRlcyhvcHRpb25zID0geyBjb3B5OiB0cnVlIH0pOiBVaW50OEFycmF5IHtcbiAgICBpZiAob3B0aW9ucy5jb3B5ID09PSBmYWxzZSkgcmV0dXJuIHRoaXMuI2J1Zi5zdWJhcnJheSh0aGlzLiNvZmYpO1xuICAgIHJldHVybiB0aGlzLiNidWYuc2xpY2UodGhpcy4jb2ZmKTtcbiAgfVxuXG4gIC8qKiBSZXR1cm5zIHdoZXRoZXIgdGhlIHVucmVhZCBwb3J0aW9uIG9mIHRoZSBidWZmZXIgaXMgZW1wdHkuICovXG4gIGVtcHR5KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLiNidWYuYnl0ZUxlbmd0aCA8PSB0aGlzLiNvZmY7XG4gIH1cblxuICAvKiogQSByZWFkIG9ubHkgbnVtYmVyIG9mIGJ5dGVzIG9mIHRoZSB1bnJlYWQgcG9ydGlvbiBvZiB0aGUgYnVmZmVyLiAqL1xuICBnZXQgbGVuZ3RoKCk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMuI2J1Zi5ieXRlTGVuZ3RoIC0gdGhpcy4jb2ZmO1xuICB9XG5cbiAgLyoqIFRoZSByZWFkIG9ubHkgY2FwYWNpdHkgb2YgdGhlIGJ1ZmZlcidzIHVuZGVybHlpbmcgYnl0ZSBzbGljZSwgdGhhdCBpcyxcbiAgICogdGhlIHRvdGFsIHNwYWNlIGFsbG9jYXRlZCBmb3IgdGhlIGJ1ZmZlcidzIGRhdGEuICovXG4gIGdldCBjYXBhY2l0eSgpOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLiNidWYuYnVmZmVyLmJ5dGVMZW5ndGg7XG4gIH1cblxuICAvKiogRGlzY2FyZHMgYWxsIGJ1dCB0aGUgZmlyc3QgYG5gIHVucmVhZCBieXRlcyBmcm9tIHRoZSBidWZmZXIgYnV0XG4gICAqIGNvbnRpbnVlcyB0byB1c2UgdGhlIHNhbWUgYWxsb2NhdGVkIHN0b3JhZ2UuIEl0IHRocm93cyBpZiBgbmAgaXNcbiAgICogbmVnYXRpdmUgb3IgZ3JlYXRlciB0aGFuIHRoZSBsZW5ndGggb2YgdGhlIGJ1ZmZlci4gKi9cbiAgdHJ1bmNhdGUobjogbnVtYmVyKSB7XG4gICAgaWYgKG4gPT09IDApIHtcbiAgICAgIHRoaXMucmVzZXQoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKG4gPCAwIHx8IG4gPiB0aGlzLmxlbmd0aCkge1xuICAgICAgdGhyb3cgRXJyb3IoXCJieXRlcy5CdWZmZXI6IHRydW5jYXRpb24gb3V0IG9mIHJhbmdlXCIpO1xuICAgIH1cbiAgICB0aGlzLiNyZXNsaWNlKHRoaXMuI29mZiArIG4pO1xuICB9XG5cbiAgcmVzZXQoKSB7XG4gICAgdGhpcy4jcmVzbGljZSgwKTtcbiAgICB0aGlzLiNvZmYgPSAwO1xuICB9XG5cbiAgI3RyeUdyb3dCeVJlc2xpY2UobjogbnVtYmVyKSB7XG4gICAgY29uc3QgbCA9IHRoaXMuI2J1Zi5ieXRlTGVuZ3RoO1xuICAgIGlmIChuIDw9IHRoaXMuY2FwYWNpdHkgLSBsKSB7XG4gICAgICB0aGlzLiNyZXNsaWNlKGwgKyBuKTtcbiAgICAgIHJldHVybiBsO1xuICAgIH1cbiAgICByZXR1cm4gLTE7XG4gIH1cblxuICAjcmVzbGljZShsZW46IG51bWJlcikge1xuICAgIGFzc2VydChsZW4gPD0gdGhpcy4jYnVmLmJ1ZmZlci5ieXRlTGVuZ3RoKTtcbiAgICB0aGlzLiNidWYgPSBuZXcgVWludDhBcnJheSh0aGlzLiNidWYuYnVmZmVyLCAwLCBsZW4pO1xuICB9XG5cbiAgLyoqIFJlYWRzIHRoZSBuZXh0IGBwLmxlbmd0aGAgYnl0ZXMgZnJvbSB0aGUgYnVmZmVyIG9yIHVudGlsIHRoZSBidWZmZXIgaXNcbiAgICogZHJhaW5lZC4gUmV0dXJucyB0aGUgbnVtYmVyIG9mIGJ5dGVzIHJlYWQuIElmIHRoZSBidWZmZXIgaGFzIG5vIGRhdGEgdG9cbiAgICogcmV0dXJuLCB0aGUgcmV0dXJuIGlzIEVPRiAoYG51bGxgKS4gKi9cbiAgcmVhZFN5bmMocDogVWludDhBcnJheSk6IG51bWJlciB8IG51bGwge1xuICAgIGlmICh0aGlzLmVtcHR5KCkpIHtcbiAgICAgIC8vIEJ1ZmZlciBpcyBlbXB0eSwgcmVzZXQgdG8gcmVjb3ZlciBzcGFjZS5cbiAgICAgIHRoaXMucmVzZXQoKTtcbiAgICAgIGlmIChwLmJ5dGVMZW5ndGggPT09IDApIHtcbiAgICAgICAgLy8gdGhpcyBlZGdlIGNhc2UgaXMgdGVzdGVkIGluICdidWZmZXJSZWFkRW1wdHlBdEVPRicgdGVzdFxuICAgICAgICByZXR1cm4gMDtcbiAgICAgIH1cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCBucmVhZCA9IGNvcHkodGhpcy4jYnVmLnN1YmFycmF5KHRoaXMuI29mZiksIHApO1xuICAgIHRoaXMuI29mZiArPSBucmVhZDtcbiAgICByZXR1cm4gbnJlYWQ7XG4gIH1cblxuICAvKiogUmVhZHMgdGhlIG5leHQgYHAubGVuZ3RoYCBieXRlcyBmcm9tIHRoZSBidWZmZXIgb3IgdW50aWwgdGhlIGJ1ZmZlciBpc1xuICAgKiBkcmFpbmVkLiBSZXNvbHZlcyB0byB0aGUgbnVtYmVyIG9mIGJ5dGVzIHJlYWQuIElmIHRoZSBidWZmZXIgaGFzIG5vXG4gICAqIGRhdGEgdG8gcmV0dXJuLCByZXNvbHZlcyB0byBFT0YgKGBudWxsYCkuXG4gICAqXG4gICAqIE5PVEU6IFRoaXMgbWV0aG9kcyByZWFkcyBieXRlcyBzeW5jaHJvbm91c2x5OyBpdCdzIHByb3ZpZGVkIGZvclxuICAgKiBjb21wYXRpYmlsaXR5IHdpdGggYFJlYWRlcmAgaW50ZXJmYWNlcy5cbiAgICovXG4gIHJlYWQocDogVWludDhBcnJheSk6IFByb21pc2U8bnVtYmVyIHwgbnVsbD4ge1xuICAgIGNvbnN0IHJyID0gdGhpcy5yZWFkU3luYyhwKTtcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHJyKTtcbiAgfVxuXG4gIHdyaXRlU3luYyhwOiBVaW50OEFycmF5KTogbnVtYmVyIHtcbiAgICBjb25zdCBtID0gdGhpcy4jZ3JvdyhwLmJ5dGVMZW5ndGgpO1xuICAgIHJldHVybiBjb3B5KHAsIHRoaXMuI2J1ZiwgbSk7XG4gIH1cblxuICAvKiogTk9URTogVGhpcyBtZXRob2RzIHdyaXRlcyBieXRlcyBzeW5jaHJvbm91c2x5OyBpdCdzIHByb3ZpZGVkIGZvclxuICAgKiBjb21wYXRpYmlsaXR5IHdpdGggYFdyaXRlcmAgaW50ZXJmYWNlLiAqL1xuICB3cml0ZShwOiBVaW50OEFycmF5KTogUHJvbWlzZTxudW1iZXI+IHtcbiAgICBjb25zdCBuID0gdGhpcy53cml0ZVN5bmMocCk7XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShuKTtcbiAgfVxuXG4gICNncm93KG46IG51bWJlcikge1xuICAgIGNvbnN0IG0gPSB0aGlzLmxlbmd0aDtcbiAgICAvLyBJZiBidWZmZXIgaXMgZW1wdHksIHJlc2V0IHRvIHJlY292ZXIgc3BhY2UuXG4gICAgaWYgKG0gPT09IDAgJiYgdGhpcy4jb2ZmICE9PSAwKSB7XG4gICAgICB0aGlzLnJlc2V0KCk7XG4gICAgfVxuICAgIC8vIEZhc3Q6IFRyeSB0byBncm93IGJ5IG1lYW5zIG9mIGEgcmVzbGljZS5cbiAgICBjb25zdCBpID0gdGhpcy4jdHJ5R3Jvd0J5UmVzbGljZShuKTtcbiAgICBpZiAoaSA+PSAwKSB7XG4gICAgICByZXR1cm4gaTtcbiAgICB9XG4gICAgY29uc3QgYyA9IHRoaXMuY2FwYWNpdHk7XG4gICAgaWYgKG4gPD0gTWF0aC5mbG9vcihjIC8gMikgLSBtKSB7XG4gICAgICAvLyBXZSBjYW4gc2xpZGUgdGhpbmdzIGRvd24gaW5zdGVhZCBvZiBhbGxvY2F0aW5nIGEgbmV3XG4gICAgICAvLyBBcnJheUJ1ZmZlci4gV2Ugb25seSBuZWVkIG0rbiA8PSBjIHRvIHNsaWRlLCBidXRcbiAgICAgIC8vIHdlIGluc3RlYWQgbGV0IGNhcGFjaXR5IGdldCB0d2ljZSBhcyBsYXJnZSBzbyB3ZVxuICAgICAgLy8gZG9uJ3Qgc3BlbmQgYWxsIG91ciB0aW1lIGNvcHlpbmcuXG4gICAgICBjb3B5KHRoaXMuI2J1Zi5zdWJhcnJheSh0aGlzLiNvZmYpLCB0aGlzLiNidWYpO1xuICAgIH0gZWxzZSBpZiAoYyArIG4gPiBNQVhfU0laRSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVGhlIGJ1ZmZlciBjYW5ub3QgYmUgZ3Jvd24gYmV5b25kIHRoZSBtYXhpbXVtIHNpemUuXCIpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBOb3QgZW5vdWdoIHNwYWNlIGFueXdoZXJlLCB3ZSBuZWVkIHRvIGFsbG9jYXRlLlxuICAgICAgY29uc3QgYnVmID0gbmV3IFVpbnQ4QXJyYXkoTWF0aC5taW4oMiAqIGMgKyBuLCBNQVhfU0laRSkpO1xuICAgICAgY29weSh0aGlzLiNidWYuc3ViYXJyYXkodGhpcy4jb2ZmKSwgYnVmKTtcbiAgICAgIHRoaXMuI2J1ZiA9IGJ1ZjtcbiAgICB9XG4gICAgLy8gUmVzdG9yZSB0aGlzLiNvZmYgYW5kIGxlbih0aGlzLiNidWYpLlxuICAgIHRoaXMuI29mZiA9IDA7XG4gICAgdGhpcy4jcmVzbGljZShNYXRoLm1pbihtICsgbiwgTUFYX1NJWkUpKTtcbiAgICByZXR1cm4gbTtcbiAgfVxuXG4gIC8qKiBHcm93cyB0aGUgYnVmZmVyJ3MgY2FwYWNpdHksIGlmIG5lY2Vzc2FyeSwgdG8gZ3VhcmFudGVlIHNwYWNlIGZvclxuICAgKiBhbm90aGVyIGBuYCBieXRlcy4gQWZ0ZXIgYC5ncm93KG4pYCwgYXQgbGVhc3QgYG5gIGJ5dGVzIGNhbiBiZSB3cml0dGVuIHRvXG4gICAqIHRoZSBidWZmZXIgd2l0aG91dCBhbm90aGVyIGFsbG9jYXRpb24uIElmIGBuYCBpcyBuZWdhdGl2ZSwgYC5ncm93KClgIHdpbGxcbiAgICogdGhyb3cuIElmIHRoZSBidWZmZXIgY2FuJ3QgZ3JvdyBpdCB3aWxsIHRocm93IGFuIGVycm9yLlxuICAgKlxuICAgKiBCYXNlZCBvbiBHbyBMYW5nJ3NcbiAgICogW0J1ZmZlci5Hcm93XShodHRwczovL2dvbGFuZy5vcmcvcGtnL2J5dGVzLyNCdWZmZXIuR3JvdykuICovXG4gIGdyb3cobjogbnVtYmVyKSB7XG4gICAgaWYgKG4gPCAwKSB7XG4gICAgICB0aHJvdyBFcnJvcihcIkJ1ZmZlci5ncm93OiBuZWdhdGl2ZSBjb3VudFwiKTtcbiAgICB9XG4gICAgY29uc3QgbSA9IHRoaXMuI2dyb3cobik7XG4gICAgdGhpcy4jcmVzbGljZShtKTtcbiAgfVxuXG4gIC8qKiBSZWFkcyBkYXRhIGZyb20gYHJgIHVudGlsIEVPRiAoYG51bGxgKSBhbmQgYXBwZW5kcyBpdCB0byB0aGUgYnVmZmVyLFxuICAgKiBncm93aW5nIHRoZSBidWZmZXIgYXMgbmVlZGVkLiBJdCByZXNvbHZlcyB0byB0aGUgbnVtYmVyIG9mIGJ5dGVzIHJlYWQuXG4gICAqIElmIHRoZSBidWZmZXIgYmVjb21lcyB0b28gbGFyZ2UsIGAucmVhZEZyb20oKWAgd2lsbCByZWplY3Qgd2l0aCBhbiBlcnJvci5cbiAgICpcbiAgICogQmFzZWQgb24gR28gTGFuZydzXG4gICAqIFtCdWZmZXIuUmVhZEZyb21dKGh0dHBzOi8vZ29sYW5nLm9yZy9wa2cvYnl0ZXMvI0J1ZmZlci5SZWFkRnJvbSkuICovXG4gIGFzeW5jIHJlYWRGcm9tKHI6IFJlYWRlcik6IFByb21pc2U8bnVtYmVyPiB7XG4gICAgbGV0IG4gPSAwO1xuICAgIGNvbnN0IHRtcCA9IG5ldyBVaW50OEFycmF5KE1JTl9SRUFEKTtcbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgY29uc3Qgc2hvdWxkR3JvdyA9IHRoaXMuY2FwYWNpdHkgLSB0aGlzLmxlbmd0aCA8IE1JTl9SRUFEO1xuICAgICAgLy8gcmVhZCBpbnRvIHRtcCBidWZmZXIgaWYgdGhlcmUncyBub3QgZW5vdWdoIHJvb21cbiAgICAgIC8vIG90aGVyd2lzZSByZWFkIGRpcmVjdGx5IGludG8gdGhlIGludGVybmFsIGJ1ZmZlclxuICAgICAgY29uc3QgYnVmID0gc2hvdWxkR3Jvd1xuICAgICAgICA/IHRtcFxuICAgICAgICA6IG5ldyBVaW50OEFycmF5KHRoaXMuI2J1Zi5idWZmZXIsIHRoaXMubGVuZ3RoKTtcblxuICAgICAgY29uc3QgbnJlYWQgPSBhd2FpdCByLnJlYWQoYnVmKTtcbiAgICAgIGlmIChucmVhZCA9PT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gbjtcbiAgICAgIH1cblxuICAgICAgLy8gd3JpdGUgd2lsbCBncm93IGlmIG5lZWRlZFxuICAgICAgaWYgKHNob3VsZEdyb3cpIHRoaXMud3JpdGVTeW5jKGJ1Zi5zdWJhcnJheSgwLCBucmVhZCkpO1xuICAgICAgZWxzZSB0aGlzLiNyZXNsaWNlKHRoaXMubGVuZ3RoICsgbnJlYWQpO1xuXG4gICAgICBuICs9IG5yZWFkO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBSZWFkcyBkYXRhIGZyb20gYHJgIHVudGlsIEVPRiAoYG51bGxgKSBhbmQgYXBwZW5kcyBpdCB0byB0aGUgYnVmZmVyLFxuICAgKiBncm93aW5nIHRoZSBidWZmZXIgYXMgbmVlZGVkLiBJdCByZXR1cm5zIHRoZSBudW1iZXIgb2YgYnl0ZXMgcmVhZC4gSWYgdGhlXG4gICAqIGJ1ZmZlciBiZWNvbWVzIHRvbyBsYXJnZSwgYC5yZWFkRnJvbVN5bmMoKWAgd2lsbCB0aHJvdyBhbiBlcnJvci5cbiAgICpcbiAgICogQmFzZWQgb24gR28gTGFuZydzXG4gICAqIFtCdWZmZXIuUmVhZEZyb21dKGh0dHBzOi8vZ29sYW5nLm9yZy9wa2cvYnl0ZXMvI0J1ZmZlci5SZWFkRnJvbSkuICovXG4gIHJlYWRGcm9tU3luYyhyOiBSZWFkZXJTeW5jKTogbnVtYmVyIHtcbiAgICBsZXQgbiA9IDA7XG4gICAgY29uc3QgdG1wID0gbmV3IFVpbnQ4QXJyYXkoTUlOX1JFQUQpO1xuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICBjb25zdCBzaG91bGRHcm93ID0gdGhpcy5jYXBhY2l0eSAtIHRoaXMubGVuZ3RoIDwgTUlOX1JFQUQ7XG4gICAgICAvLyByZWFkIGludG8gdG1wIGJ1ZmZlciBpZiB0aGVyZSdzIG5vdCBlbm91Z2ggcm9vbVxuICAgICAgLy8gb3RoZXJ3aXNlIHJlYWQgZGlyZWN0bHkgaW50byB0aGUgaW50ZXJuYWwgYnVmZmVyXG4gICAgICBjb25zdCBidWYgPSBzaG91bGRHcm93XG4gICAgICAgID8gdG1wXG4gICAgICAgIDogbmV3IFVpbnQ4QXJyYXkodGhpcy4jYnVmLmJ1ZmZlciwgdGhpcy5sZW5ndGgpO1xuXG4gICAgICBjb25zdCBucmVhZCA9IHIucmVhZFN5bmMoYnVmKTtcbiAgICAgIGlmIChucmVhZCA9PT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gbjtcbiAgICAgIH1cblxuICAgICAgLy8gd3JpdGUgd2lsbCBncm93IGlmIG5lZWRlZFxuICAgICAgaWYgKHNob3VsZEdyb3cpIHRoaXMud3JpdGVTeW5jKGJ1Zi5zdWJhcnJheSgwLCBucmVhZCkpO1xuICAgICAgZWxzZSB0aGlzLiNyZXNsaWNlKHRoaXMubGVuZ3RoICsgbnJlYWQpO1xuXG4gICAgICBuICs9IG5yZWFkO1xuICAgIH1cbiAgfVxufVxuXG5jb25zdCBERUZBVUxUX0JVRl9TSVpFID0gNDA5NjtcbmNvbnN0IE1JTl9CVUZfU0laRSA9IDE2O1xuY29uc3QgTUFYX0NPTlNFQ1VUSVZFX0VNUFRZX1JFQURTID0gMTAwO1xuY29uc3QgQ1IgPSBcIlxcclwiLmNoYXJDb2RlQXQoMCk7XG5jb25zdCBMRiA9IFwiXFxuXCIuY2hhckNvZGVBdCgwKTtcblxuZXhwb3J0IGNsYXNzIEJ1ZmZlckZ1bGxFcnJvciBleHRlbmRzIEVycm9yIHtcbiAgb3ZlcnJpZGUgbmFtZSA9IFwiQnVmZmVyRnVsbEVycm9yXCI7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBwYXJ0aWFsOiBVaW50OEFycmF5KSB7XG4gICAgc3VwZXIoXCJCdWZmZXIgZnVsbFwiKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgUGFydGlhbFJlYWRFcnJvciBleHRlbmRzIEVycm9yIHtcbiAgb3ZlcnJpZGUgbmFtZSA9IFwiUGFydGlhbFJlYWRFcnJvclwiO1xuICBwYXJ0aWFsPzogVWludDhBcnJheTtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXCJFbmNvdW50ZXJlZCBVbmV4cGVjdGVkRW9mLCBkYXRhIG9ubHkgcGFydGlhbGx5IHJlYWRcIik7XG4gIH1cbn1cblxuLyoqIFJlc3VsdCB0eXBlIHJldHVybmVkIGJ5IG9mIEJ1ZlJlYWRlci5yZWFkTGluZSgpLiAqL1xuZXhwb3J0IGludGVyZmFjZSBSZWFkTGluZVJlc3VsdCB7XG4gIGxpbmU6IFVpbnQ4QXJyYXk7XG4gIG1vcmU6IGJvb2xlYW47XG59XG5cbi8qKiBCdWZSZWFkZXIgaW1wbGVtZW50cyBidWZmZXJpbmcgZm9yIGEgUmVhZGVyIG9iamVjdC4gKi9cbmV4cG9ydCBjbGFzcyBCdWZSZWFkZXIgaW1wbGVtZW50cyBSZWFkZXIge1xuICAjYnVmITogVWludDhBcnJheTtcbiAgI3JkITogUmVhZGVyOyAvLyBSZWFkZXIgcHJvdmlkZWQgYnkgY2FsbGVyLlxuICAjciA9IDA7IC8vIGJ1ZiByZWFkIHBvc2l0aW9uLlxuICAjdyA9IDA7IC8vIGJ1ZiB3cml0ZSBwb3NpdGlvbi5cbiAgI2VvZiA9IGZhbHNlO1xuICAvLyBwcml2YXRlIGxhc3RCeXRlOiBudW1iZXI7XG4gIC8vIHByaXZhdGUgbGFzdENoYXJTaXplOiBudW1iZXI7XG5cbiAgLyoqIHJldHVybiBuZXcgQnVmUmVhZGVyIHVubGVzcyByIGlzIEJ1ZlJlYWRlciAqL1xuICBzdGF0aWMgY3JlYXRlKHI6IFJlYWRlciwgc2l6ZTogbnVtYmVyID0gREVGQVVMVF9CVUZfU0laRSk6IEJ1ZlJlYWRlciB7XG4gICAgcmV0dXJuIHIgaW5zdGFuY2VvZiBCdWZSZWFkZXIgPyByIDogbmV3IEJ1ZlJlYWRlcihyLCBzaXplKTtcbiAgfVxuXG4gIGNvbnN0cnVjdG9yKHJkOiBSZWFkZXIsIHNpemU6IG51bWJlciA9IERFRkFVTFRfQlVGX1NJWkUpIHtcbiAgICBpZiAoc2l6ZSA8IE1JTl9CVUZfU0laRSkge1xuICAgICAgc2l6ZSA9IE1JTl9CVUZfU0laRTtcbiAgICB9XG4gICAgdGhpcy4jcmVzZXQobmV3IFVpbnQ4QXJyYXkoc2l6ZSksIHJkKTtcbiAgfVxuXG4gIC8qKiBSZXR1cm5zIHRoZSBzaXplIG9mIHRoZSB1bmRlcmx5aW5nIGJ1ZmZlciBpbiBieXRlcy4gKi9cbiAgc2l6ZSgpOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLiNidWYuYnl0ZUxlbmd0aDtcbiAgfVxuXG4gIGJ1ZmZlcmVkKCk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMuI3cgLSB0aGlzLiNyO1xuICB9XG5cbiAgLy8gUmVhZHMgYSBuZXcgY2h1bmsgaW50byB0aGUgYnVmZmVyLlxuICAjZmlsbCA9IGFzeW5jICgpID0+IHtcbiAgICAvLyBTbGlkZSBleGlzdGluZyBkYXRhIHRvIGJlZ2lubmluZy5cbiAgICBpZiAodGhpcy4jciA+IDApIHtcbiAgICAgIHRoaXMuI2J1Zi5jb3B5V2l0aGluKDAsIHRoaXMuI3IsIHRoaXMuI3cpO1xuICAgICAgdGhpcy4jdyAtPSB0aGlzLiNyO1xuICAgICAgdGhpcy4jciA9IDA7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuI3cgPj0gdGhpcy4jYnVmLmJ5dGVMZW5ndGgpIHtcbiAgICAgIHRocm93IEVycm9yKFwiYnVmaW86IHRyaWVkIHRvIGZpbGwgZnVsbCBidWZmZXJcIik7XG4gICAgfVxuXG4gICAgLy8gUmVhZCBuZXcgZGF0YTogdHJ5IGEgbGltaXRlZCBudW1iZXIgb2YgdGltZXMuXG4gICAgZm9yIChsZXQgaSA9IE1BWF9DT05TRUNVVElWRV9FTVBUWV9SRUFEUzsgaSA+IDA7IGktLSkge1xuICAgICAgY29uc3QgcnIgPSBhd2FpdCB0aGlzLiNyZC5yZWFkKHRoaXMuI2J1Zi5zdWJhcnJheSh0aGlzLiN3KSk7XG4gICAgICBpZiAocnIgPT09IG51bGwpIHtcbiAgICAgICAgdGhpcy4jZW9mID0gdHJ1ZTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgYXNzZXJ0KHJyID49IDAsIFwibmVnYXRpdmUgcmVhZFwiKTtcbiAgICAgIHRoaXMuI3cgKz0gcnI7XG4gICAgICBpZiAocnIgPiAwKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgTm8gcHJvZ3Jlc3MgYWZ0ZXIgJHtNQVhfQ09OU0VDVVRJVkVfRU1QVFlfUkVBRFN9IHJlYWQoKSBjYWxsc2AsXG4gICAgKTtcbiAgfTtcblxuICAvKiogRGlzY2FyZHMgYW55IGJ1ZmZlcmVkIGRhdGEsIHJlc2V0cyBhbGwgc3RhdGUsIGFuZCBzd2l0Y2hlc1xuICAgKiB0aGUgYnVmZmVyZWQgcmVhZGVyIHRvIHJlYWQgZnJvbSByLlxuICAgKi9cbiAgcmVzZXQocjogUmVhZGVyKSB7XG4gICAgdGhpcy4jcmVzZXQodGhpcy4jYnVmLCByKTtcbiAgfVxuXG4gICNyZXNldCA9IChidWY6IFVpbnQ4QXJyYXksIHJkOiBSZWFkZXIpID0+IHtcbiAgICB0aGlzLiNidWYgPSBidWY7XG4gICAgdGhpcy4jcmQgPSByZDtcbiAgICB0aGlzLiNlb2YgPSBmYWxzZTtcbiAgICAvLyB0aGlzLmxhc3RCeXRlID0gLTE7XG4gICAgLy8gdGhpcy5sYXN0Q2hhclNpemUgPSAtMTtcbiAgfTtcblxuICAvKiogcmVhZHMgZGF0YSBpbnRvIHAuXG4gICAqIEl0IHJldHVybnMgdGhlIG51bWJlciBvZiBieXRlcyByZWFkIGludG8gcC5cbiAgICogVGhlIGJ5dGVzIGFyZSB0YWtlbiBmcm9tIGF0IG1vc3Qgb25lIFJlYWQgb24gdGhlIHVuZGVybHlpbmcgUmVhZGVyLFxuICAgKiBoZW5jZSBuIG1heSBiZSBsZXNzIHRoYW4gbGVuKHApLlxuICAgKiBUbyByZWFkIGV4YWN0bHkgbGVuKHApIGJ5dGVzLCB1c2UgaW8uUmVhZEZ1bGwoYiwgcCkuXG4gICAqL1xuICBhc3luYyByZWFkKHA6IFVpbnQ4QXJyYXkpOiBQcm9taXNlPG51bWJlciB8IG51bGw+IHtcbiAgICBsZXQgcnI6IG51bWJlciB8IG51bGwgPSBwLmJ5dGVMZW5ndGg7XG4gICAgaWYgKHAuYnl0ZUxlbmd0aCA9PT0gMCkgcmV0dXJuIHJyO1xuXG4gICAgaWYgKHRoaXMuI3IgPT09IHRoaXMuI3cpIHtcbiAgICAgIGlmIChwLmJ5dGVMZW5ndGggPj0gdGhpcy4jYnVmLmJ5dGVMZW5ndGgpIHtcbiAgICAgICAgLy8gTGFyZ2UgcmVhZCwgZW1wdHkgYnVmZmVyLlxuICAgICAgICAvLyBSZWFkIGRpcmVjdGx5IGludG8gcCB0byBhdm9pZCBjb3B5LlxuICAgICAgICBjb25zdCByciA9IGF3YWl0IHRoaXMuI3JkLnJlYWQocCk7XG4gICAgICAgIGNvbnN0IG5yZWFkID0gcnIgPz8gMDtcbiAgICAgICAgYXNzZXJ0KG5yZWFkID49IDAsIFwibmVnYXRpdmUgcmVhZFwiKTtcbiAgICAgICAgLy8gaWYgKHJyLm5yZWFkID4gMCkge1xuICAgICAgICAvLyAgIHRoaXMubGFzdEJ5dGUgPSBwW3JyLm5yZWFkIC0gMV07XG4gICAgICAgIC8vICAgdGhpcy5sYXN0Q2hhclNpemUgPSAtMTtcbiAgICAgICAgLy8gfVxuICAgICAgICByZXR1cm4gcnI7XG4gICAgICB9XG5cbiAgICAgIC8vIE9uZSByZWFkLlxuICAgICAgLy8gRG8gbm90IHVzZSB0aGlzLmZpbGwsIHdoaWNoIHdpbGwgbG9vcC5cbiAgICAgIHRoaXMuI3IgPSAwO1xuICAgICAgdGhpcy4jdyA9IDA7XG4gICAgICByciA9IGF3YWl0IHRoaXMuI3JkLnJlYWQodGhpcy4jYnVmKTtcbiAgICAgIGlmIChyciA9PT0gMCB8fCByciA9PT0gbnVsbCkgcmV0dXJuIHJyO1xuICAgICAgYXNzZXJ0KHJyID49IDAsIFwibmVnYXRpdmUgcmVhZFwiKTtcbiAgICAgIHRoaXMuI3cgKz0gcnI7XG4gICAgfVxuXG4gICAgLy8gY29weSBhcyBtdWNoIGFzIHdlIGNhblxuICAgIGNvbnN0IGNvcGllZCA9IGNvcHkodGhpcy4jYnVmLnN1YmFycmF5KHRoaXMuI3IsIHRoaXMuI3cpLCBwLCAwKTtcbiAgICB0aGlzLiNyICs9IGNvcGllZDtcbiAgICAvLyB0aGlzLmxhc3RCeXRlID0gdGhpcy5idWZbdGhpcy5yIC0gMV07XG4gICAgLy8gdGhpcy5sYXN0Q2hhclNpemUgPSAtMTtcbiAgICByZXR1cm4gY29waWVkO1xuICB9XG5cbiAgLyoqIHJlYWRzIGV4YWN0bHkgYHAubGVuZ3RoYCBieXRlcyBpbnRvIGBwYC5cbiAgICpcbiAgICogSWYgc3VjY2Vzc2Z1bCwgYHBgIGlzIHJldHVybmVkLlxuICAgKlxuICAgKiBJZiB0aGUgZW5kIG9mIHRoZSB1bmRlcmx5aW5nIHN0cmVhbSBoYXMgYmVlbiByZWFjaGVkLCBhbmQgdGhlcmUgYXJlIG5vIG1vcmVcbiAgICogYnl0ZXMgYXZhaWxhYmxlIGluIHRoZSBidWZmZXIsIGByZWFkRnVsbCgpYCByZXR1cm5zIGBudWxsYCBpbnN0ZWFkLlxuICAgKlxuICAgKiBBbiBlcnJvciBpcyB0aHJvd24gaWYgc29tZSBieXRlcyBjb3VsZCBiZSByZWFkLCBidXQgbm90IGVub3VnaCB0byBmaWxsIGBwYFxuICAgKiBlbnRpcmVseSBiZWZvcmUgdGhlIHVuZGVybHlpbmcgc3RyZWFtIHJlcG9ydGVkIGFuIGVycm9yIG9yIEVPRi4gQW55IGVycm9yXG4gICAqIHRocm93biB3aWxsIGhhdmUgYSBgcGFydGlhbGAgcHJvcGVydHkgdGhhdCBpbmRpY2F0ZXMgdGhlIHNsaWNlIG9mIHRoZVxuICAgKiBidWZmZXIgdGhhdCBoYXMgYmVlbiBzdWNjZXNzZnVsbHkgZmlsbGVkIHdpdGggZGF0YS5cbiAgICpcbiAgICogUG9ydGVkIGZyb20gaHR0cHM6Ly9nb2xhbmcub3JnL3BrZy9pby8jUmVhZEZ1bGxcbiAgICovXG4gIGFzeW5jIHJlYWRGdWxsKHA6IFVpbnQ4QXJyYXkpOiBQcm9taXNlPFVpbnQ4QXJyYXkgfCBudWxsPiB7XG4gICAgbGV0IGJ5dGVzUmVhZCA9IDA7XG4gICAgd2hpbGUgKGJ5dGVzUmVhZCA8IHAubGVuZ3RoKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCByciA9IGF3YWl0IHRoaXMucmVhZChwLnN1YmFycmF5KGJ5dGVzUmVhZCkpO1xuICAgICAgICBpZiAocnIgPT09IG51bGwpIHtcbiAgICAgICAgICBpZiAoYnl0ZXNSZWFkID09PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFBhcnRpYWxSZWFkRXJyb3IoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnl0ZXNSZWFkICs9IHJyO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGlmIChlcnIgaW5zdGFuY2VvZiBQYXJ0aWFsUmVhZEVycm9yKSB7XG4gICAgICAgICAgZXJyLnBhcnRpYWwgPSBwLnN1YmFycmF5KDAsIGJ5dGVzUmVhZCk7XG4gICAgICAgIH0gZWxzZSBpZiAoZXJyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgICBjb25zdCBlID0gbmV3IFBhcnRpYWxSZWFkRXJyb3IoKTtcbiAgICAgICAgICBlLnBhcnRpYWwgPSBwLnN1YmFycmF5KDAsIGJ5dGVzUmVhZCk7XG4gICAgICAgICAgZS5zdGFjayA9IGVyci5zdGFjaztcbiAgICAgICAgICBlLm1lc3NhZ2UgPSBlcnIubWVzc2FnZTtcbiAgICAgICAgICBlLmNhdXNlID0gZXJyLmNhdXNlO1xuICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBlcnI7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBwO1xuICB9XG5cbiAgLyoqIFJldHVybnMgdGhlIG5leHQgYnl0ZSBbMCwgMjU1XSBvciBgbnVsbGAuICovXG4gIGFzeW5jIHJlYWRCeXRlKCk6IFByb21pc2U8bnVtYmVyIHwgbnVsbD4ge1xuICAgIHdoaWxlICh0aGlzLiNyID09PSB0aGlzLiN3KSB7XG4gICAgICBpZiAodGhpcy4jZW9mKSByZXR1cm4gbnVsbDtcbiAgICAgIGF3YWl0IHRoaXMuI2ZpbGwoKTsgLy8gYnVmZmVyIGlzIGVtcHR5LlxuICAgIH1cbiAgICBjb25zdCBjID0gdGhpcy4jYnVmW3RoaXMuI3JdO1xuICAgIHRoaXMuI3IrKztcbiAgICAvLyB0aGlzLmxhc3RCeXRlID0gYztcbiAgICByZXR1cm4gYztcbiAgfVxuXG4gIC8qKiByZWFkU3RyaW5nKCkgcmVhZHMgdW50aWwgdGhlIGZpcnN0IG9jY3VycmVuY2Ugb2YgZGVsaW0gaW4gdGhlIGlucHV0LFxuICAgKiByZXR1cm5pbmcgYSBzdHJpbmcgY29udGFpbmluZyB0aGUgZGF0YSB1cCB0byBhbmQgaW5jbHVkaW5nIHRoZSBkZWxpbWl0ZXIuXG4gICAqIElmIFJlYWRTdHJpbmcgZW5jb3VudGVycyBhbiBlcnJvciBiZWZvcmUgZmluZGluZyBhIGRlbGltaXRlcixcbiAgICogaXQgcmV0dXJucyB0aGUgZGF0YSByZWFkIGJlZm9yZSB0aGUgZXJyb3IgYW5kIHRoZSBlcnJvciBpdHNlbGZcbiAgICogKG9mdGVuIGBudWxsYCkuXG4gICAqIFJlYWRTdHJpbmcgcmV0dXJucyBlcnIgIT0gbmlsIGlmIGFuZCBvbmx5IGlmIHRoZSByZXR1cm5lZCBkYXRhIGRvZXMgbm90IGVuZFxuICAgKiBpbiBkZWxpbS5cbiAgICogRm9yIHNpbXBsZSB1c2VzLCBhIFNjYW5uZXIgbWF5IGJlIG1vcmUgY29udmVuaWVudC5cbiAgICovXG4gIGFzeW5jIHJlYWRTdHJpbmcoZGVsaW06IHN0cmluZyk6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4ge1xuICAgIGlmIChkZWxpbS5sZW5ndGggIT09IDEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkRlbGltaXRlciBzaG91bGQgYmUgYSBzaW5nbGUgY2hhcmFjdGVyXCIpO1xuICAgIH1cbiAgICBjb25zdCBidWZmZXIgPSBhd2FpdCB0aGlzLnJlYWRTbGljZShkZWxpbS5jaGFyQ29kZUF0KDApKTtcbiAgICBpZiAoYnVmZmVyID09PSBudWxsKSByZXR1cm4gbnVsbDtcbiAgICByZXR1cm4gbmV3IFRleHREZWNvZGVyKCkuZGVjb2RlKGJ1ZmZlcik7XG4gIH1cblxuICAvKiogYHJlYWRMaW5lKClgIGlzIGEgbG93LWxldmVsIGxpbmUtcmVhZGluZyBwcmltaXRpdmUuIE1vc3QgY2FsbGVycyBzaG91bGRcbiAgICogdXNlIGByZWFkU3RyaW5nKCdcXG4nKWAgaW5zdGVhZCBvciB1c2UgYSBTY2FubmVyLlxuICAgKlxuICAgKiBgcmVhZExpbmUoKWAgdHJpZXMgdG8gcmV0dXJuIGEgc2luZ2xlIGxpbmUsIG5vdCBpbmNsdWRpbmcgdGhlIGVuZC1vZi1saW5lXG4gICAqIGJ5dGVzLiBJZiB0aGUgbGluZSB3YXMgdG9vIGxvbmcgZm9yIHRoZSBidWZmZXIgdGhlbiBgbW9yZWAgaXMgc2V0IGFuZCB0aGVcbiAgICogYmVnaW5uaW5nIG9mIHRoZSBsaW5lIGlzIHJldHVybmVkLiBUaGUgcmVzdCBvZiB0aGUgbGluZSB3aWxsIGJlIHJldHVybmVkXG4gICAqIGZyb20gZnV0dXJlIGNhbGxzLiBgbW9yZWAgd2lsbCBiZSBmYWxzZSB3aGVuIHJldHVybmluZyB0aGUgbGFzdCBmcmFnbWVudFxuICAgKiBvZiB0aGUgbGluZS4gVGhlIHJldHVybmVkIGJ1ZmZlciBpcyBvbmx5IHZhbGlkIHVudGlsIHRoZSBuZXh0IGNhbGwgdG9cbiAgICogYHJlYWRMaW5lKClgLlxuICAgKlxuICAgKiBUaGUgdGV4dCByZXR1cm5lZCBmcm9tIFJlYWRMaW5lIGRvZXMgbm90IGluY2x1ZGUgdGhlIGxpbmUgZW5kIChcIlxcclxcblwiIG9yXG4gICAqIFwiXFxuXCIpLlxuICAgKlxuICAgKiBXaGVuIHRoZSBlbmQgb2YgdGhlIHVuZGVybHlpbmcgc3RyZWFtIGlzIHJlYWNoZWQsIHRoZSBmaW5hbCBieXRlcyBpbiB0aGVcbiAgICogc3RyZWFtIGFyZSByZXR1cm5lZC4gTm8gaW5kaWNhdGlvbiBvciBlcnJvciBpcyBnaXZlbiBpZiB0aGUgaW5wdXQgZW5kc1xuICAgKiB3aXRob3V0IGEgZmluYWwgbGluZSBlbmQuIFdoZW4gdGhlcmUgYXJlIG5vIG1vcmUgdHJhaWxpbmcgYnl0ZXMgdG8gcmVhZCxcbiAgICogYHJlYWRMaW5lKClgIHJldHVybnMgYG51bGxgLlxuICAgKlxuICAgKiBDYWxsaW5nIGB1bnJlYWRCeXRlKClgIGFmdGVyIGByZWFkTGluZSgpYCB3aWxsIGFsd2F5cyB1bnJlYWQgdGhlIGxhc3QgYnl0ZVxuICAgKiByZWFkIChwb3NzaWJseSBhIGNoYXJhY3RlciBiZWxvbmdpbmcgdG8gdGhlIGxpbmUgZW5kKSBldmVuIGlmIHRoYXQgYnl0ZSBpc1xuICAgKiBub3QgcGFydCBvZiB0aGUgbGluZSByZXR1cm5lZCBieSBgcmVhZExpbmUoKWAuXG4gICAqL1xuICBhc3luYyByZWFkTGluZSgpOiBQcm9taXNlPFJlYWRMaW5lUmVzdWx0IHwgbnVsbD4ge1xuICAgIGxldCBsaW5lOiBVaW50OEFycmF5IHwgbnVsbCA9IG51bGw7XG5cbiAgICB0cnkge1xuICAgICAgbGluZSA9IGF3YWl0IHRoaXMucmVhZFNsaWNlKExGKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGxldCBwYXJ0aWFsO1xuICAgICAgaWYgKGVyciBpbnN0YW5jZW9mIFBhcnRpYWxSZWFkRXJyb3IpIHtcbiAgICAgICAgcGFydGlhbCA9IGVyci5wYXJ0aWFsO1xuICAgICAgICBhc3NlcnQoXG4gICAgICAgICAgcGFydGlhbCBpbnN0YW5jZW9mIFVpbnQ4QXJyYXksXG4gICAgICAgICAgXCJidWZpbzogY2F1Z2h0IGVycm9yIGZyb20gYHJlYWRTbGljZSgpYCB3aXRob3V0IGBwYXJ0aWFsYCBwcm9wZXJ0eVwiLFxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICAvLyBEb24ndCB0aHJvdyBpZiBgcmVhZFNsaWNlKClgIGZhaWxlZCB3aXRoIGBCdWZmZXJGdWxsRXJyb3JgLCBpbnN0ZWFkIHdlXG4gICAgICAvLyBqdXN0IHJldHVybiB3aGF0ZXZlciBpcyBhdmFpbGFibGUgYW5kIHNldCB0aGUgYG1vcmVgIGZsYWcuXG4gICAgICBpZiAoIShlcnIgaW5zdGFuY2VvZiBCdWZmZXJGdWxsRXJyb3IpKSB7XG4gICAgICAgIHRocm93IGVycjtcbiAgICAgIH1cblxuICAgICAgcGFydGlhbCA9IGVyci5wYXJ0aWFsO1xuXG4gICAgICAvLyBIYW5kbGUgdGhlIGNhc2Ugd2hlcmUgXCJcXHJcXG5cIiBzdHJhZGRsZXMgdGhlIGJ1ZmZlci5cbiAgICAgIGlmIChcbiAgICAgICAgIXRoaXMuI2VvZiAmJiBwYXJ0aWFsICYmXG4gICAgICAgIHBhcnRpYWwuYnl0ZUxlbmd0aCA+IDAgJiZcbiAgICAgICAgcGFydGlhbFtwYXJ0aWFsLmJ5dGVMZW5ndGggLSAxXSA9PT0gQ1JcbiAgICAgICkge1xuICAgICAgICAvLyBQdXQgdGhlICdcXHInIGJhY2sgb24gYnVmIGFuZCBkcm9wIGl0IGZyb20gbGluZS5cbiAgICAgICAgLy8gTGV0IHRoZSBuZXh0IGNhbGwgdG8gUmVhZExpbmUgY2hlY2sgZm9yIFwiXFxyXFxuXCIuXG4gICAgICAgIGFzc2VydCh0aGlzLiNyID4gMCwgXCJidWZpbzogdHJpZWQgdG8gcmV3aW5kIHBhc3Qgc3RhcnQgb2YgYnVmZmVyXCIpO1xuICAgICAgICB0aGlzLiNyLS07XG4gICAgICAgIHBhcnRpYWwgPSBwYXJ0aWFsLnN1YmFycmF5KDAsIHBhcnRpYWwuYnl0ZUxlbmd0aCAtIDEpO1xuICAgICAgfVxuXG4gICAgICBpZiAocGFydGlhbCkge1xuICAgICAgICByZXR1cm4geyBsaW5lOiBwYXJ0aWFsLCBtb3JlOiAhdGhpcy4jZW9mIH07XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGxpbmUgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGlmIChsaW5lLmJ5dGVMZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiB7IGxpbmUsIG1vcmU6IGZhbHNlIH07XG4gICAgfVxuXG4gICAgaWYgKGxpbmVbbGluZS5ieXRlTGVuZ3RoIC0gMV0gPT0gTEYpIHtcbiAgICAgIGxldCBkcm9wID0gMTtcbiAgICAgIGlmIChsaW5lLmJ5dGVMZW5ndGggPiAxICYmIGxpbmVbbGluZS5ieXRlTGVuZ3RoIC0gMl0gPT09IENSKSB7XG4gICAgICAgIGRyb3AgPSAyO1xuICAgICAgfVxuICAgICAgbGluZSA9IGxpbmUuc3ViYXJyYXkoMCwgbGluZS5ieXRlTGVuZ3RoIC0gZHJvcCk7XG4gICAgfVxuICAgIHJldHVybiB7IGxpbmUsIG1vcmU6IGZhbHNlIH07XG4gIH1cblxuICAvKiogYHJlYWRTbGljZSgpYCByZWFkcyB1bnRpbCB0aGUgZmlyc3Qgb2NjdXJyZW5jZSBvZiBgZGVsaW1gIGluIHRoZSBpbnB1dCxcbiAgICogcmV0dXJuaW5nIGEgc2xpY2UgcG9pbnRpbmcgYXQgdGhlIGJ5dGVzIGluIHRoZSBidWZmZXIuIFRoZSBieXRlcyBzdG9wXG4gICAqIGJlaW5nIHZhbGlkIGF0IHRoZSBuZXh0IHJlYWQuXG4gICAqXG4gICAqIElmIGByZWFkU2xpY2UoKWAgZW5jb3VudGVycyBhbiBlcnJvciBiZWZvcmUgZmluZGluZyBhIGRlbGltaXRlciwgb3IgdGhlXG4gICAqIGJ1ZmZlciBmaWxscyB3aXRob3V0IGZpbmRpbmcgYSBkZWxpbWl0ZXIsIGl0IHRocm93cyBhbiBlcnJvciB3aXRoIGFcbiAgICogYHBhcnRpYWxgIHByb3BlcnR5IHRoYXQgY29udGFpbnMgdGhlIGVudGlyZSBidWZmZXIuXG4gICAqXG4gICAqIElmIGByZWFkU2xpY2UoKWAgZW5jb3VudGVycyB0aGUgZW5kIG9mIHRoZSB1bmRlcmx5aW5nIHN0cmVhbSBhbmQgdGhlcmUgYXJlXG4gICAqIGFueSBieXRlcyBsZWZ0IGluIHRoZSBidWZmZXIsIHRoZSByZXN0IG9mIHRoZSBidWZmZXIgaXMgcmV0dXJuZWQuIEluIG90aGVyXG4gICAqIHdvcmRzLCBFT0YgaXMgYWx3YXlzIHRyZWF0ZWQgYXMgYSBkZWxpbWl0ZXIuIE9uY2UgdGhlIGJ1ZmZlciBpcyBlbXB0eSxcbiAgICogaXQgcmV0dXJucyBgbnVsbGAuXG4gICAqXG4gICAqIEJlY2F1c2UgdGhlIGRhdGEgcmV0dXJuZWQgZnJvbSBgcmVhZFNsaWNlKClgIHdpbGwgYmUgb3ZlcndyaXR0ZW4gYnkgdGhlXG4gICAqIG5leHQgSS9PIG9wZXJhdGlvbiwgbW9zdCBjbGllbnRzIHNob3VsZCB1c2UgYHJlYWRTdHJpbmcoKWAgaW5zdGVhZC5cbiAgICovXG4gIGFzeW5jIHJlYWRTbGljZShkZWxpbTogbnVtYmVyKTogUHJvbWlzZTxVaW50OEFycmF5IHwgbnVsbD4ge1xuICAgIGxldCBzID0gMDsgLy8gc2VhcmNoIHN0YXJ0IGluZGV4XG4gICAgbGV0IHNsaWNlOiBVaW50OEFycmF5IHwgdW5kZWZpbmVkO1xuXG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIC8vIFNlYXJjaCBidWZmZXIuXG4gICAgICBsZXQgaSA9IHRoaXMuI2J1Zi5zdWJhcnJheSh0aGlzLiNyICsgcywgdGhpcy4jdykuaW5kZXhPZihkZWxpbSk7XG4gICAgICBpZiAoaSA+PSAwKSB7XG4gICAgICAgIGkgKz0gcztcbiAgICAgICAgc2xpY2UgPSB0aGlzLiNidWYuc3ViYXJyYXkodGhpcy4jciwgdGhpcy4jciArIGkgKyAxKTtcbiAgICAgICAgdGhpcy4jciArPSBpICsgMTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIC8vIEVPRj9cbiAgICAgIGlmICh0aGlzLiNlb2YpIHtcbiAgICAgICAgaWYgKHRoaXMuI3IgPT09IHRoaXMuI3cpIHtcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBzbGljZSA9IHRoaXMuI2J1Zi5zdWJhcnJheSh0aGlzLiNyLCB0aGlzLiN3KTtcbiAgICAgICAgdGhpcy4jciA9IHRoaXMuI3c7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICAvLyBCdWZmZXIgZnVsbD9cbiAgICAgIGlmICh0aGlzLmJ1ZmZlcmVkKCkgPj0gdGhpcy4jYnVmLmJ5dGVMZW5ndGgpIHtcbiAgICAgICAgdGhpcy4jciA9IHRoaXMuI3c7XG4gICAgICAgIC8vICM0NTIxIFRoZSBpbnRlcm5hbCBidWZmZXIgc2hvdWxkIG5vdCBiZSByZXVzZWQgYWNyb3NzIHJlYWRzIGJlY2F1c2UgaXQgY2F1c2VzIGNvcnJ1cHRpb24gb2YgZGF0YS5cbiAgICAgICAgY29uc3Qgb2xkYnVmID0gdGhpcy4jYnVmO1xuICAgICAgICBjb25zdCBuZXdidWYgPSB0aGlzLiNidWYuc2xpY2UoMCk7XG4gICAgICAgIHRoaXMuI2J1ZiA9IG5ld2J1ZjtcbiAgICAgICAgdGhyb3cgbmV3IEJ1ZmZlckZ1bGxFcnJvcihvbGRidWYpO1xuICAgICAgfVxuXG4gICAgICBzID0gdGhpcy4jdyAtIHRoaXMuI3I7IC8vIGRvIG5vdCByZXNjYW4gYXJlYSB3ZSBzY2FubmVkIGJlZm9yZVxuXG4gICAgICAvLyBCdWZmZXIgaXMgbm90IGZ1bGwuXG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCB0aGlzLiNmaWxsKCk7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgaWYgKGVyciBpbnN0YW5jZW9mIFBhcnRpYWxSZWFkRXJyb3IpIHtcbiAgICAgICAgICBlcnIucGFydGlhbCA9IHNsaWNlO1xuICAgICAgICB9IGVsc2UgaWYgKGVyciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgICAgY29uc3QgZSA9IG5ldyBQYXJ0aWFsUmVhZEVycm9yKCk7XG4gICAgICAgICAgZS5wYXJ0aWFsID0gc2xpY2U7XG4gICAgICAgICAgZS5zdGFjayA9IGVyci5zdGFjaztcbiAgICAgICAgICBlLm1lc3NhZ2UgPSBlcnIubWVzc2FnZTtcbiAgICAgICAgICBlLmNhdXNlID0gZXJyLmNhdXNlO1xuICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBlcnI7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gSGFuZGxlIGxhc3QgYnl0ZSwgaWYgYW55LlxuICAgIC8vIGNvbnN0IGkgPSBzbGljZS5ieXRlTGVuZ3RoIC0gMTtcbiAgICAvLyBpZiAoaSA+PSAwKSB7XG4gICAgLy8gICB0aGlzLmxhc3RCeXRlID0gc2xpY2VbaV07XG4gICAgLy8gICB0aGlzLmxhc3RDaGFyU2l6ZSA9IC0xXG4gICAgLy8gfVxuXG4gICAgcmV0dXJuIHNsaWNlO1xuICB9XG5cbiAgLyoqIGBwZWVrKClgIHJldHVybnMgdGhlIG5leHQgYG5gIGJ5dGVzIHdpdGhvdXQgYWR2YW5jaW5nIHRoZSByZWFkZXIuIFRoZVxuICAgKiBieXRlcyBzdG9wIGJlaW5nIHZhbGlkIGF0IHRoZSBuZXh0IHJlYWQgY2FsbC5cbiAgICpcbiAgICogV2hlbiB0aGUgZW5kIG9mIHRoZSB1bmRlcmx5aW5nIHN0cmVhbSBpcyByZWFjaGVkLCBidXQgdGhlcmUgYXJlIHVucmVhZFxuICAgKiBieXRlcyBsZWZ0IGluIHRoZSBidWZmZXIsIHRob3NlIGJ5dGVzIGFyZSByZXR1cm5lZC4gSWYgdGhlcmUgYXJlIG5vIGJ5dGVzXG4gICAqIGxlZnQgaW4gdGhlIGJ1ZmZlciwgaXQgcmV0dXJucyBgbnVsbGAuXG4gICAqXG4gICAqIElmIGFuIGVycm9yIGlzIGVuY291bnRlcmVkIGJlZm9yZSBgbmAgYnl0ZXMgYXJlIGF2YWlsYWJsZSwgYHBlZWsoKWAgdGhyb3dzXG4gICAqIGFuIGVycm9yIHdpdGggdGhlIGBwYXJ0aWFsYCBwcm9wZXJ0eSBzZXQgdG8gYSBzbGljZSBvZiB0aGUgYnVmZmVyIHRoYXRcbiAgICogY29udGFpbnMgdGhlIGJ5dGVzIHRoYXQgd2VyZSBhdmFpbGFibGUgYmVmb3JlIHRoZSBlcnJvciBvY2N1cnJlZC5cbiAgICovXG4gIGFzeW5jIHBlZWsobjogbnVtYmVyKTogUHJvbWlzZTxVaW50OEFycmF5IHwgbnVsbD4ge1xuICAgIGlmIChuIDwgMCkge1xuICAgICAgdGhyb3cgRXJyb3IoXCJuZWdhdGl2ZSBjb3VudFwiKTtcbiAgICB9XG5cbiAgICBsZXQgYXZhaWwgPSB0aGlzLiN3IC0gdGhpcy4jcjtcbiAgICB3aGlsZSAoYXZhaWwgPCBuICYmIGF2YWlsIDwgdGhpcy4jYnVmLmJ5dGVMZW5ndGggJiYgIXRoaXMuI2VvZikge1xuICAgICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgdGhpcy4jZmlsbCgpO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGlmIChlcnIgaW5zdGFuY2VvZiBQYXJ0aWFsUmVhZEVycm9yKSB7XG4gICAgICAgICAgZXJyLnBhcnRpYWwgPSB0aGlzLiNidWYuc3ViYXJyYXkodGhpcy4jciwgdGhpcy4jdyk7XG4gICAgICAgIH0gZWxzZSBpZiAoZXJyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgICBjb25zdCBlID0gbmV3IFBhcnRpYWxSZWFkRXJyb3IoKTtcbiAgICAgICAgICBlLnBhcnRpYWwgPSB0aGlzLiNidWYuc3ViYXJyYXkodGhpcy4jciwgdGhpcy4jdyk7XG4gICAgICAgICAgZS5zdGFjayA9IGVyci5zdGFjaztcbiAgICAgICAgICBlLm1lc3NhZ2UgPSBlcnIubWVzc2FnZTtcbiAgICAgICAgICBlLmNhdXNlID0gZXJyLmNhdXNlO1xuICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBlcnI7XG4gICAgICB9XG4gICAgICBhdmFpbCA9IHRoaXMuI3cgLSB0aGlzLiNyO1xuICAgIH1cblxuICAgIGlmIChhdmFpbCA9PT0gMCAmJiB0aGlzLiNlb2YpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0gZWxzZSBpZiAoYXZhaWwgPCBuICYmIHRoaXMuI2VvZikge1xuICAgICAgcmV0dXJuIHRoaXMuI2J1Zi5zdWJhcnJheSh0aGlzLiNyLCB0aGlzLiNyICsgYXZhaWwpO1xuICAgIH0gZWxzZSBpZiAoYXZhaWwgPCBuKSB7XG4gICAgICB0aHJvdyBuZXcgQnVmZmVyRnVsbEVycm9yKHRoaXMuI2J1Zi5zdWJhcnJheSh0aGlzLiNyLCB0aGlzLiN3KSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuI2J1Zi5zdWJhcnJheSh0aGlzLiNyLCB0aGlzLiNyICsgbik7XG4gIH1cbn1cblxuYWJzdHJhY3QgY2xhc3MgQWJzdHJhY3RCdWZCYXNlIHtcbiAgYnVmOiBVaW50OEFycmF5O1xuICB1c2VkQnVmZmVyQnl0ZXMgPSAwO1xuICBlcnI6IEVycm9yIHwgbnVsbCA9IG51bGw7XG5cbiAgY29uc3RydWN0b3IoYnVmOiBVaW50OEFycmF5KSB7XG4gICAgdGhpcy5idWYgPSBidWY7XG4gIH1cblxuICAvKiogU2l6ZSByZXR1cm5zIHRoZSBzaXplIG9mIHRoZSB1bmRlcmx5aW5nIGJ1ZmZlciBpbiBieXRlcy4gKi9cbiAgc2l6ZSgpOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLmJ1Zi5ieXRlTGVuZ3RoO1xuICB9XG5cbiAgLyoqIFJldHVybnMgaG93IG1hbnkgYnl0ZXMgYXJlIHVudXNlZCBpbiB0aGUgYnVmZmVyLiAqL1xuICBhdmFpbGFibGUoKTogbnVtYmVyIHtcbiAgICByZXR1cm4gdGhpcy5idWYuYnl0ZUxlbmd0aCAtIHRoaXMudXNlZEJ1ZmZlckJ5dGVzO1xuICB9XG5cbiAgLyoqIGJ1ZmZlcmVkIHJldHVybnMgdGhlIG51bWJlciBvZiBieXRlcyB0aGF0IGhhdmUgYmVlbiB3cml0dGVuIGludG8gdGhlXG4gICAqIGN1cnJlbnQgYnVmZmVyLlxuICAgKi9cbiAgYnVmZmVyZWQoKTogbnVtYmVyIHtcbiAgICByZXR1cm4gdGhpcy51c2VkQnVmZmVyQnl0ZXM7XG4gIH1cbn1cblxuLyoqIEJ1ZldyaXRlciBpbXBsZW1lbnRzIGJ1ZmZlcmluZyBmb3IgYW4gZGVuby5Xcml0ZXIgb2JqZWN0LlxuICogSWYgYW4gZXJyb3Igb2NjdXJzIHdyaXRpbmcgdG8gYSBXcml0ZXIsIG5vIG1vcmUgZGF0YSB3aWxsIGJlXG4gKiBhY2NlcHRlZCBhbmQgYWxsIHN1YnNlcXVlbnQgd3JpdGVzLCBhbmQgZmx1c2goKSwgd2lsbCByZXR1cm4gdGhlIGVycm9yLlxuICogQWZ0ZXIgYWxsIGRhdGEgaGFzIGJlZW4gd3JpdHRlbiwgdGhlIGNsaWVudCBzaG91bGQgY2FsbCB0aGVcbiAqIGZsdXNoKCkgbWV0aG9kIHRvIGd1YXJhbnRlZSBhbGwgZGF0YSBoYXMgYmVlbiBmb3J3YXJkZWQgdG9cbiAqIHRoZSB1bmRlcmx5aW5nIGRlbm8uV3JpdGVyLlxuICovXG5leHBvcnQgY2xhc3MgQnVmV3JpdGVyIGV4dGVuZHMgQWJzdHJhY3RCdWZCYXNlIGltcGxlbWVudHMgV3JpdGVyIHtcbiAgI3dyaXRlcjogV3JpdGVyO1xuXG4gIC8qKiByZXR1cm4gbmV3IEJ1ZldyaXRlciB1bmxlc3Mgd3JpdGVyIGlzIEJ1ZldyaXRlciAqL1xuICBzdGF0aWMgY3JlYXRlKHdyaXRlcjogV3JpdGVyLCBzaXplOiBudW1iZXIgPSBERUZBVUxUX0JVRl9TSVpFKTogQnVmV3JpdGVyIHtcbiAgICByZXR1cm4gd3JpdGVyIGluc3RhbmNlb2YgQnVmV3JpdGVyID8gd3JpdGVyIDogbmV3IEJ1ZldyaXRlcih3cml0ZXIsIHNpemUpO1xuICB9XG5cbiAgY29uc3RydWN0b3Iod3JpdGVyOiBXcml0ZXIsIHNpemU6IG51bWJlciA9IERFRkFVTFRfQlVGX1NJWkUpIHtcbiAgICBzdXBlcihuZXcgVWludDhBcnJheShzaXplIDw9IDAgPyBERUZBVUxUX0JVRl9TSVpFIDogc2l6ZSkpO1xuICAgIHRoaXMuI3dyaXRlciA9IHdyaXRlcjtcbiAgfVxuXG4gIC8qKiBEaXNjYXJkcyBhbnkgdW5mbHVzaGVkIGJ1ZmZlcmVkIGRhdGEsIGNsZWFycyBhbnkgZXJyb3IsIGFuZFxuICAgKiByZXNldHMgYnVmZmVyIHRvIHdyaXRlIGl0cyBvdXRwdXQgdG8gdy5cbiAgICovXG4gIHJlc2V0KHc6IFdyaXRlcikge1xuICAgIHRoaXMuZXJyID0gbnVsbDtcbiAgICB0aGlzLnVzZWRCdWZmZXJCeXRlcyA9IDA7XG4gICAgdGhpcy4jd3JpdGVyID0gdztcbiAgfVxuXG4gIC8qKiBGbHVzaCB3cml0ZXMgYW55IGJ1ZmZlcmVkIGRhdGEgdG8gdGhlIHVuZGVybHlpbmcgaW8uV3JpdGVyLiAqL1xuICBhc3luYyBmbHVzaCgpIHtcbiAgICBpZiAodGhpcy5lcnIgIT09IG51bGwpIHRocm93IHRoaXMuZXJyO1xuICAgIGlmICh0aGlzLnVzZWRCdWZmZXJCeXRlcyA9PT0gMCkgcmV0dXJuO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHAgPSB0aGlzLmJ1Zi5zdWJhcnJheSgwLCB0aGlzLnVzZWRCdWZmZXJCeXRlcyk7XG4gICAgICBsZXQgbndyaXR0ZW4gPSAwO1xuICAgICAgd2hpbGUgKG53cml0dGVuIDwgcC5sZW5ndGgpIHtcbiAgICAgICAgbndyaXR0ZW4gKz0gYXdhaXQgdGhpcy4jd3JpdGVyLndyaXRlKHAuc3ViYXJyYXkobndyaXR0ZW4pKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAoZSBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRoaXMuZXJyID0gZTtcbiAgICAgIH1cbiAgICAgIHRocm93IGU7XG4gICAgfVxuXG4gICAgdGhpcy5idWYgPSBuZXcgVWludDhBcnJheSh0aGlzLmJ1Zi5sZW5ndGgpO1xuICAgIHRoaXMudXNlZEJ1ZmZlckJ5dGVzID0gMDtcbiAgfVxuXG4gIC8qKiBXcml0ZXMgdGhlIGNvbnRlbnRzIG9mIGBkYXRhYCBpbnRvIHRoZSBidWZmZXIuICBJZiB0aGUgY29udGVudHMgd29uJ3QgZnVsbHlcbiAgICogZml0IGludG8gdGhlIGJ1ZmZlciwgdGhvc2UgYnl0ZXMgdGhhdCBjYW4gYXJlIGNvcGllZCBpbnRvIHRoZSBidWZmZXIsIHRoZVxuICAgKiBidWZmZXIgaXMgdGhlIGZsdXNoZWQgdG8gdGhlIHdyaXRlciBhbmQgdGhlIHJlbWFpbmluZyBieXRlcyBhcmUgY29waWVkIGludG9cbiAgICogdGhlIG5vdyBlbXB0eSBidWZmZXIuXG4gICAqXG4gICAqIEByZXR1cm4gdGhlIG51bWJlciBvZiBieXRlcyB3cml0dGVuIHRvIHRoZSBidWZmZXIuXG4gICAqL1xuICBhc3luYyB3cml0ZShkYXRhOiBVaW50OEFycmF5KTogUHJvbWlzZTxudW1iZXI+IHtcbiAgICBpZiAodGhpcy5lcnIgIT09IG51bGwpIHRocm93IHRoaXMuZXJyO1xuICAgIGlmIChkYXRhLmxlbmd0aCA9PT0gMCkgcmV0dXJuIDA7XG5cbiAgICBsZXQgdG90YWxCeXRlc1dyaXR0ZW4gPSAwO1xuICAgIGxldCBudW1CeXRlc1dyaXR0ZW4gPSAwO1xuICAgIHdoaWxlIChkYXRhLmJ5dGVMZW5ndGggPiB0aGlzLmF2YWlsYWJsZSgpKSB7XG4gICAgICBpZiAodGhpcy5idWZmZXJlZCgpID09PSAwKSB7XG4gICAgICAgIC8vIExhcmdlIHdyaXRlLCBlbXB0eSBidWZmZXIuXG4gICAgICAgIC8vIFdyaXRlIGRpcmVjdGx5IGZyb20gZGF0YSB0byBhdm9pZCBjb3B5LlxuICAgICAgICB0cnkge1xuICAgICAgICAgIG51bUJ5dGVzV3JpdHRlbiA9IGF3YWl0IHRoaXMuI3dyaXRlci53cml0ZShkYXRhKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgIGlmIChlIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgICAgIHRoaXMuZXJyID0gZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbnVtQnl0ZXNXcml0dGVuID0gY29weShkYXRhLCB0aGlzLmJ1ZiwgdGhpcy51c2VkQnVmZmVyQnl0ZXMpO1xuICAgICAgICB0aGlzLnVzZWRCdWZmZXJCeXRlcyArPSBudW1CeXRlc1dyaXR0ZW47XG4gICAgICAgIGF3YWl0IHRoaXMuZmx1c2goKTtcbiAgICAgIH1cbiAgICAgIHRvdGFsQnl0ZXNXcml0dGVuICs9IG51bUJ5dGVzV3JpdHRlbjtcbiAgICAgIGRhdGEgPSBkYXRhLnN1YmFycmF5KG51bUJ5dGVzV3JpdHRlbik7XG4gICAgfVxuXG4gICAgbnVtQnl0ZXNXcml0dGVuID0gY29weShkYXRhLCB0aGlzLmJ1ZiwgdGhpcy51c2VkQnVmZmVyQnl0ZXMpO1xuICAgIHRoaXMudXNlZEJ1ZmZlckJ5dGVzICs9IG51bUJ5dGVzV3JpdHRlbjtcbiAgICB0b3RhbEJ5dGVzV3JpdHRlbiArPSBudW1CeXRlc1dyaXR0ZW47XG4gICAgcmV0dXJuIHRvdGFsQnl0ZXNXcml0dGVuO1xuICB9XG59XG5cbi8qKiBCdWZXcml0ZXJTeW5jIGltcGxlbWVudHMgYnVmZmVyaW5nIGZvciBhIGRlbm8uV3JpdGVyU3luYyBvYmplY3QuXG4gKiBJZiBhbiBlcnJvciBvY2N1cnMgd3JpdGluZyB0byBhIFdyaXRlclN5bmMsIG5vIG1vcmUgZGF0YSB3aWxsIGJlXG4gKiBhY2NlcHRlZCBhbmQgYWxsIHN1YnNlcXVlbnQgd3JpdGVzLCBhbmQgZmx1c2goKSwgd2lsbCByZXR1cm4gdGhlIGVycm9yLlxuICogQWZ0ZXIgYWxsIGRhdGEgaGFzIGJlZW4gd3JpdHRlbiwgdGhlIGNsaWVudCBzaG91bGQgY2FsbCB0aGVcbiAqIGZsdXNoKCkgbWV0aG9kIHRvIGd1YXJhbnRlZSBhbGwgZGF0YSBoYXMgYmVlbiBmb3J3YXJkZWQgdG9cbiAqIHRoZSB1bmRlcmx5aW5nIGRlbm8uV3JpdGVyU3luYy5cbiAqL1xuZXhwb3J0IGNsYXNzIEJ1ZldyaXRlclN5bmMgZXh0ZW5kcyBBYnN0cmFjdEJ1ZkJhc2UgaW1wbGVtZW50cyBXcml0ZXJTeW5jIHtcbiAgI3dyaXRlcjogV3JpdGVyU3luYztcblxuICAvKiogcmV0dXJuIG5ldyBCdWZXcml0ZXJTeW5jIHVubGVzcyB3cml0ZXIgaXMgQnVmV3JpdGVyU3luYyAqL1xuICBzdGF0aWMgY3JlYXRlKFxuICAgIHdyaXRlcjogV3JpdGVyU3luYyxcbiAgICBzaXplOiBudW1iZXIgPSBERUZBVUxUX0JVRl9TSVpFLFxuICApOiBCdWZXcml0ZXJTeW5jIHtcbiAgICByZXR1cm4gd3JpdGVyIGluc3RhbmNlb2YgQnVmV3JpdGVyU3luY1xuICAgICAgPyB3cml0ZXJcbiAgICAgIDogbmV3IEJ1ZldyaXRlclN5bmMod3JpdGVyLCBzaXplKTtcbiAgfVxuXG4gIGNvbnN0cnVjdG9yKHdyaXRlcjogV3JpdGVyU3luYywgc2l6ZTogbnVtYmVyID0gREVGQVVMVF9CVUZfU0laRSkge1xuICAgIHN1cGVyKG5ldyBVaW50OEFycmF5KHNpemUgPD0gMCA/IERFRkFVTFRfQlVGX1NJWkUgOiBzaXplKSk7XG4gICAgdGhpcy4jd3JpdGVyID0gd3JpdGVyO1xuICB9XG5cbiAgLyoqIERpc2NhcmRzIGFueSB1bmZsdXNoZWQgYnVmZmVyZWQgZGF0YSwgY2xlYXJzIGFueSBlcnJvciwgYW5kXG4gICAqIHJlc2V0cyBidWZmZXIgdG8gd3JpdGUgaXRzIG91dHB1dCB0byB3LlxuICAgKi9cbiAgcmVzZXQodzogV3JpdGVyU3luYykge1xuICAgIHRoaXMuZXJyID0gbnVsbDtcbiAgICB0aGlzLnVzZWRCdWZmZXJCeXRlcyA9IDA7XG4gICAgdGhpcy4jd3JpdGVyID0gdztcbiAgfVxuXG4gIC8qKiBGbHVzaCB3cml0ZXMgYW55IGJ1ZmZlcmVkIGRhdGEgdG8gdGhlIHVuZGVybHlpbmcgaW8uV3JpdGVyU3luYy4gKi9cbiAgZmx1c2goKSB7XG4gICAgaWYgKHRoaXMuZXJyICE9PSBudWxsKSB0aHJvdyB0aGlzLmVycjtcbiAgICBpZiAodGhpcy51c2VkQnVmZmVyQnl0ZXMgPT09IDApIHJldHVybjtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBwID0gdGhpcy5idWYuc3ViYXJyYXkoMCwgdGhpcy51c2VkQnVmZmVyQnl0ZXMpO1xuICAgICAgbGV0IG53cml0dGVuID0gMDtcbiAgICAgIHdoaWxlIChud3JpdHRlbiA8IHAubGVuZ3RoKSB7XG4gICAgICAgIG53cml0dGVuICs9IHRoaXMuI3dyaXRlci53cml0ZVN5bmMocC5zdWJhcnJheShud3JpdHRlbikpO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmIChlIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhpcy5lcnIgPSBlO1xuICAgICAgfVxuICAgICAgdGhyb3cgZTtcbiAgICB9XG5cbiAgICB0aGlzLmJ1ZiA9IG5ldyBVaW50OEFycmF5KHRoaXMuYnVmLmxlbmd0aCk7XG4gICAgdGhpcy51c2VkQnVmZmVyQnl0ZXMgPSAwO1xuICB9XG5cbiAgLyoqIFdyaXRlcyB0aGUgY29udGVudHMgb2YgYGRhdGFgIGludG8gdGhlIGJ1ZmZlci4gIElmIHRoZSBjb250ZW50cyB3b24ndCBmdWxseVxuICAgKiBmaXQgaW50byB0aGUgYnVmZmVyLCB0aG9zZSBieXRlcyB0aGF0IGNhbiBhcmUgY29waWVkIGludG8gdGhlIGJ1ZmZlciwgdGhlXG4gICAqIGJ1ZmZlciBpcyB0aGUgZmx1c2hlZCB0byB0aGUgd3JpdGVyIGFuZCB0aGUgcmVtYWluaW5nIGJ5dGVzIGFyZSBjb3BpZWQgaW50b1xuICAgKiB0aGUgbm93IGVtcHR5IGJ1ZmZlci5cbiAgICpcbiAgICogQHJldHVybiB0aGUgbnVtYmVyIG9mIGJ5dGVzIHdyaXR0ZW4gdG8gdGhlIGJ1ZmZlci5cbiAgICovXG4gIHdyaXRlU3luYyhkYXRhOiBVaW50OEFycmF5KTogbnVtYmVyIHtcbiAgICBpZiAodGhpcy5lcnIgIT09IG51bGwpIHRocm93IHRoaXMuZXJyO1xuICAgIGlmIChkYXRhLmxlbmd0aCA9PT0gMCkgcmV0dXJuIDA7XG5cbiAgICBsZXQgdG90YWxCeXRlc1dyaXR0ZW4gPSAwO1xuICAgIGxldCBudW1CeXRlc1dyaXR0ZW4gPSAwO1xuICAgIHdoaWxlIChkYXRhLmJ5dGVMZW5ndGggPiB0aGlzLmF2YWlsYWJsZSgpKSB7XG4gICAgICBpZiAodGhpcy5idWZmZXJlZCgpID09PSAwKSB7XG4gICAgICAgIC8vIExhcmdlIHdyaXRlLCBlbXB0eSBidWZmZXIuXG4gICAgICAgIC8vIFdyaXRlIGRpcmVjdGx5IGZyb20gZGF0YSB0byBhdm9pZCBjb3B5LlxuICAgICAgICB0cnkge1xuICAgICAgICAgIG51bUJ5dGVzV3JpdHRlbiA9IHRoaXMuI3dyaXRlci53cml0ZVN5bmMoZGF0YSk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICBpZiAoZSBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgICAgICB0aGlzLmVyciA9IGU7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRocm93IGU7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG51bUJ5dGVzV3JpdHRlbiA9IGNvcHkoZGF0YSwgdGhpcy5idWYsIHRoaXMudXNlZEJ1ZmZlckJ5dGVzKTtcbiAgICAgICAgdGhpcy51c2VkQnVmZmVyQnl0ZXMgKz0gbnVtQnl0ZXNXcml0dGVuO1xuICAgICAgICB0aGlzLmZsdXNoKCk7XG4gICAgICB9XG4gICAgICB0b3RhbEJ5dGVzV3JpdHRlbiArPSBudW1CeXRlc1dyaXR0ZW47XG4gICAgICBkYXRhID0gZGF0YS5zdWJhcnJheShudW1CeXRlc1dyaXR0ZW4pO1xuICAgIH1cblxuICAgIG51bUJ5dGVzV3JpdHRlbiA9IGNvcHkoZGF0YSwgdGhpcy5idWYsIHRoaXMudXNlZEJ1ZmZlckJ5dGVzKTtcbiAgICB0aGlzLnVzZWRCdWZmZXJCeXRlcyArPSBudW1CeXRlc1dyaXR0ZW47XG4gICAgdG90YWxCeXRlc1dyaXR0ZW4gKz0gbnVtQnl0ZXNXcml0dGVuO1xuICAgIHJldHVybiB0b3RhbEJ5dGVzV3JpdHRlbjtcbiAgfVxufVxuXG4vKiogR2VuZXJhdGUgbG9uZ2VzdCBwcm9wZXIgcHJlZml4IHdoaWNoIGlzIGFsc28gc3VmZml4IGFycmF5LiAqL1xuZnVuY3Rpb24gY3JlYXRlTFBTKHBhdDogVWludDhBcnJheSk6IFVpbnQ4QXJyYXkge1xuICBjb25zdCBscHMgPSBuZXcgVWludDhBcnJheShwYXQubGVuZ3RoKTtcbiAgbHBzWzBdID0gMDtcbiAgbGV0IHByZWZpeEVuZCA9IDA7XG4gIGxldCBpID0gMTtcbiAgd2hpbGUgKGkgPCBscHMubGVuZ3RoKSB7XG4gICAgaWYgKHBhdFtpXSA9PSBwYXRbcHJlZml4RW5kXSkge1xuICAgICAgcHJlZml4RW5kKys7XG4gICAgICBscHNbaV0gPSBwcmVmaXhFbmQ7XG4gICAgICBpKys7XG4gICAgfSBlbHNlIGlmIChwcmVmaXhFbmQgPT09IDApIHtcbiAgICAgIGxwc1tpXSA9IDA7XG4gICAgICBpKys7XG4gICAgfSBlbHNlIHtcbiAgICAgIHByZWZpeEVuZCA9IGxwc1twcmVmaXhFbmQgLSAxXTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGxwcztcbn1cblxuLyoqIFJlYWQgZGVsaW1pdGVkIGJ5dGVzIGZyb20gYSBSZWFkZXIuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24qIHJlYWREZWxpbShcbiAgcmVhZGVyOiBSZWFkZXIsXG4gIGRlbGltOiBVaW50OEFycmF5LFxuKTogQXN5bmNJdGVyYWJsZUl0ZXJhdG9yPFVpbnQ4QXJyYXk+IHtcbiAgLy8gQXZvaWQgdW5pY29kZSBwcm9ibGVtc1xuICBjb25zdCBkZWxpbUxlbiA9IGRlbGltLmxlbmd0aDtcbiAgY29uc3QgZGVsaW1MUFMgPSBjcmVhdGVMUFMoZGVsaW0pO1xuICBjb25zdCBjaHVua3MgPSBuZXcgQnl0ZXNMaXN0KCk7XG4gIGNvbnN0IGJ1ZlNpemUgPSBNYXRoLm1heCgxMDI0LCBkZWxpbUxlbiArIDEpO1xuXG4gIC8vIE1vZGlmaWVkIEtNUFxuICBsZXQgaW5zcGVjdEluZGV4ID0gMDtcbiAgbGV0IG1hdGNoSW5kZXggPSAwO1xuICB3aGlsZSAodHJ1ZSkge1xuICAgIGNvbnN0IGluc3BlY3RBcnIgPSBuZXcgVWludDhBcnJheShidWZTaXplKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZWFkZXIucmVhZChpbnNwZWN0QXJyKTtcbiAgICBpZiAocmVzdWx0ID09PSBudWxsKSB7XG4gICAgICAvLyBZaWVsZCBsYXN0IGNodW5rLlxuICAgICAgeWllbGQgY2h1bmtzLmNvbmNhdCgpO1xuICAgICAgcmV0dXJuO1xuICAgIH0gZWxzZSBpZiAocmVzdWx0IDwgMCkge1xuICAgICAgLy8gRGlzY2FyZCBhbGwgcmVtYWluaW5nIGFuZCBzaWxlbnRseSBmYWlsLlxuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjaHVua3MuYWRkKGluc3BlY3RBcnIsIDAsIHJlc3VsdCk7XG4gICAgbGV0IGxvY2FsSW5kZXggPSAwO1xuICAgIHdoaWxlIChpbnNwZWN0SW5kZXggPCBjaHVua3Muc2l6ZSgpKSB7XG4gICAgICBpZiAoaW5zcGVjdEFycltsb2NhbEluZGV4XSA9PT0gZGVsaW1bbWF0Y2hJbmRleF0pIHtcbiAgICAgICAgaW5zcGVjdEluZGV4Kys7XG4gICAgICAgIGxvY2FsSW5kZXgrKztcbiAgICAgICAgbWF0Y2hJbmRleCsrO1xuICAgICAgICBpZiAobWF0Y2hJbmRleCA9PT0gZGVsaW1MZW4pIHtcbiAgICAgICAgICAvLyBGdWxsIG1hdGNoXG4gICAgICAgICAgY29uc3QgbWF0Y2hFbmQgPSBpbnNwZWN0SW5kZXggLSBkZWxpbUxlbjtcbiAgICAgICAgICBjb25zdCByZWFkeUJ5dGVzID0gY2h1bmtzLnNsaWNlKDAsIG1hdGNoRW5kKTtcbiAgICAgICAgICB5aWVsZCByZWFkeUJ5dGVzO1xuICAgICAgICAgIC8vIFJlc2V0IG1hdGNoLCBkaWZmZXJlbnQgZnJvbSBLTVAuXG4gICAgICAgICAgY2h1bmtzLnNoaWZ0KGluc3BlY3RJbmRleCk7XG4gICAgICAgICAgaW5zcGVjdEluZGV4ID0gMDtcbiAgICAgICAgICBtYXRjaEluZGV4ID0gMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKG1hdGNoSW5kZXggPT09IDApIHtcbiAgICAgICAgICBpbnNwZWN0SW5kZXgrKztcbiAgICAgICAgICBsb2NhbEluZGV4Kys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbWF0Y2hJbmRleCA9IGRlbGltTFBTW21hdGNoSW5kZXggLSAxXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vKiogUmVhZCBkZWxpbWl0ZWQgc3RyaW5ncyBmcm9tIGEgUmVhZGVyLiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uKiByZWFkU3RyaW5nRGVsaW0oXG4gIHJlYWRlcjogUmVhZGVyLFxuICBkZWxpbTogc3RyaW5nLFxuICBkZWNvZGVyT3B0cz86IHtcbiAgICBlbmNvZGluZz86IHN0cmluZztcbiAgICBmYXRhbD86IGJvb2xlYW47XG4gICAgaWdub3JlQk9NPzogYm9vbGVhbjtcbiAgfSxcbik6IEFzeW5jSXRlcmFibGVJdGVyYXRvcjxzdHJpbmc+IHtcbiAgY29uc3QgZW5jb2RlciA9IG5ldyBUZXh0RW5jb2RlcigpO1xuICBjb25zdCBkZWNvZGVyID0gbmV3IFRleHREZWNvZGVyKGRlY29kZXJPcHRzPy5lbmNvZGluZywgZGVjb2Rlck9wdHMpO1xuICBmb3IgYXdhaXQgKGNvbnN0IGNodW5rIG9mIHJlYWREZWxpbShyZWFkZXIsIGVuY29kZXIuZW5jb2RlKGRlbGltKSkpIHtcbiAgICB5aWVsZCBkZWNvZGVyLmRlY29kZShjaHVuayk7XG4gIH1cbn1cblxuLyoqIFJlYWQgc3RyaW5ncyBsaW5lLWJ5LWxpbmUgZnJvbSBhIFJlYWRlci4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiogcmVhZExpbmVzKFxuICByZWFkZXI6IFJlYWRlcixcbiAgZGVjb2Rlck9wdHM/OiB7XG4gICAgZW5jb2Rpbmc/OiBzdHJpbmc7XG4gICAgZmF0YWw/OiBib29sZWFuO1xuICAgIGlnbm9yZUJPTT86IGJvb2xlYW47XG4gIH0sXG4pOiBBc3luY0l0ZXJhYmxlSXRlcmF0b3I8c3RyaW5nPiB7XG4gIGNvbnN0IGJ1ZlJlYWRlciA9IG5ldyBCdWZSZWFkZXIocmVhZGVyKTtcbiAgbGV0IGNodW5rczogVWludDhBcnJheVtdID0gW107XG4gIGNvbnN0IGRlY29kZXIgPSBuZXcgVGV4dERlY29kZXIoZGVjb2Rlck9wdHM/LmVuY29kaW5nLCBkZWNvZGVyT3B0cyk7XG4gIHdoaWxlICh0cnVlKSB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgYnVmUmVhZGVyLnJlYWRMaW5lKCk7XG4gICAgaWYgKCFyZXMpIHtcbiAgICAgIGlmIChjaHVua3MubGVuZ3RoID4gMCkge1xuICAgICAgICB5aWVsZCBkZWNvZGVyLmRlY29kZShjb25jYXQoLi4uY2h1bmtzKSk7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgY2h1bmtzLnB1c2gocmVzLmxpbmUpO1xuICAgIGlmICghcmVzLm1vcmUpIHtcbiAgICAgIHlpZWxkIGRlY29kZXIuZGVjb2RlKGNvbmNhdCguLi5jaHVua3MpKTtcbiAgICAgIGNodW5rcyA9IFtdO1xuICAgIH1cbiAgfVxufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUMxRSxTQUFTLE1BQU0sUUFBUSxxQkFBcUI7QUFDNUMsU0FBUyxTQUFTLFFBQVEseUJBQXlCO0FBQ25ELFNBQVMsTUFBTSxFQUFFLElBQUksUUFBUSxrQkFBa0I7QUFHL0Msb0VBQW9FO0FBQ3BFLDRFQUE0RTtBQUM1RSwyRUFBMkU7QUFDM0UscUJBQXFCO0FBQ3JCLE1BQU0sV0FBVyxLQUFLO0FBQ3RCLE1BQU0sV0FBVyxLQUFLLEtBQUs7QUFFM0I7Ozs7Ozs7Ozs7Ozs7K0RBYStELEdBRS9ELE9BQU8sTUFBTTtFQUNYLENBQUEsR0FBSSxDQUFhO0VBQ2pCLENBQUEsR0FBSSxHQUFHLEVBQUU7RUFFVCxZQUFZLEVBQXdDLENBQUU7SUFDcEQsSUFBSSxDQUFDLENBQUEsR0FBSSxHQUFHLE9BQU8sWUFBWSxJQUFJLFdBQVcsS0FBSyxJQUFJLFdBQVc7RUFDcEU7RUFFQTs7Ozs7Ozs7R0FRQyxHQUNELE1BQU0sVUFBVTtJQUFFLE1BQU07RUFBSyxDQUFDLEVBQWM7SUFDMUMsSUFBSSxRQUFRLElBQUksS0FBSyxPQUFPLE9BQU8sSUFBSSxDQUFDLENBQUEsR0FBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQSxHQUFJO0lBQy9ELE9BQU8sSUFBSSxDQUFDLENBQUEsR0FBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQSxHQUFJO0VBQ2xDO0VBRUEsK0RBQStELEdBQy9ELFFB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
// denoCacheMetadata=3493648152138319848,13877145776154930327