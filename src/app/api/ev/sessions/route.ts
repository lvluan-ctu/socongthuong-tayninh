import { count, desc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energyAssets, energyEvConnectors, energyEvSessions } from '@/db/schema';
import { db } from '@/lib/db';
import { paginatedResponse, parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

const schema=z.object({connectorId:z.string().uuid(),startedAt:z.string().min(1),endedAt:z.string().nullable().optional(),energyKwh:z.number().min(0).nullable().optional(),peakPowerKw:z.number().min(0).nullable().optional(),status:z.enum(['ACTIVE','COMPLETED','CANCELLED','FAILED']).default('COMPLETED')});

export async function GET(request: Request){
  try{
    const params=new URL(request.url).searchParams;
    const wantsPagination=params.get('options')!=='true'&&(params.has('page')||params.has('pageSize'));
    const pagination=parsePagination(params);
    const listQuery=db.select({id:energyEvSessions.id,connectorId:energyEvSessions.connectorId,connectorCode:energyEvConnectors.code,stationAssetId:energyEvConnectors.stationAssetId,stationName:energyAssets.name,startedAt:energyEvSessions.startedAt,endedAt:energyEvSessions.endedAt,energyKwh:energyEvSessions.energyKwh,peakPowerKw:energyEvSessions.peakPowerKw,status:energyEvSessions.status}).from(energyEvSessions).innerJoin(energyEvConnectors,eq(energyEvConnectors.id,energyEvSessions.connectorId)).innerJoin(energyAssets,eq(energyAssets.id,energyEvConnectors.stationAssetId)).orderBy(desc(energyEvSessions.startedAt));
    const rows=wantsPagination?await listQuery.limit(pagination.pageSize).offset(pagination.offset):await listQuery.limit(2000);
    const [totalRows,summaryRows]=wantsPagination?await Promise.all([db.select({value:count()}).from(energyEvSessions),db.select({energyKwh:sql<string>`COALESCE(SUM(${energyEvSessions.energyKwh}), 0)`}).from(energyEvSessions)]):[[],[]];
    const items=rows.map(r=>({...r,energyKwh:r.energyKwh==null?null:Number(r.energyKwh),peakPowerKw:r.peakPowerKw==null?null:Number(r.peakPowerKw)}));
    const summary=summaryRows[0]?{totalEnergyKwh:Number(summaryRows[0].energyKwh??0)}:undefined;
    return wantsPagination?paginatedResponse(items,pagination,Number(totalRows[0]?.value??0),{summary}):NextResponse.json({items});
  }catch(error){return NextResponse.json({message:error instanceof Error?error.message:'Không thể tải phiên sạc.'},{status:500});}
}

export async function POST(request:Request){
  try{const p=schema.parse(await request.json());const[connector]=await db.select().from(energyEvConnectors).where(eq(energyEvConnectors.id,p.connectorId)).limit(1);if(!connector)return NextResponse.json({message:'Không tìm thấy connector.'},{status:404});const startedAt=new Date(p.startedAt);const endedAt=p.endedAt?new Date(p.endedAt):null;if(Number.isNaN(startedAt.getTime())||(endedAt&&Number.isNaN(endedAt.getTime()))||(endedAt&&endedAt<startedAt))return NextResponse.json({message:'Thời gian phiên sạc không hợp lệ.'},{status:400});const result=await db.transaction(async(tx)=>{const[created]=await tx.insert(energyEvSessions).values({connectorId:p.connectorId,startedAt,endedAt,energyKwh:p.energyKwh==null?null:String(p.energyKwh),peakPowerKw:p.peakPowerKw==null?null:String(p.peakPowerKw),status:p.status}).returning();const connectorStatus=p.status==='ACTIVE'?'OCCUPIED':p.status==='FAILED'?'FAULTED':'AVAILABLE';await tx.update(energyEvConnectors).set({status:connectorStatus}).where(eq(energyEvConnectors.id,p.connectorId));return created;});return NextResponse.json(result,{status:201});}catch(error){if(error instanceof z.ZodError)return NextResponse.json({message:'Phiên sạc không hợp lệ.',issues:error.issues},{status:400});return NextResponse.json({message:error instanceof Error?error.message:'Không thể lưu phiên sạc.'},{status:400});}
}
