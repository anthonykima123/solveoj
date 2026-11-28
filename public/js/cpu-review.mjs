const MODEL_URL = 'https://huggingface.co/QuantFactory/Qwen3-0.6B-GGUF/resolve/e7e05d713acaa2baccdfb52e967eaba8ba562ba8/Qwen3-0.6B.Q3_K_S.gguf';

export async function prepareCpuReview(signal, onProgress, onCreate) {
  const { Wllama } = await import('/vendor/wllama-4.0.0.js');
  signal.throwIfAborted();
  const client = new Wllama({ default: new URL('/vendor/wllama-4.0.0.wasm', location.origin).href });
  onCreate(client);
  await client.loadModelFromUrl(MODEL_URL, {
    n_gpu_layers: 0, n_ctx: 4096, n_threads: 1, connections: 1, signal,
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
