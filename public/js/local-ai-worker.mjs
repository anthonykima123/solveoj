import { WebWorkerMLCEngineHandler } from '/vendor/web-llm-0.2.89.js';

const handler = new WebWorkerMLCEngineHandler();
self.addEventListener('message', event => handler.onmessage(event));
