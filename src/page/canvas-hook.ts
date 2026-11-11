import type { Remapper, Role } from "../remap/remap.ts";

export type DrawMethod =
  | "fillRect"
  | "fill"
  | "fillText"
  | "strokeRect"
  | "stroke"
  | "strokeText";

export interface DrawObserver {
  readonly onDraw: (
    method: DrawMethod,
    canvas: HTMLCanvasElement,
    recoloured: boolean
  ) => void;
  readonly onColor: (
    css: string,
    role: Role,
    mapped: string | undefined
  ) => void;
}

export interface CanvasHookOptions {
  readonly remapper: Remapper;
  /** Which canvases to recolour. */
  readonly appliesTo: (canvas: HTMLCanvasElement) => boolean;
  readonly observer?: DrawObserver | undefined;
}

type Context = CanvasRenderingContext2D;

const ruleMaxThickness = 2;

const isRule = (width: number, height: number): boolean =>
  Math.min(Math.abs(width), Math.abs(height)) <= ruleMaxThickness;

/**
 * Recolours drawing on the canvases `appliesTo` selects by patching the 2D
 * context's draw methods. Each patched call reads the style it is about to
 * paint with, swaps in the remapped colour for that one call, and restores the
 * original, so code reading `fillStyle` back sees its own value. Text, strokes
 * and rectangles thin enough to be rules (underlines, strike-throughs) are ink;
 * other fills are paper. Gradients, patterns and images pass through untouched.
 */
export const installCanvasHook = ({
  remapper,
  appliesTo,
  observer,
}: CanvasHookOptions): void => {
  const paint = (
    context: Context,
    method: DrawMethod,
    role: Role,
    draw: () => void
  ): void => {
    const applies = appliesTo(context.canvas);
    observer?.onDraw(method, context.canvas, applies);
    const property = method.startsWith("fill") ? "fillStyle" : "strokeStyle";
    const style = context[property];

    if (
      !applies ||
      style instanceof CanvasGradient ||
      style instanceof CanvasPattern
    ) {
      draw();

      return;
    }

    const mapped = remapper.remap(style, role);
    observer?.onColor(style, role, mapped);

    if (mapped === undefined || mapped === style) {
      draw();

      return;
    }

    context[property] = mapped;

    try {
      draw();
    } finally {
      context[property] = style;
    }
  };

  const { prototype } = CanvasRenderingContext2D;
  const nativeFillRect = prototype.fillRect;
  const nativeFillText = prototype.fillText;
  const nativeStrokeRect = prototype.strokeRect;
  const nativeStrokeText = prototype.strokeText;

  const nativeFillCurrentPath: (
    this: Context,
    fillRule?: CanvasFillRule
  ) => void = prototype.fill;

  const nativeFillPath: (
    this: Context,
    path: Path2D,
    fillRule?: CanvasFillRule
  ) => void = prototype.fill;

  const nativeStrokeCurrentPath: (this: Context) => void = prototype.stroke;

  const nativeStrokePath: (this: Context, path: Path2D) => void =
    prototype.stroke;

  prototype.fillRect = function fillRect(this: Context, x, y, w, h) {
    paint(this, "fillRect", isRule(w, h) ? "ink" : "paper", () => {
      nativeFillRect.call(this, x, y, w, h);
    });
  };

  prototype.fill = function fill(
    this: Context,
    pathOrRule?: Path2D | CanvasFillRule,
    rule?: CanvasFillRule
  ) {
    paint(this, "fill", "paper", () => {
      if (pathOrRule instanceof Path2D) {
        nativeFillPath.call(this, pathOrRule, rule);
      } else {
        nativeFillCurrentPath.call(this, pathOrRule);
      }
    });
  };

  prototype.fillText = function fillText(this: Context, ...args) {
    paint(this, "fillText", "ink", () => {
      nativeFillText.apply(this, args);
    });
  };

  prototype.strokeRect = function strokeRect(this: Context, ...args) {
    paint(this, "strokeRect", "ink", () => {
      nativeStrokeRect.apply(this, args);
    });
  };

  prototype.stroke = function stroke(this: Context, path?: Path2D) {
    paint(this, "stroke", "ink", () => {
      if (path === undefined) {
        nativeStrokeCurrentPath.call(this);
      } else {
        nativeStrokePath.call(this, path);
      }
    });
  };

  prototype.strokeText = function strokeText(this: Context, ...args) {
    paint(this, "strokeText", "ink", () => {
      nativeStrokeText.apply(this, args);
    });
  };
};
