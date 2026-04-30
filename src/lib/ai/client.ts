import OpenAI, { AzureOpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export type Task =
  | 'dispatch'
  | 'extract'
  | 'draft_reply'
  | 'summarize'
  | 'reason';

export type Provider = 'openai' | 'anthropic';

/**
 * A piece of prompt content. When `cache: true` is set on a segment, the segment
 * is marked as cacheable on the Anthropic API (cache_control: ephemeral). For
 * OpenAI/Azure, segments are concatenated and OpenAI's automatic prompt-prefix
 * caching handles long stable prefixes without explicit markers.
 */
export interface ContentSegment {
  text: string;
  cache?: boolean;
}

export type Content = string | ContentSegment[];

export interface JsonSchemaOption {
  name: string;
  schema: Record<string, unknown>;
}

export interface CallOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  jsonSchema?: JsonSchemaOption; // strict schema mode (OpenAI) or matched on Anthropic
}

export interface ModelResponse {
  text: string;
  model: string;
  provider: Provider;
  latencyMs: number;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    cacheReadInputTokens?: number;
    cacheCreationInputTokens?: number;
  };
  costUsd?: number;
}

// Public pricing per 1M tokens, USD (approximate). Update when rates change.
const PRICING_PER_1M: Record<string, { input: number; output: number; cachedInput?: number; cacheWriteInput?: number }> = {
  'gpt-4o-mini': { input: 0.15, output: 0.60, cachedInput: 0.075 },
  'gpt-4o': { input: 2.50, output: 10.00, cachedInput: 1.25 },
  'gpt-5.4-mini': { input: 0.20, output: 0.80, cachedInput: 0.10 },
  // Anthropic: cached read 0.1x base input; cache write 1.25x base input
  'claude-haiku-4-5': { input: 0.25, output: 1.25, cachedInput: 0.025, cacheWriteInput: 0.3125 },
  'claude-sonnet-4-6': { input: 3.00, output: 15.00, cachedInput: 0.30, cacheWriteInput: 3.75 },
  'claude-opus-4-7': { input: 15.00, output: 75.00, cachedInput: 1.50, cacheWriteInput: 18.75 },
};

