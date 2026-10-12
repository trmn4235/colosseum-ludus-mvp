# Multiplayer ranked duyuruları · V92

Multiplayer sekmesine iki yeni görsel kart eklendi. İki kartın altında da **YAKINDA** yazıyor.

| Mod | Katılım | Başlangıç | Galibiyet | Mağlubiyet |
| --- | --- | --- | --- | --- |
| Ranked Arena | Tek başına veya 1–4 arkadaşla, 5 kişilik takım | 1500 puan | +20 | −5 |
| 10’a 10 Arena | İki takım, takım başına 10 gladyatör | Belirtilmedi | +10 | −10 |

Bu sürüm tanıtım ve arayüz değişikliğidir. Ranked kartları maç başlatmaz; eşleştirme, arkadaş daveti ve puan hesaplaması bu sürümde devreye alınmadı. Mevcut Multiplayer Beta düğmesi aynı hazırlık ve maç akışını kullanır. Beş kişilik modun rakip takım büyüklüğü belirtilmediği için arayüzde “5’e 5” varsayımı yapılmadı.

## Tasarım

- Beş kişilik takım görselinde farklı silah ve zırhlara sahip tam beş gladyatör yan yana durur.
- 10’a 10 görselinde bordo ve mavi iki takım karşılaşır.
- Başlık, puanlar, katılım açıklaması ve Yakında durumu HTML olarak yazılmıştır; görsele gömülü metin yoktur.
- Bordo, antik altın ve sıcak arena ışığı mevcut oyunun görsel dilini sürdürür.
- Kart yüksekliği ekran alanına uyarlanır. Dar yatay ekranlarda görselin üst kısmı korunur; beş gladyatörü yatayda kesen kırpma yapılmaz.
- Başlangıç puanı yalnızca belirtilen beş kişilik kartta gösterilir.
- Ana sayfadan arenaya geçiş V92 adresini kullanır.

## Dosyalar ve doğrulama

- `assets/multiplayer-v92/ranked-team.webp` — 1536 × 1024, 434.778 bayt.
- `assets/multiplayer-v92/ranked-ten.webp` — 1536 × 1024, 544.448 bayt.
- `multiplayer-ranked-v92.css` — iki yeni kart ve mevcut beta yerleşimi.
- `savas.html`, `arena-tabs-v81.js` — içerik ve sekme başlığı.
- `ludus.html` — arena adresi sürümü.

`tests/arena-tabs-v81.cjs` ile 1536×706, 1024×768, 844×390, 667×375 ve 568×320 boyutlarında üç sekme kontrol edildi: 15 görünüm. Kartların ekrana sığması, görsellerin yüklenmesi, gladyatörleri yatayda kırpmaması, puan alanlarında taşma olmaması, iki Yakında durumu ve yalnızca mevcut beta düğmesinin maç seçimine bağlı olması doğrulandı. Geniş ekran, tablet ve küçük telefon ekran görüntüleri görsel olarak incelendi.

## Görsel üretimi

İki özgün görsel yerleşik **image_gen** aracıyla üretildi. CLI/API fallback kullanılmadı. Kaynak PNG’ler üretim için WebP kalite 88 biçimine dönüştürüldü; piksel içeriği sonradan değiştirilmedi. Aşağıdaki metinler kullanılan tam üretim promptlarıdır.

### ranked-team.webp

```text
Use case: historical-scene.
Asset type: premium cinematic artwork for a Roman gladiator game's upcoming ranked team mode. A standalone illustration, NOT an interface or screenshot.
Primary request: EXACTLY FIVE distinct adult gladiator teammates, shoulder to shoulder in a clear, confident lineup, on the sand inside a magnificent crowded Roman Colosseum. All five equally readable, each a different gladiator class. From left to right: a bronze-armored murmillo with broad rectangular shield and short gladius, an athletic lightly armored retiarius with net and trident, a commanding thraex with crested helmet small shield and curved sica, a steel-helmeted secutor with round smooth helmet and shield, and a dark-haired dimachaerus with two short swords. Five people total in foreground, no sixth fighter, no duplicate bodies. Natural human anatomy and individual faces, battle-worn bronze, iron and leather. Team of friends, coordinated but varied poses, friendly solidarity and disciplined power.
Style: lavish AAA historical game key art, cinematic realistic 3D/painted realism, exquisite physical texture, believable Roman equipment, sophisticated production finish.
Composition: landscape 3:2 image. ALL FIVE head-to-toe figures contained within the central 86% width and central 80% height, aligned in a single row with clear space between silhouettes and weapons. Camera at chest height, medium-wide ensemble portrait, arena arches frame the team behind. No foreground occlusion. Leave a little breathable arena sand below their feet and warm atmospheric architecture above.
Lighting: warm late afternoon sunlight, soft volumetric rays, subtle dust, powerful but natural skin tones, burgundy Roman banners and antique gold accents, creamy stone, deep shadows with readable details.
Text: none. No letters, numbers, rating emblems, menus, card borders, labels, watermarks or logos. No modern or medieval plate armor, no magic, no gore.
```

### ranked-ten.webp

```text
Use case: historical-scene.
Asset type: premium cinematic artwork for the same Roman gladiator game's upcoming ranked TEN AGAINST TEN mode. Standalone illustration, NOT an interface or screenshot.
Primary request: two opposing organized squads of Roman gladiators facing each other across the sand of a grand crowded Colosseum, red-burgundy team to left and muted blue-steel team to right. Ten fighters in each squad, twenty warriors in total, naturally arranged in two staggered ranks per side, visually read as a grand team battle. Distinct shields, gladii, spears/tridents and gladiator helmets. Front two opposing captains anchor the composition, other fighters fan behind them into the middle distance, no chaotic overlapping pile of bodies. Readable, disciplined confrontation before battle, not active bloodshed.
Style: lavish AAA historical game key art, cinematic realistic 3D/painted realism, exquisite physically believable bronze, steel, leather, rich but restrained color, elegant production quality.
Composition: landscape 3:2 image. Balanced symmetrical rivalry viewed slightly from above, enough room to read both groups; all important silhouettes within central 86% width. Arena arches, densely packed tiny spectators, rich burgundy banners, arena gate in far center. Clear wedge of sunlit sand between squads leading the eye into the arena. Warriors fill most of the image so groups remain readable as a small game mode card. No close foreground occlusion.
Lighting: warm late afternoon sun, dramatic golden rim light, thin dust haze, sunlit ivory stone contrasting deep burgundy and steel-blue teams; realistic natural anatomy.
Text: none. No letters, numbers, score emblems, UI, menus, decorative card borders, watermarks or logos. No fantasy monsters, no magic, no guns, no blood or gore.
```
