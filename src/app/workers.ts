export interface DedicatedWorkerSet {
  readonly render: Worker;
  readonly storage: Worker;
  dispose(): void;
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

  return {
    render,
    storage,
    dispose() {
      render.terminate();
      storage.terminate();
    },
  };
}