function estimateCostUsd(
  model: string,
  inputTokens?: number,
  outputTokens?: number,
  cacheReadInputTokens?: number,
  cacheCreationInputTokens?: number,
): number | undefined {
  if (!inputTokens && !outputTokens && !cacheReadInputTokens && !cacheCreationInputTokens) return undefined;
  const rate = PRICING_PER_1M[model] ?? PRICING_PER_1M['gpt-4o-mini'];
  const cachedInputRate = rate.cachedInput ?? rate.input * 0.5;
  const cacheWriteRate = rate.cacheWriteInput ?? rate.input * 1.25;
  const cost =
    ((inputTokens ?? 0) * rate.input +
      (cacheReadInputTokens ?? 0) * cachedInputRate +
      (cacheCreationInputTokens ?? 0) * cacheWriteRate +
      (outputTokens ?? 0) * rate.output) /
    1_000_000;
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

function hasAnthropic(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function deploymentForTask(task: Task): string | undefined {
  if (task === 'extract' || task === 'reason') {
    return process.env.AZURE_OPENAI_JUDGE_DEPLOYMENT || process.env.AZURE_OPENAI_DEPLOYMENT;
  }
  return process.env.AZURE_OPENAI_DEPLOYMENT;
}

/**
 * Per Sage Franch's reviewer-must-be-different-model rule (April 24 office hours):
 * when ANTHROPIC_API_KEY is set, route the Judge ('extract') to Anthropic Claude
 * Haiku 4.5 even when the dispatcher runs on Azure OpenAI. Different vendor +
 * different model family = independent verification.
 */
function routeForTask(task: Task): Route {
  // Explicit override via env (e.g. AI_PROVIDER=anthropic forces all calls to Anthropic).
  const explicitProvider = process.env.AI_PROVIDER as Provider | undefined;

  // Auto-route Judge to Anthropic when both providers are available — closes the
  // reviewer-must-be-different gap without requiring users to set AI_PROVIDER manually.
  const useAnthropic =
    explicitProvider === 'anthropic' ||
    (task === 'extract' && hasAnthropic() && !explicitProvider);

  if (useAnthropic) {
    switch (task) {
      case 'dispatch':
      case 'extract':
        return { provider: 'anthropic', model: 'claude-haiku-4-5', defaults: { temperature: 0.1, maxTokens: 800, jsonMode: true } };
      case 'draft_reply':
      case 'summarize':
        return { provider: 'anthropic', model: 'claude-sonnet-4-6', defaults: { temperature: 0.3, maxTokens: 1500 } };
      case 'reason':
        return { provider: 'anthropic', model: 'claude-opus-4-7', defaults: { temperature: 0.2, maxTokens: 2000 } };
    }
  }

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
let anthropicClient: Anthropic | null = null;

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

function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
  }
  return anthropicClient;
}

function contentToString(content: Content): string {
  return typeof content === 'string' ? content : content.map((s) => s.text).join('\n\n');
}

function toAnthropicBlocks(content: Content): Anthropic.Messages.TextBlockParam[] {
  if (typeof content === 'string') return [{ type: 'text', text: content }];
  return content.map((seg) => {
    const block: Anthropic.Messages.TextBlockParam = { type: 'text', text: seg.text };
    if (seg.cache) block.cache_control = { type: 'ephemeral' };
    return block;
  });
}

export async function callModel(
  task: Task,
  system: Content,
  user: Content,
  opts: CallOptions = {}
): Promise<ModelResponse> {
  const route = routeForTask(task);
  const merged = { ...route.defaults, ...opts };
  const started = Date.now();

  if (route.provider === 'anthropic') {
    const client = getAnthropic();
    const systemBlocks = toAnthropicBlocks(system);
    const userBlocks = toAnthropicBlocks(user);
    const response = await client.messages.create({
      model: route.model,
      max_tokens: merged.maxTokens ?? 800,
      temperature: merged.temperature ?? 0.1,
      system: systemBlocks,
      messages: [{ role: 'user', content: userBlocks }],
    });
    const text = response.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const usage = response.usage;
    const inputTokens = usage?.input_tokens;
    const outputTokens = usage?.output_tokens;
    const cacheReadInputTokens = (usage as { cache_read_input_tokens?: number })?.cache_read_input_tokens;
    const cacheCreationInputTokens = (usage as { cache_creation_input_tokens?: number })?.cache_creation_input_tokens;
    return {
      text,
      model: route.model,
      provider: 'anthropic',
      latencyMs: Date.now() - started,
      usage: { inputTokens, outputTokens, cacheReadInputTokens, cacheCreationInputTokens },
      costUsd: estimateCostUsd(route.model, inputTokens, outputTokens, cacheReadInputTokens, cacheCreationInputTokens),
    };
  }

  // OpenAI / Azure path
  const client = getOpenAI(route.model);
  const systemString = contentToString(system);
  const userString = contentToString(user);

  const baseRequest = {
    model: route.model,
    messages: [
      { role: 'system' as const, content: systemString },
      { role: 'user' as const, content: userString },
    ],
    temperature: merged.temperature,
    max_completion_tokens: merged.maxTokens,
  };

  type ChatCreateParams = Parameters<typeof client.chat.completions.create>[0];
  let request: ChatCreateParams;
  if (merged.jsonSchema) {
    request = {
      ...baseRequest,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: merged.jsonSchema.name,
          schema: merged.jsonSchema.schema,
          strict: true,
        },
      },
    };
  } else if (merged.jsonMode) {
    request = { ...baseRequest, response_format: { type: 'json_object' } };
  } else {
    request = baseRequest;
  }

  // We never set stream:true so the response is the non-streaming ChatCompletion.
  const response = (await client.chat.completions.create(request)) as OpenAI.Chat.Completions.ChatCompletion;
  const text = response.choices[0]?.message?.content ?? '';
  const inputTokens = response.usage?.prompt_tokens;
  const outputTokens = response.usage?.completion_tokens;
  const cacheReadInputTokens = (response.usage as { prompt_tokens_details?: { cached_tokens?: number } } | undefined)?.prompt_tokens_details?.cached_tokens;
  return {
    text,
    model: route.model,
    provider: 'openai',
    latencyMs: Date.now() - started,
    usage: { inputTokens, outputTokens, cacheReadInputTokens },
    costUsd: estimateCostUsd(route.model, inputTokens, outputTokens, cacheReadInputTokens, 0),
  };
}

export function isConfigured(): { openai: boolean; anthropic: boolean } {
  return {
    openai: Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-your-openai-api-key-here'),
    anthropic: hasAnthropic(),
  };
}
