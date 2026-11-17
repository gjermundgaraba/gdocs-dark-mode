/** An sRGB colour: channels are bytes (0–255), alpha is 0–1. */
export interface Rgba {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

/** OKLCH with hue in radians. */
export interface Oklch {
  readonly l: number;
  readonly c: number;
  readonly h: number;
}

interface Oklab {
  readonly l: number;
  readonly a: number;
  readonly b: number;
}

const hexPattern = /^#[\da-f]{6}$/iu;

const rgbaPattern =
  /^rgba\(\s*(?<r>\d{1,3})\s*,\s*(?<g>\d{1,3})\s*,\s*(?<b>\d{1,3})\s*,\s*(?<a>\d*\.?\d+)\s*\)$/iu;

const byte = (value: number): number =>
  Math.round(Math.min(255, Math.max(0, value)));

/** Whether `value` is a `#rrggbb` colour, in either case. */
export const isHexColor = (value: unknown): value is string =>
  typeof value === "string" && hexPattern.test(value);

export const rgb = (r: number, g: number, b: number, a = 1): Rgba => ({
  r,
  g,
  b,
  a,
});

/**
 * Reads a canvas `fillStyle` or `strokeStyle`. Canvas reports colours in
 * exactly two shapes, `#rrggbb` when opaque and `rgba(r, g, b, a)` otherwise
 * (https://html.spec.whatwg.org/multipage/canvas.html#serialisation-of-a-color),
 * so anything else is `undefined`.
 */
export const parseCanvasColor = (css: string): Rgba | undefined => {
  if (hexPattern.test(css)) {
    const value = Number.parseInt(css.slice(1), 16);

    return rgb((value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff);
  }

  const groups = rgbaPattern.exec(css)?.groups;

  if (groups === undefined) {
    return undefined;
  }

  const channels = [groups["r"], groups["g"], groups["b"]].map(Number);
  const alpha = Number(groups["a"]);

  if (channels.some((channel) => channel > 255) || alpha > 1) {
    return undefined;
  }

  const [r = 0, g = 0, b = 0] = channels;

  return rgb(r, g, b, alpha);
};

/** Reads an opaque `#rrggbb` colour, such as a theme token; throws on anything else. */
export const parseHex = (hex: string): Rgba => {
  const color = parseCanvasColor(hex);

  if (color === undefined || color.a !== 1) {
    throw new Error(`not an opaque #rrggbb colour: ${hex}`);
  }

  return color;
};

const hexByte = (value: number): string =>
  byte(value).toString(16).padStart(2, "0");

export const toHex = ({ r, g, b }: Rgba): string =>
  `#${hexByte(r)}${hexByte(g)}${hexByte(b)}`;

/** Serialises the way canvas does, so a mapped colour reads back unchanged. */
export const toCss = (color: Rgba): string =>
  color.a === 1
    ? toHex(color)
    : `rgba(${byte(color.r)}, ${byte(color.g)}, ${byte(color.b)}, ${Number(color.a.toFixed(3))})`;

/** `r,g,b`, the form Google's `--*-rgb` custom properties take. */
export const toRgbTriplet = ({ r, g, b }: Rgba): string =>
  `${byte(r)},${byte(g)},${byte(b)}`;

export const withAlpha = (color: Rgba, a: number): Rgba => ({ ...color, a });

const toLinear = (channel: number): number => {
  const value = channel / 255;

  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

const fromLinear = (value: number): number =>
  255 *
  (value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055);

const toOklab = ({ r, g, b }: Rgba): Oklab => {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];

  const l = Math.cbrt(
    0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb
  );

  const m = Math.cbrt(
    0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb
  );

  const s = Math.cbrt(
    0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb
  );

  return {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
};

const fromOklab = ({ l, a, b }: Oklab, alpha: number): Rgba => {
  const lc = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mc = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const sc = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return rgb(
    byte(fromLinear(4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc)),
    byte(
      fromLinear(-1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc)
    ),
    byte(fromLinear(-0.0041960863 * lc - 0.7034186147 * mc + 1.707614701 * sc)),
    alpha
  );
};

export const toOklch = (color: Rgba): Oklch => {
  const { l, a, b } = toOklab(color);

  return { l, c: Math.hypot(a, b), h: Math.atan2(b, a) };
};

/** The opaque sRGB colour nearest an OKLCH one, clamped into gamut. */
export const fromOklch = ({ l, c, h }: Oklch): Rgba =>
  fromOklab({ l, a: c * Math.cos(h), b: c * Math.sin(h) }, 1);

/** Interpolates in OKLab; `amount` 0 gives `from`, 1 gives `to`. Alpha comes from `from`. */
export const mix = (from: Rgba, to: Rgba, amount: number): Rgba => {
  const [x, y] = [toOklab(from), toOklab(to)];

  return fromOklab(
    {
      l: x.l + (y.l - x.l) * amount,
      a: x.a + (y.a - x.a) * amount,
      b: x.b + (y.b - x.b) * amount,
    },
    from.a
  );
};

/** Shortest distance between two hue angles, in radians. */
export const hueDistance = (x: number, y: number): number => {
  const difference = Math.abs(x - y) % (2 * Math.PI);

  return difference > Math.PI ? 2 * Math.PI - difference : difference;
};

export const luminance = ({ r, g, b }: Rgba): number =>
  0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

/** WCAG 2 contrast ratio of two opaque colours. */
export const contrast = (x: Rgba, y: Rgba): number => {
  const [lx, ly] = [luminance(x), luminance(y)];

  return (Math.max(lx, ly) + 0.05) / (Math.min(lx, ly) + 0.05);
};

/**
 * The colour that, painted at `alpha` over `backdrop`, composites to `target`.
 * Channels clamp when the exact colour is out of gamut.
 */
export const translucentOver = (
  target: Rgba,
  backdrop: Rgba,
  alpha: number
): Rgba => {
  const solve = (t: number, b: number): number =>
    byte((t - b * (1 - alpha)) / alpha);

  return rgb(
    solve(target.r, backdrop.r),
    solve(target.g, backdrop.g),
    solve(target.b, backdrop.b),
    alpha
  );
};
