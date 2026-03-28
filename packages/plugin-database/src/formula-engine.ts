/**
 * formula-engine.ts — Simple formula evaluator for database column formulas.
 *
 * Supports:
 * - Arithmetic: +, -, *, /, %, ** (power)
 * - Comparison: ==, !=, <, >, <=, >=
 * - Logical: &&, ||, !
 * - Functions: if(), concat(), length(), upper(), lower(), round(), floor(),
 *              ceil(), abs(), sqrt(), min(), max(), sum(), average(), now(),
 *              today(), dateFormat(), dateDiff(), prop()
 * - Property references: prop("Column Name") or prop(columnId)
 * - String literals: "text" or 'text'
 * - Number literals: 42, 3.14
 * - Boolean literals: true, false
 *
 * Security: No `eval`, uses a hand-written recursive-descent parser and
 * evaluator. Input is sandboxed — no access to global scope.
 */

import type { CellValue, ColumnDefinition, DatabaseRow } from './database-schema';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface FormulaContext {
  /** All column definitions in the database */
  columns: ColumnDefinition[];
  /** The row being evaluated */
  row: DatabaseRow;
}

export type FormulaResult = string | number | boolean | null;

export interface FormulaError {
  message: string;
  position?: number;
}

export type EvaluationResult =
  | { ok: true; value: FormulaResult }
  | { ok: false; error: FormulaError };

// ---------------------------------------------------------------------------
// Tokeniser
// ---------------------------------------------------------------------------

type TokenKind =
  | 'NUMBER'
  | 'STRING'
  | 'BOOLEAN'
  | 'NULL'
  | 'IDENT'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'PLUS'
  | 'MINUS'
  | 'STAR'
  | 'SLASH'
  | 'PERCENT'
  | 'POWER'
  | 'EQ'
  | 'NEQ'
  | 'LT'
  | 'GT'
  | 'LTE'
  | 'GTE'
  | 'AND'
  | 'OR'
  | 'NOT'
  | 'EOF';

interface Token {
  kind: TokenKind;
  value: string | number | boolean | null;
  pos: number;
}

function tokenise(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < source.length) {
    // Skip whitespace
    if (/\s/.test(source[i])) {
      i++;
      continue;
    }

    const start = i;
    const ch = source[i];

    // Number literal
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(source[i + 1] ?? ''))) {
      let num = '';
      while (i < source.length && /[0-9.]/.test(source[i])) {
        num += source[i++];
      }
      tokens.push({ kind: 'NUMBER', value: parseFloat(num), pos: start });
      continue;
    }

    // String literal
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      let str = '';
      while (i < source.length && source[i] !== quote) {
        if (source[i] === '\\' && i + 1 < source.length) {
          i++;
          const esc: Record<string, string> = {
            n: '\n',
            t: '\t',
            r: '\r',
            '\\': '\\',
            '"': '"',
            "'": "'",
          };
          str += esc[source[i]] ?? source[i];
        } else {
          str += source[i];
        }
        i++;
      }
      if (i >= source.length) {
        throw new SyntaxError(`Unterminated string literal starting at position ${start}`);
      }
      i++; // closing quote
      tokens.push({ kind: 'STRING', value: str, pos: start });
      continue;
    }

    // Identifier / keyword
    if (/[a-zA-Z_]/.test(ch)) {
      let id = '';
      while (i < source.length && /[a-zA-Z0-9_]/.test(source[i])) {
        id += source[i++];
      }
      if (id === 'true') {
        tokens.push({ kind: 'BOOLEAN', value: true, pos: start });
      } else if (id === 'false') {
        tokens.push({ kind: 'BOOLEAN', value: false, pos: start });
      } else if (id === 'null') {
        tokens.push({ kind: 'NULL', value: null, pos: start });
      } else {
        tokens.push({ kind: 'IDENT', value: id, pos: start });
      }
      continue;
    }

    // Two-char operators
    if (i + 1 < source.length) {
      const two = source.slice(i, i + 2);
      if (two === '**') {
        tokens.push({ kind: 'POWER', value: '**', pos: start });
        i += 2;
        continue;
      }
      if (two === '==') {
        tokens.push({ kind: 'EQ', value: '==', pos: start });
        i += 2;
        continue;
      }
      if (two === '!=') {
        tokens.push({ kind: 'NEQ', value: '!=', pos: start });
        i += 2;
        continue;
      }
      if (two === '<=') {
        tokens.push({ kind: 'LTE', value: '<=', pos: start });
        i += 2;
        continue;
      }
      if (two === '>=') {
        tokens.push({ kind: 'GTE', value: '>=', pos: start });
        i += 2;
        continue;
      }
      if (two === '&&') {
        tokens.push({ kind: 'AND', value: '&&', pos: start });
        i += 2;
        continue;
      }
      if (two === '||') {
        tokens.push({ kind: 'OR', value: '||', pos: start });
        i += 2;
        continue;
      }
    }

    // Single-char operators
    const SINGLE: Partial<Record<string, TokenKind>> = {
      '(': 'LPAREN',
      ')': 'RPAREN',
      ',': 'COMMA',
      '+': 'PLUS',
      '-': 'MINUS',
      '*': 'STAR',
      '/': 'SLASH',
      '%': 'PERCENT',
      '<': 'LT',
      '>': 'GT',
      '!': 'NOT',
    };
    const singleKind = SINGLE[ch];
    if (singleKind !== undefined) {
      tokens.push({ kind: singleKind, value: ch, pos: start });
      i++;
      continue;
    }

    throw new SyntaxError(`Unexpected character '${ch}' at position ${i}`);
  }

  tokens.push({ kind: 'EOF', value: null, pos: i });
  return tokens;
}

