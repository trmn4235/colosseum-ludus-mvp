# V282 — Onaylanan arayüz güncellemesi

17 Kasım 2026 tarihli kullanıcı yayın talebiyle V269–V281 birikimi hazırlanmıştır.

- Ayarlar: Beyaz Mermer (bordo/altın), Siyah Mermer (antrasit/gümüş), Mavi (petrol/şampanya). Seçim cihazda saklanır; açılan oyun sayfaları aynı tercihi kullanır.
- Ekipman: oranı korunan dikey kartlar, sağ üstte sade geliştirme sayısı, on ürünlük envanter, okunabilir özellikler ve zümrüt yuvaları; yeni kolluk, bacaklık ve göğüslük ikonları.
- Klan ana sayfası: tek yatay menü, kompakt klan/EXP kartı, kenar boşluksuz kaynak haritası ve çalışan ekip sayıları, iki savaş kartı. Başlıklar üstte, kadro düğmeleri altta.
- Kariyer: K/D, K/D/A ve galibiyet/mağlubiyet. K/D/A yalnızca aynı maçta kaydedilmiş öldürme, ölüm ve asist verileriyle hesaplanır; eksik geçmiş veri uydurulmaz.

## Yayın öncesi doğrulama

27 tema, klan ve ekipman kontrolü; kariyer veritabanı testi; 27 yayın kapısı testi geçti. Eski ana sayfa seçicileri ve dokuz öğeli menü beklentisi onaylanan tasarıma uyarlandı. Mevcut yayın kapısına tema ve iki savaş kartının regresyon kontrolleri eklendi.

`20261117071544_career_kda_v271` canlı Supabase projesine uygulandı. Gerçek hesap üzerinde salt okunur yanıt/sahiplik doğrulaması geçti; anonim erişim kapalı kaldı. Güvenlik danışmanı bulguları uygulama öncesiyle aynı.

## Sınırlar

Ön izleme örnek hesapları, ekipleri, savaş saatleri ve kadroları üretim dosyalarında yoktur. Mevcut sunucu savaş takvimi sağlamadığından iki savaş kartı gerçek takvim gelene kadar bekleme durumunu gösterir. Bu paket yeni savaş zamanlayıcısı veya 10 kişilik savaş sunucusu eklemez. Genel savaş kadrosu menüsündeki mevcut işlev korunur.

Cloudflare R2 mevcut büyük model dosyalarının kaynağıdır; ayrı bir Pages/Workers sitesi yoktur. Bu arayüz paketi yeni 3B model gerektirmez.
