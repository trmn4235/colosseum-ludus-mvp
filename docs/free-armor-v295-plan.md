# V295 — Ücretsiz zırh ve özel bot görev sırası

Başlangıç: 23 Kasım 2026. Temel sürüm: V294 (`28afa00`).
Çalışma dalı: `codex/v295-free-armor-bots`.

Bu belge uygulama sırasını ve gerçek ilerlemeyi izler. V295 henüz yayımlanmadı.

## Onaylanan kapsam

| Varlık | Kullanım | Hedef üçgen | Görsel kalite için üst hedef |
| --- | --- | ---: | ---: |
| Aegis Sentinel | Solo20 ve Takımlı Arena'da bir özel rakip | 12.000 | 15.000 |
| Hoplomachus Gladiator | Solo20 ve Takımlı Arena'da bir özel rakip | 8.000 | 10.000 |
| Roman officer body armour | Orijinal ve siyah iki göğüs zırhı itemi | 3.000 | 4.000 |

Sayılar üretim hedefidir; indirilip optimize edilmiş dosya ölçümü değildir. Renkler aynı geometriyi paylaşacak, materyalleri ayrı olacak. Özel rakipler mevcut botların yerini alacak; savaşçı sayısı artmayacak. Önerilen ve kabul edilen güç farkı: +%15 can, +%10 hasar. Oyuncu ve takım arkadaşları değiştirilmez. Ranked, deniz savaşı, küçük arena ve Survival bu kapsamın dışındadır.

## Sıralı görevler

1. [x] Üç ücretsiz modeli ve kaynak kimliklerini seç; oyun kodundaki mevcut assetleri ve lisans kayıtlarını kontrol et.
2. [ ] Kaynak arşivleri resmi indirme yolundan edin; yazar, lisans, ek atıflar ve dosya SHA-256 değerlerini kaydet. **Engel:** Sketchfab indirme düğmesi oturum açılmasını istiyor. Seçilen Google girişi mevcut Sketchfab hesabına bağlama ekranına ulaştı; hesap bağlantısının kullanıcı tarafından tamamlanması gerekiyor. Kaynaklar henüz indirilmedi.
3. [ ] Gerçek dosyalardaki üçgen, materyal, doku, parça, iskelet ve animasyonları ölç. Zırh ile gövdeyi, sabit silah/kalkanları belirle; belirsiz noktaları gerçek dosyadan çöz.
4. [ ] Önce Officer göğüs zırhını, sonra Hoplomachus'u, sonra Aegis'i hedef bütçeye indir. Silueti ve eklem bölgelerini koru; normal harita aktarımı gerekirse ayrıca yap. Önce/sonra ölçümlerini kaydet.
5. [ ] İki tam karakteri oyunun 34 kemikli Mixamo uyumlu iskeletine uyarla. V294 animasyonlarıyla duruş, yürüyüş, koşu, saldırı, blok, yuvarlanma, düşme testlerini yap. Kaynak props ile oyun ekipmanının üst üste binmesini engelle.
6. [ ] Solo20 ve `4x5` Takımlı Arena'da birer özel rakip seçimini bağla. Deniz savaşının da `4x5` kullanmasına dikkat et. Can/hasar bonusu ekipman yenilenince kaybolmamalı veya katlanmamalı. Dosyalar ve iskelet doğrulanmadan özellik kapalı kalır.
7. [ ] Officer orijinal/siyah materyallerini ve gerçek modelden ikonlarını üret; iki ayrı item kimliğiyle envanter, kuşanma, üretim, isimler, gerekli veritabanı ve papirüs bağlantılarını tamamla. Renkler arasında istatistik farkı yaratma.
8. [ ] Kalıcı kayıt, kuşan/çıkar, renk değişimi, eşzamanlı farklı renkli savaşçılar, ölüm/ganimet ve mod ayrımını test et. Hareket sırasında titreme, kırpışma ve vücut/zırh kesişmesini görsel olarak denetle. Telefon performansını ayrıca ölç; yalnızca üçgen sayısından FPS sonucu çıkarma.
9. [ ] Gerçek final üçgen sayılarını, dosya boyutlarını ve atıfları kaydet; ilgili testleri tamamla. Ardından sürümü yayımla ve GitHub/Cloudflare/Supabase gereken değişikliklerini doğrula.

## Hazırlık bulguları

- V294 kodu ayrı geliştirme dalına alındı; canlı oyun değiştirilmedi.
- Kaynak modeller mevcut kayıtlı modeller arasında bulunamadı. Eski `gladiator_chest` Officer değildir.
- Oyunun karakter yükleyicisi tek gövde şablonu ve belirli kemik adları bekliyor. İndirilen GLB'yi doğrudan değiştirmek yeterli değildir.
- Zırh çözümleyicisi bilinmeyen göğüs modelini eski modele düşürüyor; iki yeni kimlik açıkça eklenmelidir.
- Materyal klonlanmadan siyaha boyamak orijinal rengi de değiştirir. Geometri paylaşılabilir; renk materyalleri paylaşılmaz.
- Blender ölçüm/optimizasyon aracı hazır; mevcut farklı bir zırh üzerinde 3.305 → 2.000 üçgen denemesi yapıldı. Bu ölçüm Officer'a ait değildir.
- Model dosyaları hazır olana kadar kapalı kalacak bot mantığı hazır. Oyunun gerçek savaş/ekipman koduyla 11 test geçti. Oyun sayfalarına henüz bağlanmadı.
- Officer için envanter, kuşanma, iki renk ve üretim bağlantıları incelendi. Mevcut V288 Demirci papirüsleri modelden bağımsız çalışıyor; yeni model için ayrıca papirüs listesi genişletilmeyecek.

İlgili uygulama notları: `elite-bots-v295-integration.md`, `officer-chest-v295-integration.md`, `../tools/armor-v295/README.md`. Kaynak kaydı: `../assets/armor-v295/source-manifest.json`.
