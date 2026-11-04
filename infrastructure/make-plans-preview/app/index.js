const crypto=require('node:crypto');
const {DynamoDBClient}=require('@aws-sdk/client-dynamodb');
const {DynamoDBDocumentClient,GetCommand,PutCommand,QueryCommand,TransactWriteCommand}=require('@aws-sdk/lib-dynamodb');
const db=DynamoDBDocumentClient.from(new DynamoDBClient({}),{marshallOptions:{removeUndefinedValues:true}}),TableName=process.env.TABLE_NAME;
const json=(statusCode,body)=>({statusCode,headers:{'content-type':'application/json','cache-control':'no-store'},body:JSON.stringify(body)});
const clean=(v,max=160)=>String(v||'').trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,max);
const now=()=>new Date().toISOString(),userPk=u=>`USER#${u}`,friendSk=u=>`FRIEND#${u}`;
const claims=e=>e.requestContext?.authorizer?.jwt?.claims||{};
const actor=e=>clean(claims(e)['cognito:username']||claims(e).username,64).toLowerCase();
const body=e=>{try{return e.body?JSON.parse(e.body):{}}catch{return {}}};
async function queryUser(u,prefix){return (await db.send(new QueryCommand({TableName,KeyConditionExpression:'pk=:pk AND begins_with(sk,:sk)',ExpressionAttributeValues:{':pk':userPk(u),':sk':prefix}}))).Items||[]}
async function profile(u){return (await db.send(new GetCommand({TableName,Key:{pk:userPk(u),sk:'PROFILE'}}))).Item}
async function friendship(a,b){return (await db.send(new GetCommand({TableName,Key:{pk:userPk(a),sk:friendSk(b)}}))).Item}
async function requireAccepted(a,b){const f=await friendship(a,b);if(f?.status!=='accepted')throw Object.assign(Error('Make Plans is available only with accepted friends.'),{statusCode:403})}
function planView(i){return {planId:i.planId,title:i.title,startAt:i.startAt,timeZone:i.timeZone,place:i.place||'',note:i.note||'',inviter:i.inviter,invitee:i.invitee,status:i.status,responses:i.responses,revision:i.revision,createdAt:i.createdAt,updatedAt:i.updatedAt}}
async function planRows(id){return (await db.send(new QueryCommand({TableName,IndexName:'gsi1',KeyConditionExpression:'gsi1pk=:p',ExpressionAttributeValues:{':p':`PLAN#${id}`}}))).Items||[]}
async function notify(u,type,plan,message,stamp){await db.send(new PutCommand({TableName,Item:{pk:userPk(u),sk:`NOTICE#${stamp}#${plan.planId}`,kind:'notice',type,message,planId:plan.planId,createdAt:stamp,read:false}}))}
async function writePlanRows(items,expected){await db.send(new TransactWriteCommand({TransactItems:items.map(item=>({Put:{TableName,Item:item,...(expected?{ConditionExpression:'revision=:r',ExpressionAttributeValues:{':r':expected}}:{ConditionExpression:'attribute_not_exists(pk) AND attribute_not_exists(sk)'})}}))}))}
async function handler(event){
  if(event.requestContext?.http?.method==='OPTIONS')return {statusCode:204,headers:{'cache-control':'no-store'},body:''};
  const u=actor(event);if(!u)return json(401,{error:'Authentication required.'});
  const method=event.requestContext.http.method,path=event.rawPath,data=body(event),stamp=now();
  try{
    if(method==='POST'&&path==='/profile'){
      const displayName=clean(data.displayName||u,60);await db.send(new PutCommand({TableName,Item:{pk:userPk(u),sk:'PROFILE',kind:'profile',username:u,displayName,createdAt:stamp,updatedAt:stamp},ConditionExpression:'attribute_not_exists(pk)'})).catch(async e=>{if(e.name!=='ConditionalCheckFailedException')throw e});return json(200,{profile:await profile(u)});
    }
    if(method==='GET'&&path==='/directory'){
      const target=clean(event.queryStringParameters?.username,64).toLowerCase();const p=target?await profile(target):null;return json(200,{profile:p?{username:p.username,displayName:p.displayName}:null});
    }
    if(method==='GET'&&path==='/friends')return json(200,{friends:(await queryUser(u,'FRIEND#')).map(x=>({username:x.otherUser,displayName:x.otherDisplayName||x.otherUser,status:x.status,direction:x.direction}))});
    if(method==='POST'&&path==='/friends/request'){
      const target=clean(data.username,64).toLowerCase();if(!target||target===u)return json(400,{error:'Choose another registered reviewer.'});const p=await profile(target);if(!p)return json(404,{error:'Reviewer not found.'});const mine=await profile(u);await db.send(new TransactWriteCommand({TransactItems:[{Put:{TableName,Item:{pk:userPk(u),sk:friendSk(target),kind:'friend',otherUser:target,otherDisplayName:p.displayName,status:'pending',direction:'outgoing',updatedAt:stamp}}},{Put:{TableName,Item:{pk:userPk(target),sk:friendSk(u),kind:'friend',otherUser:u,otherDisplayName:mine?.displayName||u,status:'pending',direction:'incoming',updatedAt:stamp}}}]}));return json(200,{ok:true});
    }
    if(method==='POST'&&path==='/friends/respond'){
      const target=clean(data.username,64).toLowerCase(),status=data.status==='accepted'?'accepted':'declined';const current=await friendship(u,target);if(current?.direction!=='incoming'||current.status!=='pending')return json(409,{error:'No pending request from that reviewer.'});const mine=await profile(u),theirs=await profile(target);await db.send(new TransactWriteCommand({TransactItems:[{Put:{TableName,Item:{...current,status,updatedAt:stamp}}},{Put:{TableName,Item:{pk:userPk(target),sk:friendSk(u),kind:'friend',otherUser:u,otherDisplayName:mine?.displayName||u,status,direction:'outgoing',updatedAt:stamp}}}]}));return json(200,{ok:true,status});
    }
    if(method==='GET'&&path==='/plans')return json(200,{plans:(await queryUser(u,'PLAN#')).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).map(planView)});
    if(method==='GET'&&path==='/notifications')return json(200,{notifications:(await queryUser(u,'NOTICE#')).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,50)});
    if(method==='POST'&&path==='/plans'){
      const invitee=clean(data.invitee,64).toLowerCase();await requireAccepted(u,invitee);const title=clean(data.title,100),startAt=clean(data.startAt,40),timeZone=clean(data.timeZone,80);if(!title||!startAt||!timeZone)return json(400,{error:'Title, date/time, and a valid time zone are required.'});try{new Intl.DateTimeFormat('en',{timeZone}).format()}catch{return json(400,{error:'Choose a valid IANA time zone.'})}const key=clean(event.headers?.['idempotency-key']||crypto.randomUUID(),100),planId=crypto.createHash('sha256').update(`${u}:${key}`).digest('hex').slice(0,24),existing=await planRows(planId);if(existing.length){const own=existing.find(x=>x.gsi1sk===u);return own?json(200,{plan:planView(own),replayed:true}):json(409,{error:'That request key is already in use.'})}const recent=(await queryUser(u,'PLAN#')).filter(x=>x.inviter===u&&x.createdAt.slice(0,10)===stamp.slice(0,10));if(recent.length>=20)return json(429,{error:'Daily plan limit reached.'});const base={kind:'plan',planId,title,startAt,timeZone,place:clean(data.place,160),note:clean(data.note,500),inviter:u,invitee,status:'pending',responses:{[u]:'going',[invitee]:'pending'},revision:1,createdAt:stamp,updatedAt:stamp,gsi1pk:`PLAN#${planId}`};const rows=[u,invitee].map(name=>({...base,pk:userPk(name),sk:`PLAN#${planId}`,gsi1sk:name}));await writePlanRows(rows);await notify(invitee,'plan_invitation',base,`${u} invited you to ${title}.`,stamp);return json(201,{plan:planView(base)});
    }
    const match=path.match(/^\/plans\/([a-f0-9]{24})(?:\/(response|cancel))?$/);if(match){
      const rows=await planRows(match[1]);if(rows.length!==2||!rows.some(x=>x.gsi1sk===u))return json(404,{error:'Plan not found.'});const current=rows[0],expected=Number(data.revision);if(expected!==current.revision)return json(409,{error:'This plan changed. Refresh and try again.',revision:current.revision});let next={...current,revision:current.revision+1,updatedAt:stamp};delete next.pk;delete next.sk;delete next.gsi1sk;
      if(match[2]==='response'){const response=['going','maybe','declined'].includes(data.response)?data.response:null;if(!response)return json(400,{error:'Choose Going, Maybe, or Declined.'});next.responses={...current.responses,[u]:response};next.status=Object.values(next.responses).includes('declined')?'declined':Object.values(next.responses).every(x=>x==='going')?'going':'pending'}
      else if(match[2]==='cancel'){if(u!==current.inviter)return json(403,{error:'Only the inviter can cancel this plan.'});next.status='cancelled'}
      else {if(method!=='PATCH'||u!==current.inviter)return json(403,{error:'Only the inviter can edit this plan.'});next={...next,title:clean(data.title||current.title,100),startAt:clean(data.startAt||current.startAt,40),timeZone:clean(data.timeZone||current.timeZone,80),place:clean(data.place,160),note:clean(data.note,500),status:'changed'}}
      const updated=rows.map(row=>({...next,pk:row.pk,sk:row.sk,gsi1sk:row.gsi1sk}));await writePlanRows(updated,current.revision);const other=u===current.inviter?current.invitee:current.inviter;await notify(other,match[2]==='cancel'?'plan_cancelled':match[2]==='response'?'plan_response':'plan_changed',next,`${u} updated ${next.title}.`,stamp);return json(200,{plan:planView(next)});
    }
    return json(404,{error:'Not found.'});
  }catch(error){console.error(JSON.stringify({name:error.name,message:error.message,requestId:event.requestContext?.requestId}));return json(error.statusCode||500,{error:error.statusCode?error.message:'The review service could not complete that request.'})}
}
module.exports={handler};
