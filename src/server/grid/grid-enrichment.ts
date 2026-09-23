import { eq, sql } from 'drizzle-orm';
import { energyAssetRelations, energyAssets, energyFeeders, energyPowerLines } from '@/db/schema';
import { db } from '@/lib/db';

function normalizeKey(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g,'d').replace(/Đ/g,'D').replace(/[^a-zA-Z0-9]+/g,' ').trim().toLowerCase();
}

function slug(value: string) {
  return normalizeKey(value).replace(/\s+/g, '-').replace(/^-+|-+$/g, '') || 'unknown';
}

function pick(record: Record<string, unknown>, aliases: string[]) {
  for (const [key, value] of Object.entries(record)) {
    const k=normalizeKey(key);
    if (aliases.some(a=>k===a||k.includes(a))) {
      if(value!=null&&String(value).trim()!=='')return String(value).trim();
    }
  }
  return null;
}

function numberOf(value: unknown) {
  const n=Number(String(value??'').replace(',','.').replace(/[^0-9+\-.]/g,''));
  return Number.isFinite(n)?n:null;
}

async function findAssetByName(table: 'energy_substations'|'energy_transformers', label: string|null) {
  if(!label)return null;
  const pattern=`%${label}%`;
  const result=table==='energy_substations'
    ? await db.execute(sql`SELECT a.id,a.site_id AS "siteId" FROM energy_substations x JOIN energy_assets a ON a.id=x.asset_id WHERE lower(a.name)=lower(${label}) OR lower(a.name) LIKE lower(${pattern}) ORDER BY CASE WHEN lower(a.name)=lower(${label}) THEN 0 ELSE 1 END LIMIT 1`)
    : await db.execute(sql`SELECT a.id,a.site_id AS "siteId" FROM energy_transformers x JOIN energy_assets a ON a.id=x.asset_id WHERE lower(a.name)=lower(${label}) OR lower(a.name) LIKE lower(${pattern}) ORDER BY CASE WHEN lower(a.name)=lower(${label}) THEN 0 ELSE 1 END LIMIT 1`);
  const row=result.rows[0] as {id?:string;siteId?:string|null}|undefined;
  return row?.id?{id:row.id,siteId:row.siteId??null}:null;
}

export async function rebuildPowerStructures() {
  const result=await db.execute(sql`
    INSERT INTO energy_power_structures (asset_id,position_id,line_asset_id,structure_type,circuit_count,grounding_resistance_ohm,technical_specs)
    SELECT lp.asset_id,lp.id,lp.line_asset_id,CASE WHEN COALESCE(pl.voltage_level_kv,0)>=110 THEN 'TOWER' ELSE 'POLE' END,
           lp.circuit_count,lp.grounding_resistance_ohm,COALESCE(lp.metadata,'{}'::jsonb)
    FROM energy_line_positions lp LEFT JOIN energy_power_lines pl ON pl.asset_id=lp.line_asset_id
    WHERE lp.asset_id IS NOT NULL
    ON CONFLICT (asset_id) DO UPDATE SET position_id=EXCLUDED.position_id,line_asset_id=EXCLUDED.line_asset_id,circuit_count=EXCLUDED.circuit_count,
      grounding_resistance_ohm=EXCLUDED.grounding_resistance_ohm,technical_specs=EXCLUDED.technical_specs
    RETURNING asset_id
  `);
  return {updated:result.rows.length};
}

