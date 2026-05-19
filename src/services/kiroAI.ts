import type { KiroResponse } from '../types';

class KiroAIService {
  private apiEndpoint: string;

  constructor() {
    this.apiEndpoint = import.meta.env.VITE_API_ENDPOINT || '/api/kiro';
  }

  async query(userMessage: string): Promise<KiroResponse> {
    const response = await fetch(this.apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMessage })
    });

    if (!response.ok) {
      throw new Error('Kiro AI query failed');
    }

    return response.json();
  }

  parseIconReference(iconRef: string): string {
    const iconMap: Record<string, string> = {
      'fish': '🐟',
      'pin': '📍',
      'calendar': '📅',
      'wave': '🌊'
    };
    
    const match = iconRef.match(/\[icon:(\w+)\]/);
    return match ? iconMap[match[1]] || '•' : '•';
  }
}

export const kiroAI = new KiroAIService();
