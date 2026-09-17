import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { streamPrompt } from '../../src/ai/providers.js';

/** A session whose promptStreaming yields an async-iterable of chunks. */
function asyncIterableSession(chunks) {
  return {
    promptStreaming() {
      return (async function* () { for (const c of chunks) yield c; })();
    }
  };
}

/** A session whose promptStreaming returns a ReadableStream-like reader. */
function readerSession(chunks) {
  return {
    promptStreaming() {
      let i = 0;
      return {
        getReader() {
          return {
            read: async () => (i < chunks.length ? { value: chunks[i++], done: false } : { value: undefined, done: true }),
            releaseLock() {}
          };
        }
      };
    }
  };
}

describe('streamPrompt', () => {
  test('incremental deltas are accumulated; onDelta gets the running total', async () => {
    const session = asyncIterableSession(['Hel', 'lo ', 'world']);
    const seen = [];
    const full = await streamPrompt(session, 'p', {}, (t) => seen.push(t));
    assert.equal(full, 'Hello world');
    assert.deepEqual(seen, ['Hel', 'Hello ', 'Hello world']); // cumulative
  });

  test('running-total streams are normalised (not double-concatenated)', async () => {
    // Some browsers emit the whole answer-so-far each chunk.
    const session = asyncIterableSession(['Hel', 'Hello ', 'Hello world']);
    const seen = [];
    const full = await streamPrompt(session, 'p', {}, (t) => seen.push(t));
    assert.equal(full, 'Hello world'); // not "HelHello Hello world"
    assert.deepEqual(seen, ['Hel', 'Hello ', 'Hello world']);
  });

  test('works with a ReadableStream-style reader', async () => {
    const session = readerSession(['{"summary":', '"ok"}']);
    const seen = [];
    const full = await streamPrompt(session, 'p', {}, (t) => seen.push(t));
    assert.equal(full, '{"summary":"ok"}');
    assert.equal(seen.at(-1), '{"summary":"ok"}');
  });

  test('a non-streamable return value still resolves to the whole text', async () => {
    const session = { promptStreaming: () => Promise.resolve('whole answer') };
    const seen = [];
    const full = await streamPrompt(session, 'p', {}, (t) => seen.push(t));
    assert.equal(full, 'whole answer');
    assert.deepEqual(seen, ['whole answer']);
  });
});
