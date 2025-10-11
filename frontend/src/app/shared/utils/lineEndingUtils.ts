
export class LineEndingUtils {
  
  public static readonly LINE_ENDINGS = {
    CRLF: '\r\n',  
    LF: '\n',      
    CR: '\r'       
  } as const;

  
  public static detectLineEnding(text: string): string {
    if (text.includes(this.LINE_ENDINGS.CRLF)) {
      return this.LINE_ENDINGS.CRLF;
    }
    if (text.includes(this.LINE_ENDINGS.CR)) {
      return this.LINE_ENDINGS.CR;
    }
    return this.LINE_ENDINGS.LF; 
  }

  
  public static splitLines(text: string): string[] {
    return text.split(/\r?\n|\r/);
  }

  
  public static joinLines(lines: string[], lineEnding: string = this.LINE_ENDINGS.LF): string {
    return lines.join(lineEnding);
  }

  
  public static normalizeLineEndings(text: string, targetLineEnding: string = this.LINE_ENDINGS.LF): string {
    const lines = this.splitLines(text);
    return this.joinLines(lines, targetLineEnding);
  }

  
  public static joinLinesWithOriginalEnding(originalText: string, lines: string[]): string {
    const originalLineEnding = this.detectLineEnding(originalText);
    return this.joinLines(lines, originalLineEnding);
  }

  
  public static getLineEndingStats(text: string): {
    crlf: number;
    lf: number;
    cr: number;
    dominant: string;
  } {
    const crlfRe = /\r\n/g;
    const lfRe = /(?<!\r)\n/g;
    const crRe = /\r(?!\n)/g;
    const crlfCount = Array.from(text.matchAll(crlfRe)).length;
    const lfCount = Array.from(text.matchAll(lfRe)).length;
    const crCount = Array.from(text.matchAll(crRe)).length;

    let dominant: string = this.LINE_ENDINGS.LF;
    if (crlfCount > lfCount && crlfCount > crCount) {
      dominant = this.LINE_ENDINGS.CRLF;
    } else if (crCount > lfCount && crCount > crlfCount) {
      dominant = this.LINE_ENDINGS.CR;
    }

    return {
      crlf: crlfCount,
      lf: lfCount,
      cr: crCount,
      dominant
    };
  }

  
  public static isEmptyOrWhitespace(text: string): boolean {
    return !text || text.trim().length === 0;
  }

  
  public static isEmpty(text: string): boolean {
    return text.length === 0;
  }
}
