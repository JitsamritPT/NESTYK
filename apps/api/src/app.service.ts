import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      service: 'NESTYK Unified Backend API',
      timestamp: new Date().toISOString(),
      supabaseConnected: true,
    };
  }
}
