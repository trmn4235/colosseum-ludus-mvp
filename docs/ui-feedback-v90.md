# V90 — İşlem hatasının görünürlüğü

V89'da boş durum mesajı alanı gizlenerek tasarıma yer açılmıştı. Tarayıcı üretim veya sefer isteğini yerel depolamaya kaydedemezse işlem gönderilmeden duruyordu, ancak hata mesajı gizli alanda kalabiliyordu. Mesaj güncellendiğinde alanın görünürlüğü de artık hemen güncellenir.

İşlem kaydı oluşturulamıyorsa sunucuya istek gönderilmez. Depolama kullanılabilir olduğunda aynı üretim düğmesiyle işlem yapılabilir.

Doğrulama:

- `tests/gathering-ui-v85.cjs`: hata önce yeniden üretildi; düzeltmeden sonra görünür mesaj, boş bekleyen işlem, gönderilmemiş istek ve depolama düzeldikten sonra başarılı üretim kontrol edildi.
- `tests/ui-design-v89.cjs`: hata mesajıyla birlikte demirci kataloğu ve üretim kontrolleri 1536×706, 844×390, 667×375, 568×320 ve 1024×768 boyutlarında taşmadan görünür. İzole örnek verilerle çalışır; tarayıcı hatası yok.

Giriş ve güncellenen tedarik betiği `revision90` kullanır. V89 tasarımı korunur; SQL veya hesap verisi değişikliği yok.
