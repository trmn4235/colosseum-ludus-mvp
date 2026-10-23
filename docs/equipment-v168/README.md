# V168 — Silah ve kalkan alt kategorileri

Basic pazar, Forum Pazarı ve üretim ekranı aynı alt kategorileri kullanır. Kılıçlar: Gladius, Sica, kol bıçağı. Trident/mızrak: Trident ve mızrak. Gürzler/çekiçler: zincirli gürz, ağır gürz, savaş çekici. Ağ/kırbaç: savaş ağı ve kırbaç. Kalkanlar: büyük; küçük/orta.

| Ürün | Tek üretimde tüketilenler | Çıktı |
|---|---|---|
| Ağır gürz | 3 çelik külçe, 1 bronz külçe, 2 odun, 1 işlenmiş deri, 1 reçine | 1 silah +0 |
| Savaş çekici | 4 çelik külçe, 1 bronz külçe, 2 odun, 2 işlenmiş deri, 1 reçine | 1 silah +0 |

Üretim mevcut yetkili RPC ve tekrar işlem korumasını kullanır. Para, stok veya envanter dağıtımı yapılmaz. Yeni ürünler mevcut Basic fiyatı olan 100 denarius üzerinden kayıtlıdır.

Gürz/çekiç grubunun kalkana başarılı şekilde engellenen iki vuruşu kalkanı o savaşta devre dışı bırakır. Boşa saldırı, kaçış ve silahla savuşturma sayılmaz. Kusursuz kalkan savunması sayılır. Sayaç kalkan üzerindedir: normal yere bırakma/alma sayacı sıfırlamaz; başka kalkanın kendi sayacı vardır. Parçalanmış savaş nesnesi tekrar kuşanılamaz. Kırılma tek başına kalıcı envanter silme işlemi değildir; normal ölüm ve eşya kaybetme kuralları sürer. Çok oyunculu savaşta sunucu darbe ve ekipman değişikliğini yönetir. Eski kervan kayıtları 126/127/163 davranışını korur; yeni kayıtlar 168 kullanır.

Model kaynakları, özgün lisanslar ve boyama bilgileri ../equipment-v167/README.md ile ../../assets/equipment-v167/CREDITS.md içindedir. Yeni ikonlar ImageGen yerleşik aracıyla, assets/items-v118/gladius.webp yalnızca stil referansı alınarak oluşturuldu; CGTrader kaynak modelleri üretken görsel aracına verilmedi. Oyun dosyaları: assets/items-v168/heavy_mace.webp ve assets/items-v168/warhammer.webp. İkisi de şeffaf 320×320 WebP.

İkon istemleri: gerçekçi müze ürün fotoğrafı; koyu çelik baş, eskitilmiş bronz bağlantılar, ahşap sap ve deri tutuş; baş sol üstte ve kabza sağ altta, tüm nesne kadrajda, şeffaf arka plan, metinsiz ve çerçevesiz. Çekiç: geniş dikdörtgen baş. Gürz: kısa konik dikenli yuvarlak baş, zincirsiz.

Doğrulama: equipment-groups-v168.cjs, equipment-sql-v168.cjs; LUDUS_EQUIPMENT_TEST=1 production-v119.cjs; equipment-browser-v168.cjs; equipment-production-browser-v168.cjs; combat-motion-replay-v163.cjs. UI testleri yerel sahte hesap verisi kullanır, gerçek alım veya üretim yapmaz.
