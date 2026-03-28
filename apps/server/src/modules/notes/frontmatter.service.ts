import { Injectable, NotImplementedException } from '@nestjs/common';

/**
 * FrontmatterService — parses and manages YAML frontmatter in markdown notes.
 * Stub implementation — to be fleshed out in a subsequent sprint.
 */
@Injectable()
export class FrontmatterService {
  async parse(_content: string): Promise<Record<string, unknown>> {
    throw new NotImplementedException('parse not yet implemented');
  }

  async update(_content: string, _updates: Record<string, unknown>): Promise<string> {
    throw new NotImplementedException('update not yet implemented');
  }
}
