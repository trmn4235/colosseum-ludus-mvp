# V283 — clan members design preview

Status: design preview, based on published V282 (`ee4e1d3c2ebfd48cd523904332b4e0c9a5c847c6`). Not deployed to the live game.

The members directory displays ten Ludus accounts in two columns of five cards, with the existing horizontal clan navigation. A selected card reveals the account's role, online status, and vault permission. Counts and permissions come from the existing clan response; no combat statistics or other unavailable values are invented.

The leader's invitation search and three-result pagination remain connected to the existing actions. Ordinary members retain the leave-clan confirmation and a link to the war roster. The directory paginates in groups of ten when the clan grows. New styles use the existing white, black, and blue theme tokens and are scoped to the members view.

Validation: JavaScript syntax and whitespace checks passed. The actual page was inspected in the managed browser using isolated example clan data: 1280×588, 874×402 and 568×320; ten visible cards without panel overflow; selection changes the detail panel; invitation search returns and paginates results; an eleven-member directory reaches its second page; the non-leader view omits invitation controls. All three themes were visually checked. No invitations or account mutations were sent to the game server.

The preview fixture and example data are outside the game source. The screenshot is illustrative and does not represent live account counts. Next: review this members design, then continue with the remaining clan pages.
