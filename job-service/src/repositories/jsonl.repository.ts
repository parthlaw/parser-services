import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import logger from '@/utils/logger';
import { IJsonlPaginationOptions, IJsonlReadResult, IJsonlFileMetadata } from '@/types/models';

export interface IJsonlRepository {
  readJsonlFile<T>(
    filePath: string,
    paginationOptions: IJsonlPaginationOptions
  ): Promise<IJsonlReadResult<T>>;
}

export class JsonlRepository implements IJsonlRepository {
  private static instance: JsonlRepository;
  private fileMetadataCache: Map<string, IJsonlFileMetadata>;

  constructor() {
    this.fileMetadataCache = new Map();
  }

  public static getInstance(): JsonlRepository {
    if (!JsonlRepository.instance) {
      JsonlRepository.instance = new JsonlRepository();
    }
    return JsonlRepository.instance;
  }

  async readJsonlFile<T>(
    filePath: string,
    paginationOptions: IJsonlPaginationOptions
  ): Promise<IJsonlReadResult<T>> {
    try {
      return await this.readWithPagination<T>(filePath, paginationOptions);
    } catch (error) {
      logger.error('JSONL read failed', {
        error,
        filePath,
        context: { paginationOptions },
      });
      throw error;
    }
  }

  private async readWithPagination<T>(
    filePath: string,
    options: IJsonlPaginationOptions
  ): Promise<IJsonlReadResult<T>> {
    const metadata = await this.getOrCreateFileMetadata(filePath);
    const { offset, limit } = options;

    const result: T[] = [];
    let currentLine = 0;
    let totalRead = 0;
    let hasMore = false;

    // Count total lines first
    const countRl = createInterface({
      input: createReadStream(filePath),
      crlfDelay: Infinity,
    });
    let total = 0;
    for await (const _line of countRl) {
      total++;
    }

    // Create a fresh readline interface for actual reading
    const rl = createInterface({
      input: createReadStream(filePath),
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (currentLine < offset) {
        currentLine++;
        continue;
      }

      if (totalRead >= limit) {
        hasMore = true;
        break;
      }

      try {
        const parsedLine = JSON.parse(line) as T;
        result.push(parsedLine);
        totalRead++;
      } catch (error) {
        logger.error('Failed to parse JSONL line', {
          error,
          filePath,
          lineNumber: currentLine,
        });
      }

      currentLine++;
    }

    // Update metadata
    metadata.lastOffset = currentLine;
    if (!metadata.totalLines) {
      metadata.totalLines = currentLine;
    }
    this.fileMetadataCache.set(filePath, metadata);

    return {
      data: result,
      hasMore,
      totalRead,
      total,
    };
  }

  private async getOrCreateFileMetadata(filePath: string): Promise<IJsonlFileMetadata> {
    let metadata = this.fileMetadataCache.get(filePath);

    if (!metadata) {
      metadata = {
        filePath,
        lastOffset: 0,
      };
      this.fileMetadataCache.set(filePath, metadata);
    }

    return metadata;
  }
}
