# V223: bounded login artwork recovery

The entry panel previously remained inert and hidden if the login artwork
request or `HTMLImageElement.decode()` never settled. V223 gives both phases
one shared eight-second deadline, then uses the existing artwork fallback.
The two-second visible landscape presentation and existing reveal remain
unchanged. Late image completion cannot restart the introduction.

The entry script URL is versioned to load the correction for returning players.
No authentication, account data, game assets, layout or hosting settings change.

Validation covers hung requests, hung decoding, normal and failed images,
late completion, cleanup, and visibility/orientation behavior. Browser
regressions exercise the actual entry page with isolated account responses in
Chromium and WebKit; the required art-direction suite runs both engines.

## Original issue 7 remains subject to device verification

The reported iPhone Safari message said the network connection was lost before
the game page opened. That native navigation error has not been reproduced or
attributed to this artwork defect. The entry document and its direct assets
were unchanged from V212 through V219. The V222 live entry page was verified
to reach its login form in the available cloud browser.

This change fixes a reproduced in-page loading stall. It does not establish
the cause of the original phone network error or claim a physical iPhone test.
