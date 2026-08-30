export interface DedicatedWorkerSet {
  readonly render: Worker;
  readonly storage: Worker;
  dispose(): void;
}

function installStorageWorkerStatus(storage: Worker): () => void {
  const root = document.documentElement;
  const listener = (event: MessageEvent<unknown>): void => {
    const message = event.data;
    if (typeof message !== 'object' || message === null || !('type' in message)) return;
    if (message.type === 'worker.storage.ready') {
      root.dataset.illustroStorage = 'ready';
      return;
    }
    if (message.type === 'worker.storage.error') {
      root.dataset.illustroStorage = 'error';
    }
  };
  storage.addEventListener('message', listener);
  return () => storage.removeEventListener('message', listener);
}

export function startDedicatedWorkers(): DedicatedWorkerSet {
  const render = new Worker(new URL('../workers/render.worker.js', import.meta.url), {
    type: 'module',
    name: 'illustro-render',
  });
  const storage = new Worker(new URL('../workers/storage.worker.js', import.meta.url), {
    type: 'module',
    name: 'illustro-storage',
  });
  const removeStorageStatusListener = installStorageWorkerStatus(storage);

  return {
    render,
    storage,
    dispose() {
      removeStorageStatusListener();
      render.terminate();
      storage.terminate();
    },
  };
}
