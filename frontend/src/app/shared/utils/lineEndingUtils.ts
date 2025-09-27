/**
 * 改行コード処理ユーティリティクラス
 *
 * 異なる改行コード（\r\n, \n, \r）を統一的に処理し、
 * 元の改行コードを保持したまま文字列操作を行う機能を提供します。
 */
export class LineEndingUtils {
  /**
   * 改行コードの種類
   */
  public static readonly LINE_ENDINGS = {
    CRLF: '\r\n',  // Windows
    LF: '\n',      // Unix/Linux/Mac
    CR: '\r'       // 古いMac
  } as const;

  /**
   * テキストから改行コードの種類を検出
   * @param text 検出対象のテキスト
   * @returns 検出された改行コード（複数存在する場合は最初に見つかったもの）
   */
  public static detectLineEnding(text: string): string {
    if (text.includes(this.LINE_ENDINGS.CRLF)) {
      return this.LINE_ENDINGS.CRLF;
    }
    if (text.includes(this.LINE_ENDINGS.CR)) {
      return this.LINE_ENDINGS.CR;
    }
    return this.LINE_ENDINGS.LF; // デフォルト
  }

  /**
   * テキストを行単位に分割（改行コードを自動検出）
   * @param text 分割対象のテキスト
   * @returns 行の配列
   */
  public static splitLines(text: string): string[] {
    return text.split(/\r?\n|\r/);
  }

  /**
   * 行配列を指定された改行コードで結合
   * @param lines 行の配列
   * @param lineEnding 使用する改行コード（省略時は\n）
   * @returns 結合されたテキスト
   */
  public static joinLines(lines: string[], lineEnding: string = this.LINE_ENDINGS.LF): string {
    return lines.join(lineEnding);
  }

  /**
   * テキストの改行コードを統一
   * @param text 変換対象のテキスト
   * @param targetLineEnding 変換先の改行コード（省略時は\n）
   * @returns 改行コードが統一されたテキスト
   */
  public static normalizeLineEndings(text: string, targetLineEnding: string = this.LINE_ENDINGS.LF): string {
    const lines = this.splitLines(text);
    return this.joinLines(lines, targetLineEnding);
  }

  /**
   * 元の改行コードを保持したまま行配列を結合
   * @param originalText 元のテキスト（改行コード検出用）
   * @param lines 結合する行の配列
   * @returns 元の改行コードで結合されたテキスト
   */
  public static joinLinesWithOriginalEnding(originalText: string, lines: string[]): string {
    const originalLineEnding = this.detectLineEnding(originalText);
    return this.joinLines(lines, originalLineEnding);
  }

  /**
   * 改行コードの統計情報を取得
   * @param text 対象のテキスト
   * @returns 各改行コードの出現回数
   */
  public static getLineEndingStats(text: string): {
    crlf: number;
    lf: number;
    cr: number;
    dominant: string;
  } {
    const crlfCount = (text.match(/\r\n/g) || []).length;
    const lfCount = (text.match(/(?<!\r)\n/g) || []).length;
    const crCount = (text.match(/\r(?!\n)/g) || []).length;

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

  /**
   * 空文字列や空白のみの文字列かチェック（trimの代替）
   * @param text チェック対象のテキスト
   * @returns 空文字列または空白のみの場合true
   */
  public static isEmptyOrWhitespace(text: string): boolean {
    return !text || text.trim().length === 0;
  }

  /**
   * 文字列の開始と終端の空白文字を除去せずに、空かどうかを判定
   * @param text チェック対象のテキスト
   * @returns 空文字列の場合true（空白文字は除去しない）
   */
  public static isEmpty(text: string): boolean {
    return text.length === 0;
  }
}