// ---------------------------------------------------------------------------
// AST node types
// ---------------------------------------------------------------------------

type AstNode =
  | { type: 'Literal'; value: FormulaResult }
  | { type: 'Identifier'; name: string }
  | { type: 'Call'; name: string; args: AstNode[] }
  | { type: 'BinaryOp'; op: string; left: AstNode; right: AstNode }
  | { type: 'UnaryOp'; op: string; operand: AstNode };

// ---------------------------------------------------------------------------
// Recursive-descent parser
// ---------------------------------------------------------------------------

class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private consume(): Token {
    const t = this.tokens[this.pos];
    this.pos++;
    return t;
  }

  private expect(kind: TokenKind): Token {
    const t = this.peek();
    if (t.kind !== kind) {
      throw new SyntaxError(`Expected ${kind} at position ${t.pos}, got ${t.kind}`);
    }
    return this.consume();
  }

  parse(): AstNode {
    const node = this.parseOr();
    this.expect('EOF');
    return node;
  }

  private parseOr(): AstNode {
    let left = this.parseAnd();
    while (this.peek().kind === 'OR') {
      this.consume();
      const right = this.parseAnd();
      left = { type: 'BinaryOp', op: '||', left, right };
    }
    return left;
  }

  private parseAnd(): AstNode {
    let left = this.parseEquality();
    while (this.peek().kind === 'AND') {
      this.consume();
      const right = this.parseEquality();
      left = { type: 'BinaryOp', op: '&&', left, right };
    }
    return left;
  }

  private parseEquality(): AstNode {
    let left = this.parseComparison();
    while (this.peek().kind === 'EQ' || this.peek().kind === 'NEQ') {
      const op = this.consume().value as string;
      const right = this.parseComparison();
      left = { type: 'BinaryOp', op, left, right };
    }
    return left;
  }

  private parseComparison(): AstNode {
    let left = this.parseAddition();
    while (['LT', 'GT', 'LTE', 'GTE'].includes(this.peek().kind)) {
      const op = this.consume().value as string;
      const right = this.parseAddition();
      left = { type: 'BinaryOp', op, left, right };
    }
    return left;
  }

  private parseAddition(): AstNode {
    let left = this.parseMultiplication();
    while (this.peek().kind === 'PLUS' || this.peek().kind === 'MINUS') {
      const op = this.consume().value as string;
      const right = this.parseMultiplication();
      left = { type: 'BinaryOp', op, left, right };
    }
    return left;
  }

  private parseMultiplication(): AstNode {
    let left = this.parsePower();
    while (['STAR', 'SLASH', 'PERCENT'].includes(this.peek().kind)) {
      const op = this.consume().value as string;
      const right = this.parsePower();
      left = { type: 'BinaryOp', op, left, right };
    }
    return left;
  }

  private parsePower(): AstNode {
    let left = this.parseUnary();
    while (this.peek().kind === 'POWER') {
      this.consume();
      const right = this.parseUnary();
      left = { type: 'BinaryOp', op: '**', left, right };
    }
    return left;
  }

  private parseUnary(): AstNode {
    if (this.peek().kind === 'NOT') {
      this.consume();
      return { type: 'UnaryOp', op: '!', operand: this.parseUnary() };
    }
    if (this.peek().kind === 'MINUS') {
      this.consume();
      return { type: 'UnaryOp', op: '-', operand: this.parseUnary() };
    }
    return this.parseCallOrPrimary();
  }

  private parseCallOrPrimary(): AstNode {
    const t = this.peek();
    if (t.kind === 'IDENT' && this.tokens[this.pos + 1]?.kind === 'LPAREN') {
      this.consume(); // identifier
      this.consume(); // LPAREN
      const args: AstNode[] = [];
      if (this.peek().kind !== 'RPAREN') {
        args.push(this.parseOr());
        while (this.peek().kind === 'COMMA') {
          this.consume();
          args.push(this.parseOr());
        }
      }
      this.expect('RPAREN');
      return { type: 'Call', name: t.value as string, args };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): AstNode {
    const t = this.peek();
    if (t.kind === 'NUMBER') {
      this.consume();
      return { type: 'Literal', value: t.value as number };
    }
    if (t.kind === 'STRING') {
      this.consume();
      return { type: 'Literal', value: t.value as string };
    }
    if (t.kind === 'BOOLEAN') {
      this.consume();
      return { type: 'Literal', value: t.value as boolean };
    }
    if (t.kind === 'NULL') {
      this.consume();
      return { type: 'Literal', value: null };
    }
    if (t.kind === 'IDENT') {
      this.consume();
      return { type: 'Identifier', name: t.value as string };
    }
    if (t.kind === 'LPAREN') {
      this.consume();
      const expr = this.parseOr();
      this.expect('RPAREN');
      return expr;
    }
    throw new SyntaxError(`Unexpected token ${t.kind} at position ${t.pos}`);
  }
}

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

