/* Rein response, tyre slip and speed-dependent turn authority, shared by both races. */
var CircusMotion = (() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function advance(state, input, curve, target, dt = .05) {
    const n = {...state};
    const authority = .94 / (1 + Math.max(0, n.speed - 12) * .025);
    n.turn = (n.turn || 0) + (clamp(input, -1, 1) * authority - (n.turn || 0)) * (1 - Math.exp(-5.5 * dt));
    const radius = Math.max(7, 35 + n.lane), rate = curve ? n.speed / radius : 0;
    n.heading = clamp(n.heading + (n.turn + rate) * dt, -1.2, 1.2);
    const slipTarget = -n.turn * n.speed * Math.max(0, n.speed - 11) * .009;
    n.slip = (n.slip || 0) + (slipTarget - (n.slip || 0)) * (1 - Math.exp(-3.2 * dt));
    target *= 1 - Math.min(.20, Math.abs(n.turn) * n.speed * .009);
    n.speed += clamp(target - n.speed, -8 * dt, 3.4 * dt);
    n.lane += (Math.sin(n.heading) * n.speed + n.slip) * dt;
    n.distance += Math.max(0, Math.cos(n.heading)) * n.speed * dt / (curve ? Math.max(.2, 1 + state.lane / 35) : 1);
    return n;
  }
  return {advance};
})();
if (typeof module !== 'undefined') module.exports = CircusMotion;
