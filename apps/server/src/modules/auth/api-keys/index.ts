export { UserApiKeyController } from './api-key.controller';
export { UserApiKeyService, ValidatedUserApiKey } from './api-key.service';
export {
  UserApiKeyGuard,
  getUserApiKey,
  isApiKeyAuth,
  USER_API_KEY_CONTEXT,
} from './api-key.guard';
export type { RequestWithUserApiKey } from './api-key.guard';
export { ApiKeyOrJwtGuard } from './api-key-or-jwt.guard';
export { CreateUserApiKeyDto, UserApiKeyScope } from './dto/create-api-key.dto';
export {
  UserApiKeyResponseDto,
  CreatedApiKeyResponseDto,
  RotatedApiKeyResponseDto,
} from './dto/list-api-keys.dto';
export { RequireScopes, REQUIRE_SCOPES_KEY } from './decorators/require-scopes.decorator';
