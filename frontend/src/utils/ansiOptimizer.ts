/**
 * ANSI sequence optimizer for better mobile terminal performance
 * Specifically optimized for diff output with many color changes
 */

interface AnsiPattern {
  pattern: RegExp;
  name: string;
}

const ANSI_PATTERNS: AnsiPattern[] = [
  { pattern: /\x1b\[\d+(;\d+)*m/g, name: 'color' },
  { pattern: /\x1b\[\d*[ABCDGJK]/g, name: 'cursor' },
  { pattern: /\x1b\[\d*;\d*[Hf]/g, name: 'position' },
  { pattern: /\x1b\[2?K/g, name: 'clearLine' },
  { pattern: /\x1b\[[su]/g, name: 'saveCursor' },
  { pattern: /\x1b\[\d*;\d*r/g, name: 'scrollRegion' },
  { pattern: /\r\n?/g, name: 'carriageReturn' },
];

export class AnsiOptimizer {
  private colorCache = new Map<string, string>();
  private readonly maxCacheSize = 1000;

  /**
   * Optimize ANSI sequences for mobile performance
   */
  optimize(data: string): string {
    // Quick check if optimization is needed
    if (!data.includes('\x1b')) return data;

    // Check cache first
    const cached = this.colorCache.get(data);
    if (cached) return cached;

    let optimized = data;

    // 1. Merge adjacent text with same color
    optimized = this.mergeAdjacentColors(optimized);

    // 2. Remove redundant color resets
    optimized = this.removeRedundantResets(optimized);

    // 3. Optimize cursor movements
    optimized = this.optimizeCursorMovements(optimized);

    // 4. Simplify color sequences
    optimized = this.simplifyColorSequences(optimized);

    // 5. For diff output: batch color changes
    if (this.isDiffOutput(optimized)) {
      optimized = this.optimizeDiffColors(optimized);
    }

    // Cache the result
    this.addToCache(data, optimized);

    return optimized;
  }

  /**
   * Merge adjacent text segments with the same color
   */
  private mergeAdjacentColors(data: string): string {
    // Match color code followed by text, then another same color code and text
    return data.replace(
      /(\x1b\[([\d;]+)m)([^\x1b]+)(\x1b\[\2m)([^\x1b]+)/g,
      '$1$3$5'
    );
  }

  /**
   * Remove redundant color resets
   */
  private removeRedundantResets(data: string): string {
    // Remove multiple consecutive resets
    data = data.replace(/(\x1b\[0m)+/g, '\x1b[0m');
    
    // Remove reset immediately followed by another color
    data = data.replace(/\x1b\[0m(?=\x1b\[\d+m)/g, '');
    
    // Remove empty color changes
    data = data.replace(/\x1b\[\d+(;\d+)*m(?=\x1b\[\d+(;\d+)*m)/g, '');
    
    return data;
  }

  /**
   * Optimize cursor movements
   */
  private optimizeCursorMovements(data: string): string {
    // Combine multiple cursor movements in the same direction
    data = data.replace(/(\x1b\[\d*[ABCD])+/g, (match) => {
      const movements = match.match(/\x1b\[(\d*)([ABCD])/g) || [];
      const totals = { A: 0, B: 0, C: 0, D: 0 };
      
      movements.forEach(move => {
        const [, count, dir] = move.match(/\x1b\[(\d*)([ABCD])/) || [];
        totals[dir as keyof typeof totals] += parseInt(count || '1');
      });
      
      // Calculate net movements
      const vertical = totals.B - totals.A;
      const horizontal = totals.C - totals.D;
      
      let result = '';
      if (vertical > 0) result += `\x1b[${vertical}B`;
      else if (vertical < 0) result += `\x1b[${-vertical}A`;
      
      if (horizontal > 0) result += `\x1b[${horizontal}C`;
      else if (horizontal < 0) result += `\x1b[${-horizontal}D`;
      
      return result;
    });
    
    return data;
  }

  /**
   * Simplify color sequences
   */
  private simplifyColorSequences(data: string): string {
    // Convert complex color sequences to simpler forms
    // For example: \x1b[0;31m -> \x1b[31m
    data = data.replace(/\x1b\[0;(\d+)m/g, '\x1b[$1m');
    
    // Merge multiple style attributes into one
    data = data.replace(/(\x1b\[\d+m)+/g, (match) => {
      const codes = match.match(/\d+/g) || [];
      if (codes.length > 1) {
        return `\x1b[${codes.join(';')}m`;
      }
      return match;
    });
    
    return data;
  }

  /**
   * Check if this looks like diff output
   */
  private isDiffOutput(data: string): boolean {
    // Common patterns in diff output
    const diffPatterns = [
      /^\+.*$/m,  // Added lines (green)
      /^-.*$/m,   // Removed lines (red)
      /^@@.*@@/m, // Hunk headers
      /\x1b\[3[12]m/  // Red (31) or Green (32) colors
    ];
    
    return diffPatterns.some(pattern => pattern.test(data));
  }

  /**
   * Optimize diff-specific color patterns
   */
  private optimizeDiffColors(data: string): string {
    // Group consecutive lines with the same color
    const lines = data.split('\n');
    const optimizedLines: string[] = [];
    let currentColor = '';
    let bufferedText: string[] = [];
    
    for (const line of lines) {
      // Extract color from line start
      const colorMatch = line.match(/^(\x1b\[\d+(;\d+)*m)/);
      const lineColor = colorMatch ? colorMatch[1] : '';
      
      if (lineColor === currentColor && lineColor !== '') {
        // Same color, buffer the text without color code
        const textWithoutColor = line.replace(/^\x1b\[\d+(;\d+)*m/, '');
        bufferedText.push(textWithoutColor);
      } else {
        // Color changed, flush buffer
        if (bufferedText.length > 0) {
          optimizedLines.push(currentColor + bufferedText.join('\n'));
          bufferedText = [];
        }
        
        // Start new color group
        currentColor = lineColor;
        if (lineColor) {
          const textWithoutColor = line.replace(/^\x1b\[\d+(;\d+)*m/, '');
          bufferedText.push(textWithoutColor);
        } else {
          optimizedLines.push(line);
        }
      }
    }
    
    // Flush remaining buffer
    if (bufferedText.length > 0) {
      optimizedLines.push(currentColor + bufferedText.join('\n'));
    }
    
    // Add reset at the end if needed
    const result = optimizedLines.join('\n');
    if (result.includes('\x1b[') && !result.endsWith('\x1b[0m')) {
      return result + '\x1b[0m';
    }
    
    return result;
  }

  /**
   * Add to cache with size limit
   */
  private addToCache(original: string, optimized: string): void {
    if (this.colorCache.size >= this.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.colorCache.keys().next().value;
      if (firstKey !== undefined) {
        this.colorCache.delete(firstKey);
      }
    }
    this.colorCache.set(original, optimized);
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.colorCache.clear();
  }
}

// Singleton instance
export const ansiOptimizer = new AnsiOptimizer();