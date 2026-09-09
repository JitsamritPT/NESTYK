import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { AgentModule } from './agent/agent.module';

@Module({
  imports: [DatabaseModule, AuthModule, AgentModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
