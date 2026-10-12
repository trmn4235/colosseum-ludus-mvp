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