function toNumber(v: FormulaResult): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    if (!Number.isNaN(n)) return n;
  }
  return NaN;
}

function toString(v: FormulaResult): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

function evaluateNode(node: AstNode, ctx: FormulaContext): FormulaResult {
  switch (node.type) {
    case 'Literal':
      return node.value;

    case 'Identifier':
      // Treat bare identifiers as property lookups by column name
      return lookupProp(node.name, ctx);

    case 'UnaryOp': {
      const val = evaluateNode(node.operand, ctx);
      if (node.op === '!') return !val;
      if (node.op === '-') return -toNumber(val);
      return null;
    }

    case 'BinaryOp': {
      const l = evaluateNode(node.left, ctx);
      const r = evaluateNode(node.right, ctx);
      switch (node.op) {
        case '+':
          // String concatenation when either operand is a string
          if (typeof l === 'string' || typeof r === 'string') {
            return toString(l) + toString(r);
          }
          return toNumber(l) + toNumber(r);
        case '-':
          return toNumber(l) - toNumber(r);
        case '*':
          return toNumber(l) * toNumber(r);
        case '/': {
          const divisor = toNumber(r);
          if (divisor === 0) return null;
          return toNumber(l) / divisor;
        }
        case '%':
          return toNumber(l) % toNumber(r);
        case '**':
          return Math.pow(toNumber(l), toNumber(r));
        case '==':
          return l === r;
        case '!=':
          return l !== r;
        case '<':
          return toNumber(l) < toNumber(r);
        case '>':
          return toNumber(l) > toNumber(r);
        case '<=':
          return toNumber(l) <= toNumber(r);
        case '>=':
          return toNumber(l) >= toNumber(r);
        case '&&':
          return Boolean(l) && Boolean(r);
        case '||':
          return Boolean(l) || Boolean(r);
        default:
          return null;
      }
    }

    case 'Call':
      return evaluateCall(node.name, node.args, ctx);
  }
}

