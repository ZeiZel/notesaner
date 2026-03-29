import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

const OVERRIDABLE_COMPONENT_IDS = [
  'NoteCard',
  'FileTreeItem',
  'StatusBarItem',
  'SidebarPanel',
  'ToolbarButton',
  'CalloutBlock',
  'CodeBlock',
  'SearchResultItem',
] as const;

export class CreateOverrideDto {
  @ApiProperty({
    description: 'Overridable component identifier.',
    example: 'NoteCard',
  })
  @IsString()
  @IsIn(OVERRIDABLE_COMPONENT_IDS)
  componentId!: string;

  @ApiProperty({
    description: 'TSX source code for the override.',
    example:
      'import React from "react";\nexport default function NoteCard({ title }) { return <div>{title}</div>; }',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500000)
  sourceCode!: string;
}
