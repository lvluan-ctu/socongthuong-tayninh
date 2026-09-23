import { asc, count, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyAssets, energyEvConnectors } from '@/db/schema';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

const patchSchema=z.object({connectorId:z.string().uuid(),status:z.enum(['AVAILABLE','OCCUPIED','FAULTED','OFFLINE','MAINTENANCE'])});

export async function GET(request: Request){
  try{
    const params=new URL(request.url).searchParams;
    const wantsPagination=params.get('options')!=='true'&&(params.has('page')||params.has('pageSize'));
    const pagination=parsePagination(params);
    const listQuery=db.select({id:energyEvConnectors.id,stationAssetId:energyEvConnectors.stationAssetId,stationName:energyAssets.name,code:energyEvConnectors.code,connectorType:energyEvConnectors.connectorType,chargingMode:energyEvConnectors.chargingMode,powerKw:energyEvConnectors.powerKw,status:energyEvConnectors.status}).from(energyEvConnectors).innerJoin(energyAssets,eq(energyAssets.id,energyEvConnectors.stationAssetId)).orderBy(asc(energyAssets.name),asc(energyEvConnectors.code));
    const rows=wantsPagination?await listQuery.limit(pagination.pageSize).offset(pagination.offset):await listQuery.limit(1000);
    const [totalRows,summaryRows]=wantsPagination?await Promise.all([db.select({value:count()}).from(energyEvConnectors),db.select({available:sql<number>`COUNT(*) FILTER (WHERE ${energyEvConnectors.status} = 'AVAILABLE')`,occupied:sql<number>`COUNT(*) FILTER (WHERE ${energyEvConnectors.status} = 'OCCUPIED')`,faulted:sql<number>`COUNT(*) FILTER (WHERE ${energyEvConnectors.status} = 'FAULTED')`}).from(energyEvConnectors)]):[[],[]];
    const items=rows.map(r=>({...r,powerKw:Number(r.powerKw)}));
    const summary=summaryRows[0]?{available:Number(summaryRows[0].available??0),occupied:Number(summaryRows[0].occupied??0),faulted:Number(summaryRows[0].faulted??0)}:undefined;
    return wantsPagination?paginatedResponse(items,pagination,Number(totalRows[0]?.value??0),{summary}):NextResponse.json({items});
  }catch(error){return NextResponse.json({message:error instanceof Error?error.message:'Không thể tải connector.'},{status:500});}
}

export async function PATCH(request:Request){
  try{const p=patchSchema.parse(await request.json());const[updated]=await db.update(energyEvConnectors).set({status:p.status}).where(eq(energyEvConnectors.id,p.connectorId)).returning();if(!updated)return NextResponse.json({message:'Không tìm thấy connector.'},{status:404});return NextResponse.json(updated);}catch(error){if(error instanceof z.ZodError)return NextResponse.json({message:'Trạng thái connector không hợp lệ.',issues:error.issues},{status:400});return NextResponse.json({message:error instanceof Error?error.message:'Không thể cập nhật connector.'},{status:400});}
}
