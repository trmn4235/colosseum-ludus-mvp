// Frozen V190 template for silhouette and attachment regression.
 function detailedGreave(){if(detailedGear.greave)return detailedGear.greave;const g=new T.Group(),metal=hammeredBronze;g.userData.asset='fitted-greave-v17';
  const shell=mesh(g,new T.LatheGeometry([[-.225,.059],[-.19,.064],[-.08,.077],[.08,.090],[.20,.103],[.235,.092]].map(([y,r])=>new T.Vector2(r,y)),22,0,Math.PI*1.5),metal);shell.rotation.y=-Math.PI*.75;shell.scale.z=.87;
  for(const [y,r]of [[-.219,.06],[.228,.096]]){const rim=mesh(g,new T.TorusGeometry(r,.006,5,22,Math.PI*1.5),metal,0,y);rim.rotation.x=Math.PI/2;rim.rotation.z=Math.PI*.25;rim.scale.y=.87;}
  for(const [y,r]of [[-.155,.07],[.13,.100]]){mesh(g,new T.CylinderGeometry(r,r,.026,16,1,true),dark,0,y);box(g,.023,.023,.012,metal,.057,y,.053);}
  edge(g,[[0,-.215,.057],[0,-.11,.073],[0,.045,.081],[0,.205,.091]],.008,metal);
  for(const side of [-1,1])for(const y of [-.17,-.085,0,.085,.17])sphere(g,.005,metal,side*.05,y,.058);
  return detailedGear.greave=batch(g);
 }
