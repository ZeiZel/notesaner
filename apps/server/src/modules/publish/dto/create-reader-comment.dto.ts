import { IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/**
 * DTO for creating a public reader comment on a published note.
 *
 * Comments may be left anonymously (no authorName / authorEmail required)
 * or with attribution. The honeypot field must be absent or empty — any value
 * indicates an automated submission and the request is rejected as spam.
 */
export class CreateReaderCommentDto {
  /**
   * The comment body. Plain text, max 2 000 characters.
   */
  @IsString({ message: 'content must be a string' })
  @MinLength(1, { message: 'comment cannot be empty' })
  @MaxLength(2000, { message: 'comment must not exceed 2 000 characters' })
  content!: string;

  /**
   * Display name for anonymous commenters. Optional.
   * Authenticated readers may omit this.
   */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100, { message: 'authorName must not exceed 100 characters' })
  authorName?: string;

  /**
   * Email address for anonymous commenters. Optional opt-in for reply
   * notifications. Stored but not displayed publicly.
   */
  @IsOptional()
  @IsEmail({}, { message: 'authorEmail must be a valid email address' })
  @MaxLength(255)
  authorEmail?: string;

  /**
   * Parent comment UUID for threaded replies. Only 1 level of nesting is
   * supported — replies to replies are rejected.
   */
  @IsOptional()
  @IsUUID('4', { message: 'parentId must be a valid UUID' })
  parentId?: string;

  /**
   * Anti-spam honeypot field. Must be absent or empty string.
   * Bots filling in hidden form fields trigger automatic rejection.
   * Use CSS / `tabindex="-1"` to hide from human users.
   */
  @IsOptional()
  @IsString()
  @MaxLength(0, { message: 'honeypot field must remain empty' })
  honeypot?: string;
}
