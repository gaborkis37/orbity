import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SatelliteMetaResponseDto {
  @ApiProperty({ type: Number, example: 25544 })
  noradId!: number;

  @ApiProperty({ type: String, example: 'ISS (ZARYA)' })
  name!: string;

  @ApiProperty({ type: String, example: '1998-067A' })
  intlDes!: string;

  @ApiPropertyOptional({ type: String, example: 'stations' })
  group?: string;

  @ApiPropertyOptional({ type: String, example: 'PAYLOAD' })
  objectType?: string;
}

export class SatelliteRecordResponseDto {
  @ApiProperty({ type: SatelliteMetaResponseDto })
  meta!: SatelliteMetaResponseDto;

  @ApiProperty({
    type: Object,
    description: 'Full CelesTrak FORMAT=json OMM record used for SGP4 propagation.',
  })
  omm!: Record<string, unknown>;
}

export class SatellitesResponseDto {
  @ApiProperty({ type: String, nullable: true, example: '2026-06-30T12:00:00.000Z' })
  updatedAt!: string | null;

  @ApiProperty({ type: Number, example: 10667 })
  count!: number;

  @ApiProperty({ type: [SatelliteRecordResponseDto] })
  satellites!: SatelliteRecordResponseDto[];
}

export class SatelliteDetailResponseDto extends SatelliteRecordResponseDto {
  @ApiProperty({ type: String, nullable: true, example: '2026-06-30T12:00:00.000Z' })
  updatedAt!: string | null;
}

export class SatelliteGroupResponseDto {
  @ApiProperty({ type: String, example: 'starlink' })
  id!: string;

  @ApiProperty({ type: String, example: 'Starlink' })
  label!: string;

  @ApiProperty({ type: Number, example: 10667 })
  count!: number;

  @ApiProperty({ type: String, nullable: true, example: '2026-06-30T12:00:00.000Z' })
  lastRefresh!: string | null;
}

export class GroupsResponseDto {
  @ApiProperty({ type: [SatelliteGroupResponseDto] })
  groups!: SatelliteGroupResponseDto[];
}

export class SearchResponseDto {
  @ApiProperty({ type: String, example: 'iss' })
  query!: string;

  @ApiProperty({ type: [SatelliteMetaResponseDto] })
  results!: SatelliteMetaResponseDto[];
}
