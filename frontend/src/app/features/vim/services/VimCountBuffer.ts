
export class VimCountBuffer {
  private buffer = '';

  /**
   * Append a digit to the count buffer
   * @param digit - Single digit character '0'-'9'
   */
  append(digit: string): void {
    if (!/^\d$/.test(digit)) {
      throw new Error(`Invalid digit: ${digit}`);
    }
    this.buffer += digit;
  }

  
  getCount(): number | undefined {
    if (this.buffer === '') {
      return undefined;
    }
    const count = parseInt(this.buffer, 10);
    return isNaN(count) ? undefined : count;
  }

  /**
   * Clear the count buffer
   */
  clear(): void {
    this.buffer = '';
  }

  /**
   * Check if there is a count buffered
   */
  hasCount(): boolean {
    return this.buffer !== '';
  }

  
  getBuffer(): string {
    return this.buffer;
  }
}
