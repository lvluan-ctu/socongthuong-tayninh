export type EvnEntityType =
  | 'SUBSTATION'
  | 'TRANSFORMER'
  | 'BAY'
  | 'POWER_LINE'
  | 'LINE_POSITION'
  | 'CABLE'
  | 'ELECTRICAL_EQUIPMENT'
  | 'MEASUREMENT_REPORT'
  | 'UNKNOWN';

export type EvnCellValue = string | number | boolean | null;

/**
 * Context extracted from rows above an EVN report header. Customer workbooks
 * often identify the transformer/feeder/AppMeter in title rows rather than in
 * every measurement row, so this context must travel with staging records.
 */
export type EvnReportContext = {
  reportTitle: string | null;
  reportDate: string | null;
  transformerLabel: string | null;
  bayOrFeederLabel: string | null;
  circuitCode: string | null;
  appMeterCode: string | null;
  voltageLevelKv: number | null;
  keyValues: Record<string, string>;
  rawContextLines: string[];
};

export type EvnParsedRecord = {
  sheetName: string;
  rowNumber: number;
  headerRowNumber: number;
  entityType: EvnEntityType;
  externalKey: string | null;
  parentExternalKey: string | null;
  data: Record<string, EvnCellValue>;
  warnings: string[];
  context?: EvnReportContext;
};

export type EvnSheetPreview = {
  sheetName: string;
  entityType: EvnEntityType;
  headerRowNumber: number | null;
  totalDataRows: number;
  acceptedRows: number;
  skippedRows: number;
  warningCount: number;
  detectedReportDate: string | null;
  context?: EvnReportContext;
  sampleRows: Array<Pick<EvnParsedRecord, 'rowNumber' | 'externalKey' | 'parentExternalKey' | 'data' | 'warnings'>>;
};

export type EvnWorkbookPreview = {
  fileName: string;
  sheetCount: number;
  acceptedRows: number;
  skippedRows: number;
  warningCount: number;
  requiresObservationDate: boolean;
  sheets: EvnSheetPreview[];
};

export type ParsedEvnWorkbook = {
  preview: EvnWorkbookPreview;
  records: EvnParsedRecord[];
};
