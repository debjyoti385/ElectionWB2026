/* ── Authoritative AC → District mapping for West Bengal (294 constituencies) ── */
window.WB_DISTRICT_MAP = (function() {
  const m = {};

  // Cooch Behar: AC 1–9
  for (let i=1;i<=9;i++) m[i]='Cooch Behar';

  // Alipurduar: AC 10–14
  for (let i=10;i<=14;i++) m[i]='Alipurduar';

  // Jalpaiguri: AC 15–21
  for (let i=15;i<=21;i++) m[i]='Jalpaiguri';

  // Kalimpong: AC 22
  m[22]='Kalimpong';

  // Darjeeling: AC 23–27
  for (let i=23;i<=27;i++) m[i]='Darjeeling';

  // Uttar Dinajpur: AC 28–36
  for (let i=28;i<=36;i++) m[i]='Uttar Dinajpur';

  // Dakshin Dinajpur: AC 37–42
  for (let i=37;i<=42;i++) m[i]='Dakshin Dinajpur';

  // Malda: AC 43–54
  for (let i=43;i<=54;i++) m[i]='Malda';

  // Murshidabad: AC 55–76
  for (let i=55;i<=76;i++) m[i]='Murshidabad';

  // Nadia: AC 77–93
  for (let i=77;i<=93;i++) m[i]='Nadia';

  // North 24 Parganas: AC 94–126
  for (let i=94;i<=126;i++) m[i]='North 24 Parganas';

  // South 24 Parganas: AC 127–148, 151, 155, 156
  for (let i=127;i<=148;i++) m[i]='South 24 Parganas';
  m[151]='South 24 Parganas';
  m[155]='South 24 Parganas';
  m[156]='South 24 Parganas';

  // Kolkata: AC 149, 150, 152–154, 157–168
  m[149]='Kolkata'; m[150]='Kolkata';
  for (let i=152;i<=154;i++) m[i]='Kolkata';
  for (let i=157;i<=168;i++) m[i]='Kolkata';

  // Howrah: AC 169–184
  for (let i=169;i<=184;i++) m[i]='Howrah';

  // Hooghly: AC 185–202
  for (let i=185;i<=202;i++) m[i]='Hooghly';

  // Purba Medinipur: AC 203–218
  for (let i=203;i<=218;i++) m[i]='Purba Medinipur';

  // Paschim Medinipur: AC 219, 223–233, 235–236
  m[219]='Paschim Medinipur';
  for (let i=223;i<=233;i++) m[i]='Paschim Medinipur';
  m[235]='Paschim Medinipur';
  m[236]='Paschim Medinipur';

  // Jhargram: AC 220–222, 234, 237
  m[220]='Jhargram'; m[221]='Jhargram'; m[222]='Jhargram';
  m[234]='Jhargram'; m[237]='Jhargram';

  // Purulia: AC 238–246
  for (let i=238;i<=246;i++) m[i]='Purulia';

  // Bankura: AC 247–258
  for (let i=247;i<=258;i++) m[i]='Bankura';

  // Purba Bardhaman: AC 259–274
  for (let i=259;i<=274;i++) m[i]='Purba Bardhaman';

  // Paschim Bardhaman: AC 275–283
  for (let i=275;i<=283;i++) m[i]='Paschim Bardhaman';

  // Birbhum: AC 284–294
  for (let i=284;i<=294;i++) m[i]='Birbhum';

  return m;
})();
