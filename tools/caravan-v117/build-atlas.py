"""Place source cities on an illustrated, deliberately non-survey game atlas.

Geographic source coordinates are preserved in the V116 catalog. These artwork
anchors follow the relief illustration, whose perspective is not a projection.
No database coordinates or city identities are changed.
"""
import base64, html, json
from pathlib import Path
root=Path(__file__).resolve().parents[2]
cities=json.loads((root/'assets/caravan-v116/cities.json').read_text())
anchors=[
 (45.8,42.3),(45.2,43.1),(48.9,46.0),(49.0,46.9),(48.5,47.5),(48.7,36.6),(49.5,31.0),(42.4,32.9),(46.1,33.0),(55.5,48.3),(54.1,49.5),(51.3,59.5),
 (24.0,46.0),(17.7,55.5),(11.0,55.0),(8.8,57.0),(7.2,60.0),(8.0,52.5),(20.8,43.8),(26.0,44.5),(3.5,45.2),
 (33.8,30.2),(35.5,37.7),(30.3,38.9),(34.2,36.5),(21.0,32.1),(41.0,18.8),(42.4,14.8),(45.0,19.0),
 (23.8,15.4),(25.0,13.4),(20.0,8.0),
 (65.8,57.7),(64.2,57.5),(63.6,48.6),(58.7,44.1),(56.2,36.8),(59.4,33.7),(67.5,42.2),(72.4,42.3),
 (70.8,54.9),(70.4,53.3),(71.0,51.4),(75.3,45.9),(75.5,44.6),(82.4,47.2),(88.0,56.7),(88.0,51.5),
 (91.5,59.4),(91.2,65.1),(90.8,67.4),(90.3,69.9),(93.3,66.8),(80.1,76.1),(42.5,60.2),(50.3,74.6),(66.0,73.6),(36.8,61.0),(41.1,64.2),(82.7,82.0)
]
assert len(cities)==len(anchors)==60
points={str(c['id']):list(p) for c,p in zip(cities,anchors)}
(root/'ludus-caravan-atlas-v117.js').write_text('/* Visual anchors on the illustrated atlas; source coordinates remain unchanged. */\nvar LudusCaravanAtlas='+json.dumps(points,separators=(',',':'))+';\n')
terrain=base64.b64encode((root/'assets/caravan-v117/atlas-terrain.webp').read_bytes()).decode()
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000" preserveAspectRatio="none">','<image width="1600" height="1000" preserveAspectRatio="none" href="data:image/webp;base64,'+terrain+'"/>']
# Readable major place labels. Every city remains a clickable pin in the UI.
major={1,6,8,10,12,13,14,15,17,18,21,22,23,26,27,28,30,32,33,35,36,37,38,39,40,41,46,47,48,49,50,53,54,55,56,57,58,59,60}
svg.append('<g font-family="Georgia,serif" font-size="15" fill="#fff1cd" stroke="#182f2d" stroke-width="3" paint-order="stroke" stroke-linejoin="round">')
for c,(x,y) in zip(cities,anchors):
 x*=16;y*=10
 svg.append(f'<circle cx="{x}" cy="{y}" r="4" fill="#651d29" stroke="#f5d999" stroke-width="1.5"/>')
 if c['id'] in major:
  dx,dy,align=9,-7,'start'
  if c['id'] in {49,50,53}: dx,dy,align=-9,-6,'end'
  if c['id'] in {14,17,33,41,54,56,57,59,60}: dy=20
  name=html.escape(c['name'].replace(' (Cappadocia)',''))
  svg.append(f'<text x="{x+dx}" y="{y+dy}" text-anchor="{align}">{name}</text>')
svg.append('</g><text x="65" y="920" font-family="Georgia,serif" font-size="30" letter-spacing="4" fill="#fff1cd" stroke="#71502c" stroke-width="2" paint-order="stroke">ROMA · MS 80</text></svg>')
(root/'assets/caravan-v117/roman-atlas.svg').write_text(''.join(svg))
