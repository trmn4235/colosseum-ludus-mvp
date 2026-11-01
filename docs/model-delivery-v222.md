# V222 — Güncel model için doğrulanmış yedek indirme

V219 incelemesinde GitHub Pages güncel `gladiator-mobile-v217.glb` dosyasını sunarken R2'de aynı yol 404 dönüyordu. Eski model ve Colosseum R2'de mevcuttu. Bu, ana indirme başarısız olduğunda yeni karakterin yedekten yüklenmesini engelliyordu.

Arena, savaş seçimi, çok oyunculu, Ludus, kervan/Aventinus ve Circus Maximus savaş arabası yükleyicileri güncel model için depodaki sabit `4ee4be451aada7ecda4414962423da542ce5f904` commit'inin GitHub Raw adresini kullanır. Birincil kaynak ve ortak önbellek korunur. Her model yüklemesinde dosya uzunluğu ve SHA-256 doğrulanır; farklı veya eksik model önbelleğe alınmaz. Eski çevre modellerinin mevcut R2 yolu değişmez. Kervan/Aventinus ve Circus betik önbellekleri ile girişten Ludus'a geçiş adresi yenilenir.

Circus, diğer sahnelerin bağımsız satır içi yükleyicileriyle aynı indirme davranışını `model-delivery-v222.js` içindeki ayrı `LudusModelDelivery` alanından çağırır. Bu betik `ArenaAssetLoad`, `ArenaAssets` veya `ARENA_ASSET_BASE` genel değişkenlerini tanımlamaz; Circus'taki Ludus sahibi karakterinin mevcut yükleyici seçimini değiştirmez. Donanım, animasyon ve yarış davranışı değişmez. Deniz savaşındaki isteğe bağlı LOD dosyası mevcut davranışını korur; indirme başarısız olursa tam model kullanılır.

`Model delivery` altı gerçek yükleyiciyi, başarısız veya takılmış indirmeyi, bozuk önbelleği, yanlış dosyayı, tekrar denemeyi ve mevcut R2 çevre modelini test eder. Circus'un gerçek `create` çağrısının GLTF ayrıştırıcısına verdiği veriler ayrıca doğrulanır: birincil kaynak arızası, bozuk önbellek/birincil dosya ve başka sahneden ortak önbellek kullanımı. Ludus sahibi yükleyicisinin değişmediği de kontrol edilir. Canlı yedek adresinden dosyanın tamamını indirip içerik ve CORS doğrulaması yapılır. Yeni aktif gladyatör modeli kaydedilmeden kontrol geçmez.

Bu düzeltme R2'ye dosya yüklemez; Cloudflare hesabına giriş bu oturumda tamamlanamadığı için eksik R2 kopyaları ayrı bir yönetim işidir. Güncel modelin yedek indirmesi eksik R2 yolunu kullanmaz. GitHub Raw ve Pages farklı alan adları kullanır, fakat aynı sağlayıcıya aittir. Fiziksel iPhone bağlantı arızasının çözüldüğü iddia edilmez.

Doğrulama:

```sh
node --test tests/model-delivery-v222.test.cjs
python3 tools/verify-model-mirrors-v222.py
node --test tests/*.test.cjs
```
