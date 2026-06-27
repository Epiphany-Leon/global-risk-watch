// Pluggable AI providers. Every preset speaks the OpenAI-compatible
// Chat Completions protocol, so they all route through /api/report unchanged.
// Each provider keeps its OWN baseUrl / model / apiKey so switching the
// dropdown never clobbers another provider's key.

export interface ProviderConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface ProviderPreset {
  id: string;
  label: string; // shown in the dropdown
  baseUrl: string; // sensible default ("" when the user must supply it)
  model: string; // sensible default model name
  hint: string; // note rendered under the inputs
  keyUrl?: string; // where to obtain an API key
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "deepseek",
    label: "DeepSeek · 深度求索",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    hint: "OpenAI 兼容。Key 取自 platform.deepseek.com。",
    keyUrl: "https://platform.deepseek.com/api_keys",
  },
  {
    id: "glm",
    label: "GLM · 智谱清言",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4-plus",
    hint: "OpenAI 兼容。Key 取自 open.bigmodel.cn。",
    keyUrl: "https://open.bigmodel.cn/usercenter/apikeys",
  },
  {
    id: "mimo",
    label: "Xiaomi MiMo · 小米（Token Plan）",
    baseUrl: "",
    model: "mimo",
    hint: "填入你的 MiMo Token Plan Base URL 与模型名（需 OpenAI 兼容端点）。",
  },
];

export function presetById(id: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((p) => p.id === id);
}

// Fresh per-provider configs seeded from each preset's defaults.
export function defaultConfigs(): Record<string, ProviderConfig> {
  const out: Record<string, ProviderConfig> = {};
  for (const p of PROVIDER_PRESETS) {
    out[p.id] = { baseUrl: p.baseUrl, model: p.model, apiKey: "" };
  }
  return out;
}