function lookupProp(nameOrId: string, ctx: FormulaContext): FormulaResult {
  // Match by column ID first, then by column name (case-insensitive)
  const col = ctx.columns.find(
    (c) => c.id === nameOrId || c.name.toLowerCase() === nameOrId.toLowerCase(),
  );
  if (!col) return null;
  const rawValue: CellValue = ctx.row.values[col.id];
  if (rawValue === undefined || rawValue === null) return null;
  if (Array.isArray(rawValue)) return rawValue.join(', ');
  return rawValue as FormulaResult;
}

function evaluateCall(name: string, args: AstNode[], ctx: FormulaContext): FormulaResult {
  const evalArg = (i: number): FormulaResult => evaluateNode(args[i], ctx);
  const fn = name.toLowerCase();

  switch (fn) {
    // -----------------------------------------------------------------------
    // Control flow
    // -----------------------------------------------------------------------
    case 'if': {
      if (args.length < 2) return null;
      const condition = evalArg(0);
      return Boolean(condition) ? evalArg(1) : args.length > 2 ? evalArg(2) : null;
    }

    // -----------------------------------------------------------------------
    // Property access
    // -----------------------------------------------------------------------
    case 'prop': {
      if (args.length < 1) return null;
      const propName = toString(evalArg(0));
      return lookupProp(propName, ctx);
    }

    // -----------------------------------------------------------------------
    // String functions
    // -----------------------------------------------------------------------
    case 'concat':
      return args.map((_, i) => toString(evalArg(i))).join('');
    case 'length':
      return toString(evalArg(0)).length;
    case 'upper':
      return toString(evalArg(0)).toUpperCase();
    case 'lower':
      return toString(evalArg(0)).toLowerCase();
    case 'trim':
      return toString(evalArg(0)).trim();
    case 'slice': {
      const str = toString(evalArg(0));
      const start = toNumber(evalArg(1));
      const end = args.length > 2 ? toNumber(evalArg(2)) : undefined;
      return str.slice(start, end);
    }
    case 'replace': {
      const str = toString(evalArg(0));
      const search = toString(evalArg(1));
      const replacement = toString(evalArg(2));
      return str.replace(new RegExp(search, 'g'), replacement);
    }
    case 'contains': {
      const haystack = toString(evalArg(0));
      const needle = toString(evalArg(1));
      return haystack.includes(needle);
    }
    case 'startswith':
      return toString(evalArg(0)).startsWith(toString(evalArg(1)));
    case 'endswith':
      return toString(evalArg(0)).endsWith(toString(evalArg(1)));

    // -----------------------------------------------------------------------
    // Math functions
    // -----------------------------------------------------------------------
    case 'round': {
      const n = toNumber(evalArg(0));
      const decimals = args.length > 1 ? toNumber(evalArg(1)) : 0;
      const factor = Math.pow(10, decimals);
      return Math.round(n * factor) / factor;
    }
    case 'floor':
      return Math.floor(toNumber(evalArg(0)));
    case 'ceil':
      return Math.ceil(toNumber(evalArg(0)));
    case 'abs':
      return Math.abs(toNumber(evalArg(0)));
    case 'sqrt':
      return Math.sqrt(toNumber(evalArg(0)));
    case 'min':
      return Math.min(...args.map((_, i) => toNumber(evalArg(i))));
    case 'max':
      return Math.max(...args.map((_, i) => toNumber(evalArg(i))));
    case 'sum':
      return args.reduce((acc, _, i) => acc + toNumber(evalArg(i)), 0);
    case 'average': {
      if (args.length === 0) return null;
      const total = args.reduce((acc, _, i) => acc + toNumber(evalArg(i)), 0);
      return total / args.length;
    }
    case 'mod':
      return toNumber(evalArg(0)) % toNumber(evalArg(1));
    case 'pow':
      return Math.pow(toNumber(evalArg(0)), toNumber(evalArg(1)));
    case 'log':
      return Math.log(toNumber(evalArg(0)));
    case 'log10':
      return Math.log10(toNumber(evalArg(0)));

    // -----------------------------------------------------------------------
    // Date functions
    // -----------------------------------------------------------------------
    case 'now':
      return new Date().toISOString();
    case 'today':
      return new Date().toISOString().split('T')[0];
    case 'dateformat': {
      const dateStr = toString(evalArg(0));
      const format = toString(evalArg(1));
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return null;
      return formatDate(d, format);
    }
    case 'datediff': {
      const date1 = new Date(toString(evalArg(0)));
      const date2 = new Date(toString(evalArg(1)));
      const unit = args.length > 2 ? toString(evalArg(2)).toLowerCase() : 'days';
      if (Number.isNaN(date1.getTime()) || Number.isNaN(date2.getTime())) return null;
      const diffMs = date2.getTime() - date1.getTime();
      switch (unit) {
        case 'milliseconds':
          return diffMs;
        case 'seconds':
          return Math.floor(diffMs / 1000);
        case 'minutes':
          return Math.floor(diffMs / (1000 * 60));
        case 'hours':
          return Math.floor(diffMs / (1000 * 60 * 60));
        case 'days':
          return Math.floor(diffMs / (1000 * 60 * 60 * 24));
        case 'weeks':
          return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));
        case 'months':
          return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30));
        case 'years':
          return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365));
        default:
          return Math.floor(diffMs / (1000 * 60 * 60 * 24));
      }
    }
    case 'timestamp':
      return new Date(toString(evalArg(0))).getTime();

    // -----------------------------------------------------------------------
    // Boolean functions
    // -----------------------------------------------------------------------
    case 'not':
      return !evalArg(0);
    case 'and':
      return args.every((_, i) => Boolean(evalArg(i)));
    case 'or':
      return args.some((_, i) => Boolean(evalArg(i)));
    case 'empty': {
      const v = evalArg(0);
      return v === null || v === undefined || toString(v) === '';
    }

    // -----------------------------------------------------------------------
    // Type conversion
    // -----------------------------------------------------------------------
    case 'tonumber':
      return toNumber(evalArg(0));
    case 'tostring':
      return toString(evalArg(0));
    case 'toboolean':
      return Boolean(evalArg(0));

    default:
      throw new Error(`Unknown function: ${name}()`);
  }
}

