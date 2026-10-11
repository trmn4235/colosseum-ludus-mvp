# Ortak tema V68 — yerel doğrulama

Onaylanan beyaz / bordo / açık altın arayüz, 14 HTML giriş noktasına ve
paylaşılan oyun pencerelerine uygulandı. Son tema katmanı
`roman-theme-v68.css`; renk kaynağı `roman-ui-v56.css`.

Pazarın dar menüsü, üstteki küçük Yeni İlan düğmesi, kompakt denarius rozeti,
kontrastlı ikonları ve çakışmayan panel başlıkları korunur.

## Doğrulama

Chromium 153 ile, canlı hesaba bağlanmadan ve gerçek işlem göndermeden:

- Pazar: dört yatay boyutta 12 boş/liste/oluştur görünümü, satın alma
  penceresi, Basic geçişi ve dikey ekran kapısı; sıfır tarayıcı hatası.
- Pazar birim ve fixture çalışma testleri: 7/7.
- Giriş: beş boyutta form, giriş hatası, kayıt, şifre sıfırlama, açılış
  animasyonu, azaltılmış hareket ve eksik görsel senaryoları.
- Gladyatör/antrenman: altı boyut, taşmayan ekipman yerleşimi ve mevcut
  yorgunluk, sakatlık, toplu antrenman/günlük sınır senaryoları.
- Ekipman: beş boyut; sayfalama, filtreler, kuşanma ve başarısız işlemde
  durumun korunması, sıfır sayfa hatası.
- İmparator döngüsü: 20 liste, 60 detay, dört yönetim günü;
  görsel kırpılması veya beklenmeyen kaydırma yok.
- İmparator günlük görevleri: beş boyut, dört görev, ödül/sandık koşulları,
  geçmiş sıfırlama, sekmeyi koruyan yenileme, antrenman yönlendirmesi ve
  yeniden deneme; sıfır sayfa hatası.
- Klan sandığı: Chromium'da yedi boyut; sayfalama, sahte eşya/taş aktarımı,
  çift tıklama, yetersiz bakiye, kayıp yanıt tekrar denemesi ve salt okunur
  yetki kontrolleri geçti. Aynı testin WebKit ayağı, tarayıcı kurulu olmadığı
  için çalıştırılamadı; Safari/iPhone doğrulaması olarak sunulmaz.
- `tests/theme-pages-v68.cjs`: 14 sayfada tek tema bağlantısı; sekiz ekranın
  üç boyutta 24 görünümü ve beş klan sekmesi. Aktif menü kontrastı dahil
  hesaplanmış CSS renkleri doğrulandı. Görev, klan ve seviyede gerçek
  çizim kodu + yalıtılmış veri; geliştirme, savaş hazırlığı, arena, çok oyunculu
  sıra ve kurulumda yalnızca gerçek HTML/CSS (oyun oturumu başlatılmaz).

## Sınırlar

Bu çalışma CSS/yerleşim kapsamındadır. Gerçek çok oyunculu maç, üretim
sunucusu, fiziksel telefon veya WebKit test edildiği iddia edilmez.
3B model/sahne ve görev resimlerindeki doğal renkler yeniden boyanmaz.
Ekran görüntüleri fixture verileriyle hazırlanmıştır.
GitHub aktarımı ve canlı yayın bu yerel doğrulamanın parçası değildir.

## Örnekler

- `clan-mobile.png`: klan salonu, 844 × 390.
- `missions-mobile.png`: günlük görevler, 844 × 390.
- `gladiator-mobile.png`: gladyatör penceresi, 844 × 390.
- `imperial-mobile.png`: imparator görevleri, 844 × 390.
