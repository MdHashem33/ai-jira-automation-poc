import OpenAI, { AzureOpenAI } from 'openai';

export type Task =
  | 'dispatch'
  | 'extract'
  | 'draft_reply'
  | 'summarize'
  | 'reason';

export type Provider = 'openai' | 'anthropic';

export interface CallOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface ModelResponse {
  text: string;
  model: string;
  provider: Provider;
  latencyMs: number;
  usage?: { inputTokens?: number; outputTokens?: number };
  costUsd?: number;
}

// Public pricing per 1M tokens, USD (approximate). Update when rates change.
// Source: vendor pricing pages. These are estimates for cost-per-ticket reporting.
const PRICING_PER_1M: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-5.4-mini': { input: 0.20, output: 0.80 },
  'claude-haiku-4-5': { input: 0.25, output: 1.25 },
  'claude-sonnet-4-6': { input: 3.00, output: 15.00 },
  'claude-opus-4-7': { input: 15.00, output: 75.00 },
};

function estimateCostUsd(model: string, inputTokens?: number, outputTokens?: number): number | undefined {
  if (!inputTokens && !outputTokens) return undefined;
  const rate = PRICING_PER_1M[model] ?? PRICING_PER_1M['gpt-4o-mini'];
  const cost = ((inputTokens ?? 0) * rate.input + (outputTokens ?? 0) * rate.output) / 1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

interface Route {
  provider: Provider;
  model: string;
  defaults: CallOptions;
}

function isAzure(): boolean {
  return Boolean(process.env.AZURE_OPENAI_ENDPOINT);
}

function deploymentForTask(task: Task): string | undefined {
  // Sage Franch's reviewer-must-be-different-model rule (April 24 office hours):
  // when verifying another agent's output, the Judge should run on a different
  // deployment from the Generator. Configure AZURE_OPENAI_JUDGE_DEPLOYMENT to a
  // separately-deployed model to satisfy the rule. If unset, falls back to the
  // primary deployment with a console warning the first time it runs.
  if (task === 'extract' || task === 'reason') {
    return process.env.AZURE_OPENAI_JUDGE_DEPLOYMENT || process.env.AZURE_OPENAI_DEPLOYMENT;
  }
  return process.env.AZURE_OPENAI_DEPLOYMENT;
}

function routeForTask(task: Task): Route {
  const provider = (process.env.AI_PROVIDER as Provider) || 'openai';

  if (provider === 'anthropic') {
    switch (task) {
      case 'dispatch':
      case 'extract':
        return { provider, model: 'claude-haiku-4-5', defaults: { temperature: 0.1, maxTokens: 800, jsonMode: true } };
      case 'draft_reply':
      case 'summarize':
        return { provider, model: 'claude-sonnet-4-6', defaults: { temperature: 0.3, maxTokens: 1500 } };
      case 'reason':
        return { provider, model: 'claude-opus-4-7', defaults: { temperature: 0.2, maxTokens: 2000 } };
    }
  }

  // Azure mode: the "model" in the SDK call is ignored; deployment is bound at client level.
  // The deployment for each task is resolved separately so we can route the Judge to
  // a different model from the dispatcher per the reviewer-must-be-different rule.
  const taskDeployment = deploymentForTask(task);
  const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const model = isAzure() ? (taskDeployment || 'gpt-4o-mini') : openaiModel;

  switch (task) {
    case 'dispatch':
      return { provider: 'openai', model, defaults: { temperature: 0.1, maxTokens: 800, jsonMode: true } };
    case 'extract':
      return { provider: 'openai', model, defaults: { temperature: 0.1, maxTokens: 800, jsonMode: true } };
    case 'draft_reply':
    case 'summarize':
      return { provider: 'openai', model, defaults: { temperature: 0.3, maxTokens: 1500 } };
    case 'reason':
      return { provider: 'openai', model: isAzure() ? (taskDeployment || 'gpt-4o-mini') : 'gpt-4o', defaults: { temperature: 0.2, maxTokens: 2000 } };
  }
}

const azureClients: Record<string, OpenAI> = {};
let openaiClient: OpenAI | null = null;
function getOpenAI(deployment?: string): OpenAI {
  if (isAzure()) {
    const key = deployment || process.env.AZURE_OPENAI_DEPLOYMENT || 'default';
    if (!azureClients[key]) {
      azureClients[key] = new AzureOpenAI({
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        apiKey: process.env.OPENAI_API_KEY || '',
        apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-10-21',
        deployment: key,
      });
    }
    return azureClients[key];
  }
  if (!openaiClient) openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });
  return openaiClient;
}

export async function callModel(
  task: Task,
  system: string,
  user: string,
  opts: CallOptions = {}
): Promise<ModelResponse> {
  const route = routeForTask(task);
  const merged = { ...route.defaults, ...opts };
  const started = Date.now();

  if (route.provider === 'openai') {
    const client = getOpenAI(route.model);
    const response = await client.chat.completions.create({
      model: route.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: merged.temperature,
      max_completion_tokens: merged.maxTokens,
      ...(merged.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    });
    const text = response.choices[0]?.message?.content ?? '';
    const inputTokens = response.usage?.prompt_tokens;
    const outputTokens = response.usage?.completion_tokens;
    return {
      text,
      model: route.model,
      provider: 'openai',
      latencyMs: Date.now() - started,
      usage: { inputTokens, outputTokens },
      costUsd: estimateCostUsd(route.model, inputTokens, outputTokens),
    };
  }

  throw new Error(
    `Anthropic provider selected but @anthropic-ai/sdk is not wired up yet. ` +
      `To enable: \`npm install @anthropic-ai/sdk\`, set ANTHROPIC_API_KEY, and extend client.ts with the Anthropic branch.`
  );
}

export function isConfigured(): { openai: boolean; anthropic: boolean } {
  return {
    openai: Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-your-openai-api-key-here'),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
  };
}
