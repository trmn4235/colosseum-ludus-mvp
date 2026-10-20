# V137 · Compact dialog polish

The follow-up visual audit found two issues that outer-frame checks missed: the character editor required scrolling through its controls at 568×320, and the compact message thread showed metadata while clipping both its text and read-more action.

V137 keeps the V136 art direction and uses its existing imperial-orders illustration for empty and failed mission states. It adds no image payload. The shared stylesheet stays in its original first-priority layer; all eleven active entries request revision137, and the courtyard requests the updated mission renderer.

Changes:

- Two-column character controls fit the small landscape viewport. Body values sit beside their labels, the selected tab has a brass underline, and the preview caption has a readable white backing.
- Compact message threads put the back action beside the identity, leaving enough height for the message and its read-more link. Long text remains paged in full; confirmation dialogs share the white/brass material treatment.
- Friend lists use more of the viewport and provide larger request, accept, remove and pagination controls. Long account labels stay within their own rows.
- Mission empty/error states show the existing sealed-orders artwork, a clear heading and, when applicable, a retry action. Returning from daily tasks to an empty imperial list updates the subtitle correctly. Historic assignments remain accessible.
- The login divider now has adequate contrast against the burgundy plaque. Imperial title line height accommodates the local Roman font.

Verification uses isolated fixtures, with no production account writes. `tests/art-details-v137.cjs` checks 11 states at each of six landscape sizes: character face/body/dress, mission detail/daily/empty/two failure views, and empty/accepted/pending friends. It checks inner content as well as outer bounds, mission selection and recovery after failure. The message regression now loads the actual art layer, checks bubble contents at all six sizes, and reconstructs the complete long message from its compact pages. Existing daily-quest tests cover history, claims, tab retention and retry; entry tests cover registration, cinematic timing, rotation and missing-art recovery. These checks are included in the art-direction workflow alongside the existing page, room and gameplay gates.

Browser layout checks are not physical-device performance measurements. Combat, workshop geometry, account APIs and game economy are unchanged.
