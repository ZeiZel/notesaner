import { Module } from '@nestjs/common';
import { ComponentOverridesController } from './component-overrides.controller';
import { ComponentOverridesService } from './component-overrides.service';

@Module({
  controllers: [ComponentOverridesController],
  providers: [ComponentOverridesService],
  exports: [ComponentOverridesService],
})
export class ComponentOverridesModule {}
