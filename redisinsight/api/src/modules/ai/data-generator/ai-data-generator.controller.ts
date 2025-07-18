import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Post,
  Res,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiEndpoint } from 'src/decorators/api-endpoint.decorator';
import { ApiTags } from '@nestjs/swagger';
import { RequestSessionMetadata } from 'src/common/decorators';
import { SessionMetadata } from 'src/common/models';
import { Response } from 'express';
import { AiDataGeneratorService } from 'src/modules/ai/data-generator/ai-data-generator.service';
import { SendAiDataGeneratorMessageDto } from 'src/modules/ai/data-generator/dto/send.ai-data-generator.message.dto';

// Define constant for the duplicate string
const GENERATE_NEW_QUERY_DESCRIPTION = 'Generate new query';

@ApiTags('AI')
@UseInterceptors(ClassSerializerInterceptor)
@Controller('ai/data-generator/:id/messages')
@UsePipes(new ValidationPipe({ transform: true }))
export class AiDataGeneratorController {
  private readonly logger = new Logger('AiDataGeneratorController');

  constructor(private readonly service: AiDataGeneratorService) {}

  @Post()
  @ApiEndpoint({
    description: GENERATE_NEW_QUERY_DESCRIPTION,
    statusCode: 200,
    responses: [{ type: String }],
  })
  async streamQuestion(
    @RequestSessionMetadata() sessionMetadata: SessionMetadata,
    @Param('id') databaseId: string,
    @Body() dto: SendAiDataGeneratorMessageDto,
    @Res() res: Response,
  ) {
    await this.service.stream(sessionMetadata, databaseId, dto, res);
  }

  @Get()
  @ApiEndpoint({
    description: GENERATE_NEW_QUERY_DESCRIPTION,
    statusCode: 200,
    responses: [{ type: String }],
  })
  async getHistory(
    @RequestSessionMetadata() sessionMetadata: SessionMetadata,
    @Param('id') databaseId: string,
  ) {
    this.logger.debug('getHistory');
    return this.service.getHistory(sessionMetadata, databaseId);
  }

  @Delete()
  @ApiEndpoint({
    description: GENERATE_NEW_QUERY_DESCRIPTION,
    statusCode: 200,
    responses: [{ type: String }],
  })
  async clearHistory(
    @RequestSessionMetadata() sessionMetadata: SessionMetadata,
    @Param('id') databaseId: string,
  ) {
    return this.service.clearHistory(sessionMetadata, databaseId);
  }
} 