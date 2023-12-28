import Regl, { Framebuffer2D } from "regl";
import "./style.css";

const canvas = document.createElement("canvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
document.body.appendChild(canvas);

const regl = Regl({
  canvas,
  extensions: [
    "angle_instanced_arrays",
    "OES_texture_float",
    "EXT_blend_minmax",
    "oes_texture_float_linear",
    "EXT_float_blend",
  ],
  pixelRatio: 2,
  attributes: {
    preserveDrawingBuffer: false,
    depth: false,
    alpha: true,
    premultipliedAlpha: false,
    stencil: false,
  },
});

const state = {
  N:
    parseFloat(new URLSearchParams(window.location.search).get("n")!) ||
    Math.min(Math.round((window.innerWidth * window.innerHeight) / 10000), 150),
  influenceScale:
    parseFloat(
      new URLSearchParams(window.location.search).get("influence-scale")!,
    ) || 2,
  size: 12.5,
  spread: 4.5,
  alphaScale: 1,
  rr: 0.776,
  rg: 0.295,
  rb: 0.685,
  gr: -0.646,
  gg: 0.658,
  gb: 0.552,
  br: 0.477,
  bg: 0.627,
  bb: 0.532,
};

declare global {
  interface Window {
    state: typeof state;
  }
}

window.state = state;

function stringify(s: Partial<typeof state>) {
  return Object.fromEntries(
    Object.entries(s).map(([key, value]) => [key, `${value}`]),
  );
}

function setState(partial: Partial<typeof state>) {
  window.state = {
    ...window.state,
    ...partial,
  };
  const params = new URLSearchParams(stringify(window.state));
  window.history.replaceState({}, "", `${location.pathname}?${params}`);
}

function initStateBindings() {
  const params = Object.fromEntries(
    new URLSearchParams(location.search).entries(),
  ) as Partial<Record<keyof typeof state, string>>;

  const toLoad = { ...window.state, ...params };
  for (let key in toLoad) {
    console.log(key);
    const boundEl = document.querySelector<HTMLInputElement>(
      `[data-state="${key}"]`,
    );
    const value = toLoad[key as keyof typeof state];
    window.state[key as keyof typeof state] =
      typeof value === "string" ? parseFloat(value) : value;

    if (!boundEl) continue;

    boundEl.value = `${value}`;
    console.log(params, toLoad, key, value, window.state);
    boundEl.addEventListener("input", (e) => {
      setState({
        [key]: parseFloat((e?.target as HTMLInputElement)?.value),
      });
    });
  }
}

initStateBindings();

const N = state.N;
const influenceScale = state.influenceScale;

const resolution = [window.innerWidth, window.innerHeight];

const influenceResolution = [
  resolution[0] / influenceScale,
  resolution[1] / influenceScale,
];

const positionFbo_1 = regl.framebuffer({
  width: N,
  height: N,
  depth: false,
  colorType: "float",
});
const positionFbo_2 = regl.framebuffer({
  width: N,
  height: N,
  depth: false,
  colorType: "float",
});
const colorsFbo = regl.framebuffer({
  width: N,
  height: N,
  colorType: "float",
});
const speedFbo_1 = regl.framebuffer({
  width: N,
  height: N,
  depth: false,
  colorType: "float",
});
const speedFbo_2 = regl.framebuffer({
  width: N,
  height: N,
  depth: false,
  colorType: "float",
});

const influenceTexture = regl.texture({
  width: Math.round(influenceResolution[0]),
  height: Math.round(influenceResolution[1]),
  min: "linear",
  mag: "linear",
  premultiplyAlpha: false, // default = false
  type: "float",
});

const influenceFbo = regl.framebuffer({
  width: Math.round(influenceResolution[0]),
  height: Math.round(influenceResolution[1]),
  depth: false,
  depthTexture: false,
  depthStencil: false,
  stencil: false,
  color: influenceTexture,
  colorType: "float",
});

// draws some random colors
const randomInit = regl({
  frag: `
    precision highp float;
    varying vec2 pos;
    uniform vec2 seed;
    float rand(vec2 co){
      return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main () {
      vec3 c = vec3(
        rand(pos + seed),
        rand(pos * 2. + seed),
        rand(pos * 3. + seed)
      );
      // c = c / length(c);
      gl_FragColor = vec4(
        c,
        1.
      );
    }
  `,
  vert: `
    precision highp float;
    attribute vec2 position;
    varying vec2 pos;

    void main () {
      pos = position;
      gl_Position = vec4(position, 0, 1);
    }
  `,
  attributes: {
    position: [
      [-1, -1],
      [1, 1],
      [1, -1],
      [-1, -1],
      [-1, 1],
      [1, 1],
    ],
  },
  uniforms: {
    // @ts-ignore
    seed: regl.prop("seed"),
  },
  count: 6,
  // @ts-ignore
  framebuffer: regl.prop("fbo"),
});

// draws some random colors
const randomColors = regl({
  frag: `
    precision highp float;
    varying vec2 pos;
    uniform vec2 seed;
    float rand(vec2 co){
      return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main () {
      vec3 c = vec3(
        rand(pos + seed),
        rand(pos * 2. + seed),
        rand(pos * 3. + seed)
      );
      // // c = vec3(1);
      c = c / length(c);
      float r = rand(pos * seed * gl_FragCoord.xy);
      // vec3 c = vec3(0);
      if (r < .33) {
        c = vec3(1, 0, 0);
      } else if (r > 0.33 && r < 0.67) {
        c = vec3(0, 1, 0);
      } else {
        c = vec3(0, 0, 1);
      }
      gl_FragColor = vec4(
        c,
        1.
      );
    }
  `,
  vert: `
    precision highp float;
    attribute vec2 position;
    varying vec2 pos;

    void main () {
      pos = position;
      gl_Position = vec4(position, 0, 1);
    }
  `,
  attributes: {
    position: [
      [-1, -1],
      [1, 1],
      [1, -1],
      [-1, -1],
      [-1, 1],
      [1, 1],
    ],
  },
  uniforms: {
    // @ts-ignore
    seed: regl.prop("seed"),
  },
  count: 6,
  // @ts-ignore
  framebuffer: regl.prop("fbo"),
});

randomInit({ fbo: positionFbo_1, seed: [0, 0] });
randomColors({ fbo: colorsFbo, seed: [1, 1] });
// randomInit({ fbo: colorsFbo, seed: [5,7]})
randomInit({ fbo: speedFbo_1, seed: [2, 1] });

let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;

canvas.addEventListener("mousemove", (e) => {
  mouseX = e.clientX / window.innerWidth;
  mouseY = 1 - e.clientY / window.innerHeight;
});

let isMouseDown = false;
canvas.addEventListener("mousedown", () => (isMouseDown = true));
canvas.addEventListener("mouseup", () => (isMouseDown = false));

const drawInfluence = regl({
  frag: `
    precision highp float;
    varying vec2 uv;
    varying vec3 vColor;
    uniform float influenceScale;
    uniform float spread;
    uniform float size;
    uniform float alphaScale;
    
    void main() {
      float dist = sqrt(uv.x * uv.x + uv.y * uv.y);
      float radialFade = min(max((1. - dist) * (1. / influenceScale / spread / size) * alphaScale, 0.), 1.);
      float alpha = radialFade;
      gl_FragColor = vec4(vColor * alpha, alpha);
    }
  `,

  vert: `
    precision highp float;

    attribute vec2 position;
    attribute vec2 offset;

    uniform float size;
    uniform float n;
    uniform vec2 resolution;
    uniform sampler2D positionsTexture;
    uniform sampler2D colorsTexture;
    uniform float influenceScale;
    uniform float spread;
    uniform vec2 mouse;

    varying vec3 vColor;
    varying vec2 uv;

    void main() {
      vec2 texCoords = offset / n;

      vec2 pos_01 = texture2D(positionsTexture, texCoords).xy;
      vec2 pos = pos_01 * 2. - vec2(1.);

      vec2 normalizedPosition = position * size / resolution;
      gl_Position = vec4(
        pos.x + normalizedPosition.x,
        pos.y + normalizedPosition.y,
        0,
        1
      );
      uv = position;

      vec3 color = texture2D(colorsTexture, texCoords).rgb;
      vColor = color;
    }
  `,

  attributes: {
    position: [
      [-1, -1],
      [1, 1],
      [1, -1],
      [-1, -1],
      [-1, 1],
      [1, 1],
    ],

    offset: {
      buffer: regl.buffer(
        Array(N * N)
          .fill(0)
          .map((_, i) => {
            const x = i % N;
            const y = Math.floor(i / N);
            return [x, y];
          }),
      ),
      divisor: 1, // one separate offset for every triangle.
    },
  },

  uniforms: {
    // @ts-ignore
    resolution: regl.prop("resolution"),
    // @ts-ignore
    size: regl.prop("size"),
    // @ts-ignore
    positionsTexture: regl.prop("positions"),
    colorsTexture: colorsFbo,
    // @ts-ignore
    influenceScale: regl.prop("influenceScale"),
    n: N,
    // @ts-ignore
    spread: regl.prop("spread"),
    // @ts-ignore
    alphaScale: regl.prop("alphaScale"),
    // @ts-ignore
    isMouseDown: regl.prop("isMouseDown"),
    // @ts-ignore
    mouse: regl.prop("mouse"),
  },

  depth: {
    enable: false,
  },

  blend: {
    enable: true,
    // @ts-ignore
    func: regl.prop("blendFunc"),
  },

  count: 6,
  instances: N * N,
  // @ts-ignore
  framebuffer: regl.prop("target"),
});

const updatePosition = regl({
  frag: `
    precision highp float;
    uniform sampler2D speedTexture;
    uniform sampler2D current;
    uniform float n;

    void main() {
      vec2 texCoord = gl_FragCoord.xy / n;
      vec4 currentPosition = texture2D(current, texCoord);
      vec4 currentSpeed = texture2D(speedTexture, texCoord);

      gl_FragColor = mod(currentPosition + currentSpeed, 1.);
    }
  `,
  vert: `
    precision highp float;
    attribute vec2 position;

    void main() {
      gl_Position = vec4(position, 0, 1);
    }
  `,
  uniforms: {
    //@ts-ignore
    speedTexture: regl.prop("speed"),
    // @ts-ignore
    current: regl.prop("current"),
    n: N,
  },
  attributes: {
    position: [
      [-1, -1],
      [1, 1],
      [1, -1],
      [-1, -1],
      [-1, 1],
      [1, 1],
    ],
  },
  count: 6,
  // @ts-ignore
  framebuffer: regl.prop("next"),
});

const updateSpeed = regl({
  frag: `
  precision highp float;
  uniform float n;
  uniform sampler2D positions;
  uniform sampler2D influence;
  uniform sampler2D colors;
  uniform sampler2D oldSpeed;
  uniform mat3 colorRelations;
  uniform vec2 resolution;
  uniform float size;
  uniform float time;
  varying vec2 uv;
  uniform vec2 mouse;
  uniform float spread;
  uniform bool isMouseDown;

  #define PI 3.1415926538

  vec2 getPos() {
    vec2 texCoord = gl_FragCoord.xy / n;
    return texture2D(positions, texCoord).xy;
  }

  vec3 getColor() {
    vec2 texCoord = gl_FragCoord.xy / n;
    return texture2D(colors, texCoord).rgb;
  }

  vec4 sampleInfluence(vec2 offset) {
    vec2 pos = getPos();
    return texture2D(influence, mod(pos + offset, 1.));
  }

  float rand(vec2 co){
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
  }

  const float max = 50.;

  vec2 getNextSpeed(float sign) {
    vec2 dxdy = sign * vec2(size * spread) / 1. / resolution;
    vec2 avg = vec2(0);
    vec3 color = getColor();
    vec2 bestDir = vec2(1,0);
    float best = 0.;
    for (float i = 0.; i < max; i++) {
      // float dist = floor(i * 5. / max) / 5.;
      float dist = i / max;
      vec2 dir = vec2(
        sin(i * 2. * PI / max * 5. + rand(gl_FragCoord.xy)), 
        cos(i * 2. * PI / max * 5. + rand(gl_FragCoord.xy * 1.1))
      ) * dxdy;

      vec4 influence = sampleInfluence(dir * dist);

      vec3 biased = colorRelations * color * influence.rgb;
      // vec3 biased = getBiasedVal(influence.rgb);

      float ln = biased.r + biased.g + biased.b;
      if (abs(ln) > abs(best)) {
        best = ln;
        bestDir = dir;
      }

      float there = ln * (dist * dist);

      avg += dir * there / max;
    }
    // float here = dot(sampleInfluence(vec2(0)).rgb, color);
    float here = sampleInfluence(vec2(0)).a;
    avg += -here * bestDir / max * 2.;
    return avg;
  }

  void main() {
    
    vec2 pos = getPos();
    vec2 currentSpeed = texture2D(oldSpeed, pos).rg;

    vec3 color = getColor();

    vec2 avg = getNextSpeed(-1.) + getNextSpeed(1.);
    // avg *= 10.;

    if (isMouseDown) avg += -(pos - mouse) / 125.;

    avg = avg / length(avg) / 1000.;
    // avg = currentSpeed * 0.9 + 0.1 * avg;
    
    gl_FragColor = vec4(avg, 0, 1);
  }
  `,
  vert: `
  precision highp float;
  attribute vec2 position;
  varying vec2 uv;

  void main() {
    gl_Position = vec4(position, 0, 1);
    uv = position;
  }
`,
  uniforms: {
    influence: influenceTexture,
    // @ts-ignore
    positions: regl.prop("positions"),
    colors: colorsFbo,

    colorRelations: () => [
      window.state.rr,
      window.state.rg,
      window.state.rb,
      window.state.gr,
      window.state.gg,
      window.state.gb,
      window.state.br,
      window.state.bg,
      window.state.bb,
    ],
    n: N,
    resolution,
    size: window.state.size,
    //@ts-ignore
    time: regl.prop("time"),
    // @ts-ignore
    oldSpeed: regl.prop("oldSpeed"),
    // @ts-ignore
    mouse: regl.prop("mouse"),
    // @ts-ignore
    isMouseDown: regl.prop("isMouseDown"),
    spread: window.state.spread,
  },
  attributes: {
    position: [
      [-1, -1],
      [1, 1],
      [1, -1],
      [-1, -1],
      [-1, 1],
      [1, 1],
    ],
  },
  count: 6,
  // @ts-ignore
  framebuffer: regl.prop("target"),
});

const drawTexture = regl({
  frag: `
    precision highp float;
    uniform sampler2D tex;
    varying vec2 uv;

    void main() {
      gl_FragColor = texture2D(tex, uv);
    }
  `,
  vert: `
  precision highp float;
  attribute vec2 position;
  uniform float sizeFactor;
  varying vec2 uv;
  void main() {
    gl_Position = vec4(position*sizeFactor - vec2(1. - sizeFactor), 0, 1);
    uv = position / 2. + vec2(.5);
  }
  `,
  uniforms: {
    // @ts-ignore
    tex: regl.prop("tex"),
    sizeFactor: 0.125,
  },
  attributes: {
    position: [
      [-1, -1],
      [1, 1],
      [1, -1],
      [-1, -1],
      [-1, 1],
      [1, 1],
    ],
  },
  count: 6,
});

const prevFrame = regl.texture();

const drawPrevFrame = regl({
  frag: `
    precision highp float;
    varying vec2 uv;
    uniform sampler2D prev;
    void main() {
      vec4 tex = texture2D(prev, uv);
      gl_FragColor = vec4(tex.rgb * 0.85, 1);
    }
  `,
  vert: `
    precision highp float;
    attribute vec2 position;
    varying vec2 uv;
    void main() {
      gl_Position = vec4(position, 0, 1);
      uv = position / 2. + vec2(.5);
    }
  `,
  uniforms: {
    prev: prevFrame,
  },
  attributes: {
    position: [
      [-1, -1],
      [1, 1],
      [1, -1],
      [-1, -1],
      [-1, 1],
      [1, 1],
    ],
  },
  count: 6,
  blend: {
    enable: true,
    equation: "add",
  },
  depth: { enable: false },
});

const inf = (positions: Framebuffer2D, useTarget = true) =>
  drawInfluence({
    target: useTarget ? influenceFbo : undefined,
    resolution: influenceResolution,
    positions,
    influenceScale,
    spread: window.state.spread,
    size: window.state.size,
    alphaScale: window.state.alphaScale,
    isMouseDown,
    mouse: [mouseX, mouseY],
    blendFunc: {
      srcRGB: "one minus dst color", // written by fragment shader
      srcAlpha: "one",
      dstRGB: "one", // what's already in the buffer
      dstAlpha: "one",
    },
  });

let debug = false;
let tick = false;
let renderNext = true;
let autoplay = true;
regl.frame(() => {
  if (!renderNext) return;
  influenceFbo.use(() => {
    regl.clear({
      color: [0, 0, 0, 0],
    });
  });

  tick = !tick;
  const currentPosition = tick ? positionFbo_1 : positionFbo_2;
  const nextPosition = tick ? positionFbo_2 : positionFbo_1;
  const currentSpeed = tick ? speedFbo_1 : speedFbo_2;
  const nextSpeed = tick ? speedFbo_2 : speedFbo_1;

  inf(currentPosition);

  updateSpeed({
    positions: currentPosition,
    oldSpeed: currentSpeed,
    target: nextSpeed,
    time: Date.now(),
    mouse: [mouseX, mouseY],
    isMouseDown,
  });

  updatePosition({
    current: currentPosition,
    next: nextPosition,
    speed: nextSpeed,
  });

  drawPrevFrame();
  if (!debug) {
    drawInfluence({
      positions: nextPosition,
      resolution,
      influenceScale: 1,
      spread: 1,
      size: 5,
      alphaScale: 10,
      isMouseDown,
      mouse: [mouseX, mouseY],
      blendFunc: {
        srcRGB: "src alpha", // written by fragment shader
        srcAlpha: "src alpha",
        dstRGB: "dst alpha", // what's already in the buffer
        dstAlpha: "one minus src alpha",
      },
    });
  } else {
    inf(currentPosition, false);
    drawTexture({
      tex: positionFbo_2,
    });
  }
  prevFrame({
    copy: true,
  });
  renderNext = autoplay;
});

window.addEventListener("keyup", (e) => {
  if (e.key === " ") {
    renderNext = true;
  } else if (e.key === "p") {
    autoplay = !autoplay;
    renderNext = autoplay;
  } else if (e.key === "d") {
    debug = !debug;
  }
});
