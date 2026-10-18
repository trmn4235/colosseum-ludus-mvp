"""Build the AD 80 city atlas from attributed geographic data; no network at runtime."""
import csv, json, math, pathlib, html

ROOT = pathlib.Path(__file__).resolve().parents[2]
sites = {r['label']: r for r in csv.DictReader(open('/tmp/caravan-orbis-sites.csv', newline=''))}
names = {
 'Italia': 'Roma|Ostia/Portus|Capua|Neapolis|Puteoli|Ravenna|Aquileia|Mediolanum|Verona|Brundisium|Tarentum|Syracusae',
 'Hispania': 'Tarraco|Carthago Nova|Corduba|Hispalis|Gades|Emerita Augusta|Caesaraugusta|Barcino|Bracara Augusta',
 'Gallia ve Ren': 'Lugdunum|Massilia|Narbo|Arelate|Burdigala|Augusta Treverorum|Ara Agrippinensium|Mogontiacum',
 'Britannia': 'Londinium|Camulodunum|Eburacum',
 'Balkanlar ve Yunanistan': 'Athenae|Corinthus|Thessalonica|Dyrrhachium|Salona|Sirmium|Philippopolis|Constantinopolis',
 'Anadolu': 'Ephesus|Smyrna|Pergamum|Nicaea|Nicomedia|Ancyra|Tarsus|Caesarea (Cappadocia)',
 'Doğu Akdeniz': 'Antiochia|Berytus|Tyrus|Caesarea Maritima|Damascus',
 'Africa ve Aegyptus': 'Alexandria|Carthago|Lepcis Magna|Cyrene|Hippo Regius|Hadrumetum|Memphis',
}
aliases={'Constantinopolis':'Byzantion', 'Ostia/Portus':'Ostia / Portus', 'Ara Agrippinensium':'Colonia Agrippinensis', 'Caesarea':'Caesarea Maritima'}
def project(lon, lat): return ((lon+12)/54*1600, (57-lat)/32*1000)
cities=[]
for region,group in names.items():
 for name in group.split('|'):
  s=sites[name]; lon,lat=float(s['x']),float(s['y']);x,y=project(lon,lat)
  cities.append(dict(id=len(cities)+1,name=aliases.get(name,name),region=region,lon=lon,lat=lat,x=round(x/16,3),y=round(y/10,3),orbis_id=s['id']))
assert len(cities)==60
out=ROOT/'assets/caravan-v116'
(out/'cities.json').write_text(json.dumps(cities,ensure_ascii=False,indent=2)+'\n')
topo=json.load(open('/tmp/caravan-land.json')); sx,sy=topo['transform']['scale'];tx,ty=topo['transform']['translate'];arcs=[]
for arc in topo['arcs']:
 x=y=0;points=[]
 for dx,dy in arc:
  x+=dx;y+=dy;points.append(project(x*sx+tx,y*sy+ty))
 arcs.append(points)
def ring(ids):
 pts=[]
 for i in ids: pts.extend(arcs[i] if i>=0 else list(reversed(arcs[~i])))
 return 'M'+'L'.join(f'{x:.1f},{y:.1f}' for x,y in pts)+'Z'
land=topo['objects']['land'];geometries=land.get('geometries',[land]);paths=[]
for g in geometries:
 polygons=g['arcs'] if g['type']=='MultiPolygon' else [g['arcs']]
 for poly in polygons: paths.append(''.join(ring(r) for r in poly))
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">',
 '<defs><radialGradient id="sea"><stop stop-color="#486d71"/><stop offset="1" stop-color="#203e49"/></radialGradient><radialGradient id="paper"><stop stop-color="#e5c992"/><stop offset="1" stop-color="#b99562"/></radialGradient><clipPath id="frame"><rect x="12" y="12" width="1576" height="976" rx="8"/></clipPath></defs>',
 '<rect width="1600" height="1000" fill="#5a3830"/><g clip-path="url(#frame)"><rect width="1600" height="1000" fill="url(#sea)"/>']
for d in paths: svg.append(f'<path d="{d}" fill="url(#paper)" stroke="#6c5a3d" stroke-width="1.6" fill-rule="evenodd"/>')
for lon in range(-10,43,5):
 x,_=project(lon,0);svg.append(f'<path d="M{x},0V1000" stroke="#f4dfac" opacity=".09"/>')
for lat in range(25,58,5):
 _,y=project(0,lat);svg.append(f'<path d="M0,{y}H1600" stroke="#f4dfac" opacity=".09"/>')
svg+=['<text x="65" y="95" fill="#e9d5a4" font-family="Georgia,serif" font-size="46" letter-spacing="5">ROMA · MS 80</text>', '<text x="65" y="130" fill="#cdbb95" font-family="Georgia,serif" font-size="21">Şehirler ve Akdeniz</text>', '<text x="780" y="690" text-anchor="middle" fill="#d4d6b7" opacity=".6" font-family="Georgia,serif" font-style="italic" font-size="35" letter-spacing="9">MARE INTERNVM</text>']
major={'Roma','Londinium','Lugdunum','Tarraco','Emerita Augusta','Carthago','Alexandria','Antiochia','Ephesus','Athenae','Byzantion','Lepcis Magna','Cyrene','Mediolanum','Tarsus','Ancyra','Gades','Burdigala','Colonia Agrippinensis'}
for c in cities:
 x,y=c['x']*16,c['y']*10;svg.append(f'<circle cx="{x}" cy="{y}" r="4.8" fill="#792e32" stroke="#f5df9d" stroke-width="1.4"/>')
 if c['name'] in major: svg.append(f'<text x="{x+9}" y="{y-7}" fill="#402d25" stroke="#e8d2a4" stroke-width="3" paint-order="stroke" font-family="Georgia,serif" font-size="19">{html.escape(c["name"])}</text>')
svg+=['</g><rect x="18" y="18" width="1564" height="964" rx="6" fill="none" stroke="#cfa95f" stroke-width="3"/></svg>']
(out/'roman-world.svg').write_text(''.join(svg))
print(f'Built {len(cities)} cities and geographic SVG')
