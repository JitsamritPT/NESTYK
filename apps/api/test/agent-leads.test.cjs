const { test }=require('node:test');const assert=require('node:assert/strict');const ts=require('typescript');require('reflect-metadata');
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(require('node:fs').readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true,emitDecoratorMetadata:true,esModuleInterop:true},fileName:filename}).outputText,filename);
const {AgentLeadsService,validateLead}=require('../src/agent/leads/agent-leads.service.ts');const {AgentLeadsController}=require('../src/agent/leads/agent-leads.controller.ts');const {AuthService}=require('../src/auth/auth.service.ts');const {Module}=require('@nestjs/common');const {NestFactory}=require('@nestjs/core');
test('lead validation requires name/phone and preserves unknown versus false',()=>{
 const value=validateLead({province:'กรุงเทพมหานคร',name:'  A  ',phone:' 123 ',hasPets:false});assert.equal(value.name,'A');assert.equal(value.hasPets,false);assert.equal(value.usesCar,null);
 for(const patch of [{province:'กรุงเทพมหานคร',name:''},{phone:5},{budgetMin:-1},{budgetMax:Infinity},{budgetMin:200,budgetMax:100},{budgetMax:0},{occupantCount:0},{leaseDurationMonths:1.5},{visaTypeId:0},{hasPets:'false'},{nationality:[]},{budgetMax:1.111}])assert.throws(()=>validateLead({province:'กรุงเทพมหานคร',name:'A',phone:'123',...patch}));
 assert.equal(validateLead({province:'กรุงเทพมหานคร',name:'A',phone:'123',status:'booked'}).status,undefined);
});
test('lead HTTP API saves profile, rejects invalid catalogs and scopes reads to current agent',async(t)=>{
 process.env.ALLOW_DEV_AUTH='true';const saved=[];
 const repo={create:b=>({...b}),save:async b=>{if(b.id){const idx=saved.findIndex(row=>row.id===b.id);if(idx>=0){saved[idx]={...saved[idx],...b};return saved[idx];}}const row={...b,id:saved.length+1,created_at:new Date(),desired_room_type:b.desired_room_type_id?{code:'studio'}:null,visa_type:b.visa_type_id?{code:'tourist'}:null};saved.push(row);return row;},findOne:async({where})=>saved.find(row=>row.id===where.id&&row.created_by_user_id===where.created_by_user_id)||null};
 const catalog={findOne:async({where})=>where.id===1||where.term_months===12?{id:1,code:'tourist',term_months:12,is_active:true}:null,find:async()=>[{id:1,code:'tourist'}]};
 const service=new AgentLeadsService(repo,catalog,catalog,catalog);
 service.locationCatalog=async()=>[{name:'กรุงเทพมหานคร',nameEn:'Bangkok',locations:['วัฒนา','คลองเตย']}];
 class TestModule{};Module({controllers:[AgentLeadsController],providers:[{provide:AgentLeadsService,useValue:service},{provide:AuthService,useValue:{findBySupabaseUserId:async id=>({id:Number(id)}),loadUserWithRoles:async id=>({id,roleNames:id===8?['guest']:['agent']})}}]})(TestModule);
 const app=await NestFactory.create(TestModule,{logger:false});t.after(()=>app.close());app.setGlobalPrefix('api/v1');await app.listen(0,'127.0.0.1');const base=await app.getUrl();
 const headers=id=>({'Content-Type':'application/json',Authorization:`Bearer dev|${id}|test@example.invalid`});
 assert.equal((await fetch(base+'/api/v1/agent/leads')).status,401);
 assert.equal((await fetch(base+'/api/v1/agent/leads',{method:'POST',headers:headers(8),body:'{}'})).status,403);
 const post=body=>fetch(base+'/api/v1/agent/leads',{method:'POST',headers:headers(7),body:JSON.stringify(body)});
 assert.equal((await post({province:'กรุงเทพมหานคร',name:'A'})).status,400);
 assert.equal((await post({province:'กรุงเทพมหานคร',name:'A',phone:'123',desiredRoomTypeId:999})).status,400);
 assert.equal((await post({province:'กรุงเทพมหานคร',name:'A',phone:'123',visaTypeId:999})).status,400);
 assert.equal((await post({province:'กรุงเทพมหานคร',name:'A',phone:'123',leaseDurationMonths:4})).status,400);
 assert.equal((await post({province:'กรุงเทพมหานคร',name:'A',phone:'123',locations:['เมืองเชียงใหม่']})).status,400);
 const provinceOnly=await post({province:'เชียงใหม่',name:'Province only',phone:'123'});assert.equal(provinceOnly.status,201);assert.deepEqual((await provinceOnly.json()).locations,[]);saved.length=0;
 const visas=await fetch(base+'/api/v1/agent/leads/visa-types',{headers:headers(7)});assert.equal(visas.status,200);assert.equal((await visas.json())[0].code,'tourist');
 assert.equal((await fetch(base+'/api/v1/agent/leads/visa-types',{headers:headers(8)})).status,403);
 const input={locationName:'BTS Asok',locationPlaceId:'test-place',latitude:13.737,longitude:100.56,radiusKm:3,locations:['วัฒนา','คลองเตย'],province:'กรุงเทพมหานคร',name:'Test lead',phone:'TEST',nationality:'Test',budgetMin:10000,budgetMax:15000,preferredLocation:'Test location',moveInPlan:'Next month',hasPets:false,occupation:'Test occupation',visaTypeId:1,leaseDurationMonths:12,usesCar:true,occupantCount:2,isSmoker:false,desiredRoomTypeId:1};
 const response=await post({...input,created_by_user_id:9,status:'booked'});assert.equal(response.status,201);const lead=await response.json();for(const [key,value]of Object.entries(input))assert.deepEqual(lead[key],value,key);assert.equal(lead.visaTypeCode,'tourist');assert.equal(lead.status,'new');assert.equal(saved[0].created_by_user_id,7);assert.equal(saved[0].rent_room_id,null);
 assert.equal((await fetch(base+'/api/v1/agent/leads/'+lead.id,{headers:headers(9)})).status,404);
 const firstView=await fetch(base+'/api/v1/agent/leads/'+lead.id,{headers:headers(7)});assert.equal(firstView.status,200);const viewed=await firstView.json();assert.equal(viewed.status,'viewed');assert.equal(saved[0].status,'viewed');assert.ok(saved[0].viewed_at);
 const secondView=await fetch(base+'/api/v1/agent/leads/'+lead.id,{headers:headers(7)});assert.equal((await secondView.json()).status,'viewed');
 saved[0].status='booked';saved[0].viewed_at=new Date('2020-01-01');
 const bookedView=await fetch(base+'/api/v1/agent/leads/'+lead.id,{headers:headers(7)});const booked=await bookedView.json();assert.equal(booked.status,'booked');assert.equal(new Date(saved[0].viewed_at).toISOString(),'2020-01-01T00:00:00.000Z');
});