/** Minimal date formatter (subset of Unicode CLDR patterns). */
function formatDate(d: Date, pattern: string): string {
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return pattern
    .replace('yyyy', String(d.getFullYear()))
    .replace('yy', pad(d.getFullYear() % 100))
    .replace('MM', pad(d.getMonth() + 1))
    .replace('M', String(d.getMonth() + 1))
    .replace('dd', pad(d.getDate()))
    .replace('d', String(d.getDate()))
    .replace('HH', pad(d.getHours()))
    .replace('H', String(d.getHours()))
    .replace('mm', pad(d.getMinutes()))
    .replace('ss', pad(d.getSeconds()));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Evaluate a formula expression string against a row context.
 *
 * @returns `EvaluationResult` — either `{ ok: true, value }` or `{ ok: false, error }`.
 */
export function evaluateFormula(expression: string, ctx: FormulaContext): EvaluationResult {
  try {
    const tokens = tokenise(expression);
    const ast = new Parser(tokens).parse();
    const value = evaluateNode(ast, ctx);
    return { ok: true, value };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: { message } };
  }
}

/**
 * Validate that a formula expression is syntactically correct.
 * Does NOT evaluate against real data.
 */
export function validateFormula(expression: string): true | string {
  try {
    const tokens = tokenise(expression);
    new Parser(tokens).parse();
    return true;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}
