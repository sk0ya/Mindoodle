import type { AISettings } from '../../mindmap/store/slices/aiSlice';


interface OllamaResponse {
  model: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}


interface OllamaRequest {
  model: string;
  prompt: string;
  system?: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    num_predict?: number;
    top_k?: number;
    top_p?: number;
  };
}


interface OllamaModelsResponse {
  models: Array<{
    name: string;
    modified_at: string;
    size: number;
    digest: string;
  }>;
}

export class OllamaService {
  private baseUrl: string;
  
  constructor(baseUrl?: string) {
    
    const defaultUrl = import.meta.env.VITE_OLLAMA_BASE_URL || 'http://localhost:11434';
    this.baseUrl = (baseUrl || defaultUrl).replace(/\/$/, ''); // 末尾のスラッシュを削除
  }
  
  /**
   * ブラウザ拡張機能が利用可能かチェック（リトライ機能付き）
   */
  private isExtensionAvailable(): boolean {
    return typeof window !== 'undefined' && 
           !!window.MindFlowOllamaBridge && 
           window.MindFlowOllamaBridge.available === true;
  }
  
  
  private async waitForExtension(maxWaitTime: number = 3000): Promise<boolean> {
    if (this.isExtensionAvailable()) {
      return true;
    }
    
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = maxWaitTime / 100; 
      
      const checkInterval = setInterval(() => {
        attempts++;
        
        if (this.isExtensionAvailable()) {
          clearInterval(checkInterval);
          
          resolve(true);
        } else if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          console.warn('⚠️ Extension not available after', maxWaitTime, 'ms');
          resolve(false);
        }
      }, 100);
    });
  }
  
  
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      
      const extensionAvailable = await this.waitForExtension();
      if (extensionAvailable && window.MindFlowOllamaBridge) {
        
        const result = await window.MindFlowOllamaBridge.testConnection(this.baseUrl);
        return result;
      }
      
      
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Ollama connection test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  
  async getAvailableModels(): Promise<string[]> {
    try {
      
      const extensionAvailable = await this.waitForExtension();
      if (extensionAvailable && window.MindFlowOllamaBridge) {
        
        const models = await window.MindFlowOllamaBridge.getModels(this.baseUrl);
        return models;
      }
      
      
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }
      
      const data: OllamaModelsResponse = await response.json();
      return data.models.map(model => model.name);
    } catch (error) {
      console.error('Failed to fetch available models:', error);
      throw new Error(`モデル一覧の取得に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  
  async generateText(
    prompt: string,
    settings: AISettings,
    systemPrompt?: string
  ): Promise<string> {
    try {
      const request: OllamaRequest = {
        model: settings.model,
        prompt,
        system: systemPrompt || settings.systemPrompt,
        stream: false,
        options: {
          temperature: settings.temperature,
          num_predict: settings.maxTokens,
          top_k: 40,
          top_p: 0.9,
        },
      };
      
      
      
      let response: Response | undefined;
      let data: OllamaResponse;
      
      
      const extensionAvailable = await this.waitForExtension();
      if (extensionAvailable && window.MindFlowOllamaBridge) {
        
        
        const result = await window.MindFlowOllamaBridge.request(
          `${this.baseUrl}/api/generate`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(request),
          }
        );
        
        
        if (!result.success) {
          throw new Error(`Extension request failed: ${result.error} (Status: ${result.status || 'unknown'})`);
        }
        
        data = result.data as OllamaResponse;
      } else {
        
        response = await fetch(`${this.baseUrl}/api/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        data = await response.json();
      }
      
      
      
      if (!data.response) {
        throw new Error('Empty response from Ollama');
      }
      
      return data.response.trim();
    } catch (error) {
      console.error('Ollama text generation failed:', error);
      throw new Error(`テキスト生成に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  
  async generateChildNodes(
    parentText: string,
    context: string,
    settings: AISettings
  ): Promise<string[]> {
    try {
      
      const prompt = settings.childGenerationPrompt
        .replace('{parentText}', parentText)
        .replace('{context}', context);
      
      
      
      const response = await this.generateText(prompt, settings);
      
      
      const childNodes = this.parseChildNodesResponse(response);
      
      
      
      return childNodes;
    } catch (error) {
      console.error('Child nodes generation failed:', error);
      throw error;
    }
  }
  
  
  private parseChildNodesResponse(response: string): string[] {
    
    const lines = response
      .split(/[\n,]/)  
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    const childNodes: string[] = [];
    
    for (const line of lines) {
      
      let cleanedLine = line
        .replace(/^\d+[.)]\s*/, '') // "1." や "1)" を除去
        .replace(/^[-*•→▶]\s*/, '')  // 各種リスト記号を除去
        .replace(/^[（(]?\d+[）)]\s*/, '') // "(1)" や "（1）" を除去
        .trim();
      
      // 引用符、かっこ、コロンを除去
      cleanedLine = cleanedLine
        .replace(/^["'「『【〈]/, '')
        .replace(/["'」』】〉]$/, '')
        .replace(/^[（(]/, '')
        .replace(/[）)]$/, '')
        .replace(/:$/, '') // 末尾のコロンを除去
        .trim();
      
      // 長すぎる項目は除外し、適切な長さのもののみ追加（最大4個まで）
      if (cleanedLine && cleanedLine.length <= 15 && cleanedLine.length >= 1 && childNodes.length < 4) {
        childNodes.push(cleanedLine);
      }
    }
    
    // 最低1つは返す（生成に失敗した場合のフォールバック）
    if (childNodes.length === 0) {
      childNodes.push('関連項目');
    }
    
    return childNodes;
  }
}

// シングルトンインスタンス
let ollamaService: OllamaService | null = null;

/**
 * OllamaServiceのシングルトンインスタンスを取得する
 */
export function getOllamaService(baseUrl?: string): OllamaService {
  // baseURLが提供されていて、現在のインスタンスと異なる場合は新しいインスタンスを作成
  if (!ollamaService || (baseUrl && baseUrl !== ollamaService['baseUrl'])) {
    ollamaService = new OllamaService(baseUrl);
  }
  return ollamaService;
}
