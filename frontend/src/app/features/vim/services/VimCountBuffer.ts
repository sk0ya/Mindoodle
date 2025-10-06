/**
 * VimCountBuffer
 * Manages numeric prefix input for vim commands (e.g., "10j" for move down 10 times)
 */
export class VimCountBuffer {
  private buffer = '';

  /**
   * Append a digit to the count buffer
   * @param digit - Single digit character '0'-'9'
   */
  append(digit: string): void {
    if (!/^[0-9]$/.test(digit)) {
      throw new Error(`Invalid digit: ${digit}`);
    }
    this.buffer += digit;
  }

  /**
   * Get the current count as a number
   * @returns The parsed count, or undefined if no count is buffered
   */
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

  /**
   * Get the raw buffer string (for debugging/display)
   */
  getBuffer(): string {
    return this.buffer;
  }
}
