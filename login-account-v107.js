/* Retry only the read-only welcome lookup. A fresh Auth session can briefly
 * receive PGRST303 from the Data API; keep the same session while it settles. */
var LudusLoginAccount = (() => {
 'use strict';
 const delays = [800, 1600, 3200];
 function aborted(){return new DOMException('Account lookup cancelled', 'AbortError');}
 function pause(ms, signal){
  return new Promise((resolve, reject) => {
   if(signal?.aborted){reject(aborted());return;}
   const stop = () => {clearTimeout(timer);signal?.removeEventListener('abort', stop);reject(aborted());};
   const timer = setTimeout(() => {signal?.removeEventListener('abort', stop);resolve();}, ms);
   signal?.addEventListener('abort', stop, {once:true});
  });
 }
 async function request(client, userId, signal){
  if(signal?.aborted)throw aborted();
  const controller = new AbortController();
  let timedOut = false, rejectAbort;
  const stop = () => {controller.abort();rejectAbort(timedOut ? Object.assign(new Error('Account lookup timed out'), {status:408}) : aborted());};
  const cancelled = new Promise((_, reject) => {rejectAbort = reject;});
  const timer = setTimeout(() => {timedOut = true;stop();}, 8000);
  signal?.addEventListener('abort', stop, {once:true});
  try{
   const query = client.from('ludus_accounts').select('ludus_name').eq('user_id', userId).abortSignal(controller.signal).single();
   return await Promise.race([query, cancelled]);
  }finally{clearTimeout(timer);signal?.removeEventListener('abort', stop);}
 }
 function retryable(error, status){
  // Do not repeatedly mint fresh tokens for PGRST303 or replay any writes.
  return error?.code === 'PGRST303' || status === 0 || status === 408 || status === 429 || status >= 500 || error instanceof TypeError;
 }
 async function read(client, sessionUser, {signal, onRetry = () => {}} = {}){
  if(!sessionUser?.id || sessionUser.is_anonymous)throw new Error('Hesabına yeniden giriş yapmalısın.');
  for(let attempt = 0; attempt <= delays.length; attempt++){
   if(signal?.aborted)throw aborted();
   let failure, status;
   try{
    const result = await request(client, sessionUser.id, signal);
    if(signal?.aborted)throw aborted();
    if(!result.error && typeof result.data?.ludus_name === 'string' && result.data.ludus_name.trim())return result.data;
    failure = result.error || new Error('Ludus kaydı bulunamadı.');status = result.status;
   }catch(error){
    if(signal?.aborted || error?.name === 'AbortError')throw aborted();
    failure = error;status = error?.status;
   }
   if(attempt === delays.length || !retryable(failure, status)){
    throw Object.assign(new Error('Ludus bilgisi şu an alınamadı. Tekrar deneyebilirsin.'), {cause:failure});
   }
   onRetry(attempt + 1);
   await pause(delays[attempt], signal);
  }
 }
 return {read};
})();
if(typeof module !== 'undefined')module.exports = LudusLoginAccount;