test('province and location validation rejects malformed inputs and canonicalizes province aliases', () => {
 const valid = {name:'A', phone:'123', province:'Bangkok'};
 assert.equal(validateLead(valid).province, 'กรุงเทพมหานคร');
 assert.deepEqual(validateLead(valid).locations, []);
 assert.deepEqual(validateLead({...valid, locations:['เขตวัฒนา', 'วัฒนา']}).locations, ['วัฒนา']);
 for (const patch of [{province:'not-a-province'}, {locations:'วัฒนา'}, {locations:[3]}, {locations:['']}, {locations:Array(51).fill('วัฒนา')}]) assert.throws(() => validateLead({...valid, ...patch}));
});
test('area filters are scoped by agent and province before pagination', async () => {
 const calls = [];
 const qb = {};
 for (const method of ['leftJoinAndSelect','where','andWhere','orderBy','addOrderBy','skip','take']) qb[method] = (...args) => {calls.push([method, ...args]); return qb;};
 qb.getManyAndCount = async () => [[], 42];
 const service = new AgentLeadsService({createQueryBuilder:()=>qb}, {}, {}, {});
 const page = await service.list(7, {province:'Bangkok',locations:JSON.stringify(['วัฒนา','คลองเตย']),includeUnspecified:'true',page:'2'});
 assert.equal(page.total, 42);
 assert.ok(calls.some(([method,sql,args])=>method==='where' && args.agentId===7));
 assert.ok(calls.some(([method,sql,args])=>method==='andWhere' && args.province==='กรุงเทพมหานคร'));
 assert.ok(calls.some(([method,sql,args])=>method==='andWhere' && sql.includes('cardinality') && args.locations.length===2));
 assert.ok(calls.findIndex(([method])=>method==='andWhere') < calls.findIndex(([method])=>method==='skip'));
 assert.ok(calls.some(([method,n])=>method==='skip' && n===20));
 calls.length=0;
 await service.list(7, {province:'Bangkok',locations:'["วัฒนา"]'});
 assert.ok(calls.some(([method,sql])=>method==='andWhere' && sql.includes('&&') && !sql.includes('cardinality')));
 await assert.rejects(()=>service.list(7,{locations:'["วัฒนา"]'}));
 await assert.rejects(()=>service.list(7,{province:'invalid'}));
 await assert.rejects(()=>service.list(7,{province:'Bangkok',locations:'{}'}));
});

test('location catalog normalizes property provinces and deduplicates districts', async () => {
 const qb={select(){return this;},addSelect(){return this;},distinct(){return this;},async getRawMany(){return [{province:'Bangkok',district:'เขตวัฒนา'},{province:'กรุงเทพมหานคร',district:'วัฒนา'},{province:'จังหวัดเชียงใหม่',district:'อำเภอเมืองเชียงใหม่'},{province:'Bangkok',district:'-'},{province:'unknown',district:'area'}];}};
 const service=new AgentLeadsService({manager:{getRepository:()=>({createQueryBuilder:()=>qb})}}, {}, {}, {});
 const catalog=await service.locationCatalog();
 assert.equal(catalog.length,77);
 assert.deepEqual(catalog.find(p=>p.name==='กรุงเทพมหานคร').locations,['วัฒนา']);
 assert.deepEqual(catalog.find(p=>p.name==='เชียงใหม่').locations,['เมืองเชียงใหม่']);
 assert.deepEqual(catalog.find(p=>p.name==='ภูเก็ต').locations,[]);
});

test('optional map pin requires complete valid coordinates, name and supported radius',()=>{
 const base={province:'Bangkok',name:'A',phone:'123'};
 const pin={locationName:'BTS Asok',locationPlaceId:'abc',latitude:13.737,longitude:100.56,radiusKm:3};
 assert.equal(validateLead(base).latitude,null);
 assert.equal(validateLead({name:'A',phone:'123'}).province,null);
 assert.throws(()=>validateLead({...base,...pin,province:null}));
 assert.equal(validateLead({...base,...pin}).radiusKm,3);
 for(const patch of [{latitude:91},{latitude:NaN},{longitude:-181},{longitude:Infinity},{radiusKm:2},{radiusKm:'3'},{longitude:null},{locationName:''},{latitude:undefined}]) assert.throws(()=>validateLead({...base,...pin,...patch}));
 assert.throws(()=>validateLead({...base,locationName:'orphan'}));
});
