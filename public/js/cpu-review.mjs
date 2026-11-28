const MODEL_URL = 'https://huggingface.co/ggml-org/Qwen3-1.7B-GGUF/resolve/daeb8e2d528a760970442092f6bf1e55c3b659eb/Qwen3-1.7B-Q4_K_M.gguf';

export async function prepareCpuReview(signal, onProgress, onCreate) {
  const { Wllama } = await import('/vendor/wllama-4.0.0.js');
  signal.throwIfAborted();
  const client = new Wllama({ default: new URL('/vendor/wllama-4.0.0.wasm', location.origin).href });
  onCreate(client);
  await client.loadModelFromUrl(MODEL_URL, {
    n_gpu_layers: 0, n_ctx: 4096, n_threads: 1,
    progressCallback: ({ loaded, total }) => onProgress(total > 0 ? loaded / total : 0)
  });
  signal.throwIfAborted();
  return async (request, abortSignal) => client.createChatCompletion({
    messages: request.messages,
    temperature: 0.2, max_tokens: request.max_tokens, abortSignal,
    chat_template_kwargs: { enable_thinking: false },
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'solvex_review', schema: JSON.parse(request.response_format.schema), strict: true }
    }
  });
}