export async function rebuildFeedersFromEvnMetadata() {
  const lines=await db.select({assetId:energyPowerLines.assetId,voltageLevelKv:energyPowerLines.voltageLevelKv,ratedCapacityMw:energyPowerLines.ratedCapacityMw,currentLoadMw:energyPowerLines.currentLoadMw,technicalSpecs:energyPowerLines.technicalSpecs,commissionedAt:energyAssets.commissionedAt,classification:energyAssets.classification}).from(energyPowerLines).innerJoin(energyAssets,eq(energyAssets.id,energyPowerLines.assetId));
  let created=0,reused=0,linkedLines=0,skipped=0;
  const errors:Array<{assetId:string;message:string}>=[];
  for(const line of lines){
    try{
      const specs=(line.technicalSpecs??{}) as Record<string,unknown>;
      const bayLabel=pick(specs,['ngan lo cap dien','ngan lo','feeder','phat tuyen']);
      const explicitFeeder=pick(specs,['ma phat tuyen','phat tuyen','feeder code']);
      const feederCode=explicitFeeder??bayLabel;
      if(!feederCode){skipped+=1;continue;}
      const substationLabel=pick(specs,['tram cap dien','tram nguon','tba cap dien']);
      const transformerLabel=pick(specs,['tu mba','mba cap dien','may bien ap cap dien']);
      const substation=await findAssetByName('energy_substations',substationLabel);
      const transformer=await findAssetByName('energy_transformers',transformerLabel);
      const bayPattern=`%${bayLabel??''}%`;
      const bayResult=bayLabel?await db.execute(sql`SELECT b.asset_id AS id FROM energy_bays b JOIN energy_assets a ON a.id=b.asset_id WHERE lower(b.bay_code)=lower(${bayLabel}) OR lower(a.name)=lower(${bayLabel}) OR lower(a.name) LIKE lower(${bayPattern}) ORDER BY CASE WHEN lower(b.bay_code)=lower(${bayLabel}) THEN 0 ELSE 1 END LIMIT 1`):null;
      const bayId=(bayResult?.rows[0] as {id?:string}|undefined)?.id??null;

      // Feeder number (e.g. 473) is not globally unique across EVN substations.
      // Scope the internal asset identity by the source substation; if unresolved,
      // keep source label/line id in the key rather than incorrectly merging feeders.
      const stationScope=substation?.id??(substationLabel?slug(substationLabel):line.assetId);
      const assetCode=`EVN:FEEDER:${stationScope}:${slug(feederCode)}`;
      let[feederAsset]=await db.select().from(energyAssets).where(eq(energyAssets.code,assetCode)).limit(1);
      if(!feederAsset){
        [feederAsset]=await db.insert(energyAssets).values({
          siteId:substation?.siteId??null,
          assetType:'FEEDER',
          code:assetCode,
          name:`Phát tuyến ${feederCode}${substationLabel?` • ${substationLabel}`:''}`,
          status:'ACTIVE',
          commissionedAt:line.commissionedAt,
          classification:line.classification,
          metadata:{source:'EVN_INFERRED',inference:'POWER_LINE_FEEDER_METADATA',rawFeederCode:feederCode,sourceBayLabel:bayLabel,sourceSubstationLabel:substationLabel,sourceTransformerLabel:transformerLabel},
        }).returning();
        created+=1;
      }else reused+=1;
      const rated=numberOf(line.ratedCapacityMw);const load=numberOf(line.currentLoadMw);
      await db.insert(energyFeeders).values({assetId:feederAsset.id,substationAssetId:substation?.id??null,sourceBayAssetId:bayId,sourceTransformerAssetId:transformer?.id??null,feederCode,voltageLevelKv:String(Number(line.voltageLevelKv)),ratedCapacityMw:rated==null?null:String(rated),currentLoadMw:load==null?null:String(load),headroomMw:rated!=null&&load!=null?String(Math.max(0,rated-load)):null}).onConflictDoNothing();
      await db.update(energyPowerLines).set({feederAssetId:feederAsset.id}).where(eq(energyPowerLines.assetId,line.assetId));
      await db.insert(energyAssetRelations).values({fromAssetId:feederAsset.id,toAssetId:line.assetId,relationType:'FEEDS',sourceRelationType:'EVN_INFERRED',inferred:1,metadata:{feederCode}}).onConflictDoNothing();
      if(substation?.id)await db.insert(energyAssetRelations).values({fromAssetId:substation.id,toAssetId:feederAsset.id,relationType:'FEEDS',sourceRelationType:'EVN_INFERRED',inferred:1,metadata:{feederCode}}).onConflictDoNothing();
      if(bayId)await db.insert(energyAssetRelations).values({fromAssetId:bayId,toAssetId:feederAsset.id,relationType:'FEEDS',sourceRelationType:'EVN_INFERRED',inferred:1,metadata:{feederCode}}).onConflictDoNothing();
      linkedLines+=1;
    }catch(error){errors.push({assetId:line.assetId,message:error instanceof Error?error.message:'Không thể suy diễn phát tuyến.'});}
  }
  return {created,reused,linkedLines,skipped,errors};
}
