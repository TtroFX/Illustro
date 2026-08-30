type WorkerMessageEvent<T> = { readonly data: T };
type WorkerScope = {
  addEventListener(type: 'message', listener: (event: WorkerMessageEvent<unknown>) => void): void;
  postMessage(message: unknown): void;
};

const scope = globalThis as unknown as WorkerScope;

scope.addEventListener('message', (event) => {
  const message = event.data;
  if (typeof message === 'object' && message !== null && 'type' in message && message.type === 'ping') {
    scope.postMessage({ type: 'pong', subsystem: 'storage' });
  }
});

scope.postMessage({ type: 'worker.storage.ready' });
