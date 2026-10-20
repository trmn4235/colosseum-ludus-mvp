# Ahır V132: mobil paneller

Two height/width media queries used `)and(`, so the browser discarded them. On landscape phones, the stable retained the desktop layout and clipped controls below the visible panel. Both queries now use valid spacing.

The panel no longer reserves a footer row when there is no message. Landscape stat controls use inline labels; the history, ancestry and care cards fit their available height. The duel setup uses two columns and an active duel retains a full-width track. Unknown ancestors retain the “Kayıt yok” label without repeating a long sentence in every card. The page versions both changed CSS/JS references as revision132.

Validation used the complete ludus.html page in Chromium/WebGL with fixture account responses; no live account operations were performed. All seven tabs passed at 874×402 and 667×375, including the visible saved-message footer, purchase confirmation/cancel and an active duel. Three exit/re-entry cycles preserved cached models, removed stable collisions on exit and restored movement/menu state. No page or shader errors were observed. The existing stable UI regression, JavaScript syntax and diff checks passed. Physical iPhone FPS was not measured.
