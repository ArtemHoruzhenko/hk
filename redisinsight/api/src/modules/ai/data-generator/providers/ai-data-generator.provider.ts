import { io, Socket } from 'socket.io-client';
import config, { Config } from 'src/utils/config';
import { Injectable, Logger } from '@nestjs/common';
import { AiQueryWsEvents } from 'src/modules/ai/query/models';
import { wrapAiQueryError } from 'src/modules/ai/query/exceptions';

const aiConfig = config.get('ai') as Config['ai'];

@Injectable()
export class AiDataGeneratorProvider {
  private readonly logger = new Logger('AiQueryProvider');

  async getSocket(): Promise<Socket> {
    try {
      return await new Promise((resolve, reject) => {
        const socket = io(aiConfig.querySocketUrl, {
          path: aiConfig.querySocketPath,
          reconnection: false,
          transports: ['websocket'],
        });

        socket.on(AiQueryWsEvents.CONNECT_ERROR, (e) => {
          console.log('Unable to connect', e)
          this.logger.error('Unable to establish AI socket connection', e);
          reject(e);
        });

        socket.on(AiQueryWsEvents.CONNECT, async () => {
          this.logger.debug('AI socket connection established');
          resolve(socket);
        });
      });
    } catch (e) {
      throw wrapAiQueryError(e, 'Unable to establish connection');
    }
  }
}
