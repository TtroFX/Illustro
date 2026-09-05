export function gpuHarness() {
  let drawCalls = 0;
  let renderPasses = 0;
  let submits = 0;
  let textureCopies = 0;
  let textureWrites = 0;
  let bufferCreates = 0;
  let bufferDestroys = 0;
  const instanceCounts: number[] = [];
  const bufferWrites: number[] = [];
  const loadOps: Array<'clear' | 'load'> = [];
  const device = {
    lost: new Promise<never>(() => undefined),
    createShaderModule() {
      return {};
    },
    createRenderPipeline() {
      return {};
    },
    createBuffer(descriptor: { readonly size: number }) {
      bufferCreates += 1;
      return {
        descriptor,
        destroy() {
          bufferDestroys += 1;
        },
      };
    },
    createTexture() {
      return {
        createView() {
          return {};
        },
        destroy() {},
      };
    },
    createCommandEncoder() {
      return {
        beginRenderPass(descriptor: {
          readonly colorAttachments: readonly [
            {
              readonly loadOp: 'clear' | 'load';
            },
          ];
        }) {
          renderPasses += 1;
          loadOps.push(descriptor.colorAttachments[0].loadOp);
          return {
            setPipeline() {},
            setVertexBuffer() {},
            draw(_vertexCount: number, nextInstanceCount: number) {
              drawCalls += 1;
              instanceCounts.push(nextInstanceCount);
            },
            end() {},
          };
        },
        copyTextureToTexture() {
          textureCopies += 1;
        },
        finish() {
          return {};
        },
      };
    },
    queue: {
      writeBuffer(_buffer: object, _offset: number, values: Float32Array) {
        bufferWrites.push(values.length);
      },
      writeTexture() {
        textureWrites += 1;
      },
      submit() {
        submits += 1;
      },
    },
  };
  const surface = {
    width: 512,
    height: 256,
    getContext(contextId: string) {
      if (contextId !== 'webgpu') return null;
      return {
        getCurrentTexture() {
          return { createView: () => ({}) };
        },
      };
    },
  };
  const reset = (): void => {
    drawCalls = 0;
    renderPasses = 0;
    submits = 0;
    textureCopies = 0;
    textureWrites = 0;
    bufferCreates = 0;
    bufferDestroys = 0;
    instanceCounts.length = 0;
    bufferWrites.length = 0;
    loadOps.length = 0;
  };
  return {
    device,
    surface,
    reset,
    bufferCounts: () => ({ creates: bufferCreates, destroys: bufferDestroys }),
    counts: () => ({
      drawCalls,
      renderPasses,
      submits,
      textureCopies,
      textureWrites,
      instanceCounts: [...instanceCounts],
      bufferWrites: [...bufferWrites],
      loadOps: [...loadOps],
    }),
  };
}
