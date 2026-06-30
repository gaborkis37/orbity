import { Controller, Get, Header, Param, ParseIntPipe, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { SatellitesQueryDto, SearchQueryDto } from './public-api.dto';
import {
  GroupsResponseDto,
  SatelliteDetailResponseDto,
  SatellitesResponseDto,
  SearchResponseDto,
} from './public-api.response.dto';
import { PublicApiService } from './public-api.service';
import type {
  GroupsResponse,
  SatelliteDetailResponse,
  SatellitesResponse,
  SearchResponse,
} from './public-api.types';

const CACHE_CONTROL = 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400';

@ApiTags('satellites')
@ApiProduces('application/json')
@Controller()
export class PublicApiController {
  constructor(private readonly service: PublicApiService) {}

  @Get('satellites')
  @Header('Cache-Control', CACHE_CONTROL)
  @ApiOperation({ summary: 'Get one cached satellite group in bulk' })
  @ApiOkResponse({
    description: 'Metadata and OMM elements for every object in the group.',
    type: SatellitesResponseDto,
  })
  @ApiBadRequestResponse({ description: 'The requested group is not configured.' })
  satellites(@Query() query: SatellitesQueryDto): Promise<SatellitesResponse> {
    return this.service.satellites(query.group);
  }

  @Get('satellites/:noradId')
  @Header('Cache-Control', CACHE_CONTROL)
  @ApiOperation({ summary: 'Get one satellite by NORAD catalog id' })
  @ApiParam({ name: 'noradId', type: Number, example: 25544 })
  @ApiOkResponse({
    description: 'Normalized metadata, full OMM record, and cache refresh time.',
    type: SatelliteDetailResponseDto,
  })
  @ApiNotFoundResponse({ description: 'No cached object has this NORAD id.' })
  satellite(@Param('noradId', ParseIntPipe) noradId: number): Promise<SatelliteDetailResponse> {
    return this.service.satellite(noradId);
  }

  @Get('search')
  @Header('Cache-Control', CACHE_CONTROL)
  @ApiOperation({ summary: 'Ranked typeahead search by name, group, alias, or NORAD id' })
  @ApiOkResponse({
    description: 'At most 50 ranked satellite metadata records.',
    type: SearchResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Query or result limit is invalid.' })
  search(@Query() query: SearchQueryDto): Promise<SearchResponse> {
    return this.service.search(query.q, query.limit);
  }

  @Get('groups')
  @Header('Cache-Control', CACHE_CONTROL)
  @ApiOperation({ summary: 'List configured groups, counts, and refresh times' })
  @ApiOkResponse({ description: 'All configured CelesTrak groups.', type: GroupsResponseDto })
  groups(): Promise<GroupsResponse> {
    return this.service.groupsSummary();
  }
}
