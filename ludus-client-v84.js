/* One default client per page; simultaneous user checks share only their in-flight request. */
var LudusClient=(()=>{
 const clients=new Map();
 function standard(options){
  if(!options)return true;
  if(Object.keys(options).some(k=>k!=='auth'))return false;
  const a=options.auth||{},defaults={persistSession:true,autoRefreshToken:true,detectSessionInUrl:true};
  return Object.keys(a).every(k=>Object.hasOwn(defaults,k)&&a[k]===defaults[k]);
 }
 function create(url,key,options){
  if(!standard(options))return supabase.createClient(url,key,options);
  const id=url+'\n'+key;if(clients.has(id))return clients.get(id);
  const client=supabase.createClient(url,key,options),getUser=client.auth.getUser.bind(client.auth);let pending=null;
  client.auth.getUser=function(jwt){
   if(jwt!==undefined)return getUser(jwt);
   if(pending)return pending;
   const request=Promise.resolve().then(()=>getUser());
   pending=request.finally(()=>{if(pending===task)pending=null;});const task=pending;return task;
  };
  client.auth.onAuthStateChange(event=>{if(event!=='INITIAL_SESSION')pending=null;});
  clients.set(id,client);return client;
 }
 return {create};
})();
if(typeof module!=='undefined')module.exports=LudusClient;
// All signed-in game pages share the ranked invitation indicator.
if(typeof document!=='undefined'&&!/\/ranked-team-v244\.html$/.test(location.pathname)){
 const installRankedInvites=()=>{
  if(!globalThis.supabase||document.querySelector('script[data-ranked-invites]'))return;
  const script=document.createElement('script');script.src='ranked-invites-v244.js?v=244';script.dataset.rankedInvites='244';document.body.append(script);
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installRankedInvites,{once:true});else installRankedInvites();
}
