import Regl from "regl"
import "./style.css"


const canvas = document.createElement("canvas")
canvas.width = window.innerWidth
canvas.height = window.innerHeight
document.body.appendChild(canvas)

const regl = Regl({
  canvas,
  extensions: [
    'angle_instanced_arrays', 
    'OES_texture_float', 
    'EXT_blend_minmax', 
    'oes_texture_float_linear', 
    'EXT_float_blend'
  ],
  pixelRatio: 2,
  
})

const N = 50 // N particles on the width, N particles on the height.
const size = 18

const resolution = [
  window.innerWidth,
  window.innerHeight,
]

const influenceScale = 4

const influenceResolution = [
  resolution[0] / influenceScale,
  resolution[1] / influenceScale,
]

const positionFbo_1 = regl.framebuffer({
  width: N,
  height: N,
  depth: false,
  colorType: 'float',
})
const positionFbo_2 = regl.framebuffer({
  width: N,
  height: N,
  depth: false,
  colorType: 'float',
})
const colorsFbo = regl.framebuffer({
  width: N,
  height: N,
})
const speedFbo_1 = regl.framebuffer({
  width: N,
  height: N,
  depth: false,
  colorType: 'float',
})
const speedFbo_2 = regl.framebuffer({
  width: N,
  height: N,
  depth: false,
  colorType: 'float',
})

const influenceTexture = regl.texture({
  width: Math.round(influenceResolution[0]),
  height: Math.round(influenceResolution[1]),
  min: 'linear',
  mag: 'linear',
  premultiplyAlpha: false, // default = false
  type: 'float',
})

const influenceFbo = regl.framebuffer({
  width: Math.round(influenceResolution[0]),
  height: Math.round(influenceResolution[1]),
  depth: false,
  depthTexture: false,
  depthStencil: false,
  stencil: false,
  color: influenceTexture,
  colorType: 'float'
})

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
      gl_FragColor = vec4(
        rand(pos + seed),
        rand(pos * 2. + seed),
        rand(pos * 3. + seed),
        rand(pos * 4. + seed)
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
    position: [[-1, -1], [1, 1], [1, -1], [-1, -1], [-1, 1], [1, 1]],
  },
  uniforms: {
    // @ts-ignore
    seed: regl.prop('seed'),
  },
  count: 6,
  // @ts-ignore
  framebuffer: regl.prop('fbo'),
})


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
      float random = rand(gl_FragCoord.xy);
      if (random < 1. / 3.) {
        gl_FragColor = vec4(1, 0, 0, 1);
      } else if  (random >= 1./3. && random < 2./3.) {
        gl_FragColor = vec4(0, 1, 0, 1);
      } else {
        gl_FragColor = vec4(0, 0, 1, 1);
      }
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
    position: [[-1, -1], [1, 1], [1, -1], [-1, -1], [-1, 1], [1, 1]],
  },
  uniforms: {
    // @ts-ignore
    seed: regl.prop('seed'),
  },
  count: 6,
  // @ts-ignore
  framebuffer: colorsFbo,
})

randomInit({ fbo: positionFbo_1, seed: [0, 0] })
randomColors({ seed: [1, 1] })
randomInit({ fbo: speedFbo_1, seed: [2,1] })

const drawInfluence = regl({
  frag: `
    precision highp float;
    varying vec2 uv;
    varying vec3 vColor;
    uniform float influenceScale;
    const float pi = 3.14159265359;
    void main() {
      float dist = sqrt(uv.x * uv.x + uv.y * uv.y);
      float radialFade = min(max((1. - dist) * (1. / influenceScale), 0.), 1.);
      gl_FragColor = vec4(vColor, radialFade);
    }
  `,

  vert: 
  `
    precision highp float;

    attribute vec2 position;
    attribute vec2 offset;

    uniform float size;
    uniform float n;
    uniform vec2 resolution;
    uniform sampler2D positionsTexture;
    uniform sampler2D colorsTexture;
    uniform float influenceScale;

    varying vec3 vColor;
    varying vec2 uv;

    void main() {
      vec2 texCoords = offset / n;
      vec2 pos = texture2D(positionsTexture, texCoords).xy * 2. - vec2(1.);

      vec2 normalizedPosition = position * size  / resolution;
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
    position: [[-1, -1], [1, 1], [1, -1], [-1, -1], [-1, 1], [1, 1]],

    offset: {
      buffer: regl.buffer(
        Array(N * N).fill(0).map((_, i) => {
          const x = i % N
          const y = Math.floor(i / N)
          return [x, y]
        })),
      divisor: 1 // one separate offset for every triangle.
    },
  },

  uniforms: {
    // @ts-ignore
    resolution: regl.prop("resolution"),
    size,
    // @ts-ignore
    positionsTexture: regl.prop('positions'),
    colorsTexture: colorsFbo,
    // @ts-ignore
    influenceScale: regl.prop("influenceScale"),
    n: N,
  },

  depth: {
    enable: false
  },

  blend: {
    enable: true,
    func: {
      srcRGB: 'src alpha', // written by fragment shader
      srcAlpha: 'src alpha',
      dstRGB: 'one', // what's already in the buffer
      dstAlpha: 'one',
    },
  },
  
  count: 6,
  instances: N * N,
  // @ts-ignore
  framebuffer: regl.prop('target'),
})

const updatePosition = regl({
  frag: `
    precision highp float;
    uniform sampler2D speedTexture;
    uniform sampler2D current;
    uniform float n;

    void main() {
      vec2 texCoord = gl_FragCoord.xy / n;
      vec4 currentPosition = texture2D(current, texCoord);
      vec4 currentSpeed = (texture2D(speedTexture, texCoord)) / 5.;

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
    speedTexture: regl.prop('speed'),
    // @ts-ignore
    current: regl.prop('current'),
    n: N,
  },
  attributes: {
    position: [[-1, -1], [1, 1], [1, -1], [-1, -1], [-1, 1], [1, 1]],
  },
  count: 6,
  // @ts-ignore
  framebuffer: regl.prop('next'),
})

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

  const float max = 24.;

  vec2 getNextSpeed(float sign) {
    vec2 dxdy = sign * vec2(size) / .1 / resolution;
    vec2 avg = vec2(0);
    for (float i = 0.; i < max; i++) {
      float dist = i / max;
      vec2 dir = vec2(
        sin(i * 2. * PI / max * 3.), 
        cos(i * 2. * PI / max * 3.)
      ) * dxdy;

      vec4 influence = sampleInfluence(dir * dist);
      vec3 biased = colorRelations * influence.rgb;
      // vec3 biased = getBiasedVal(influence.rgb);

      float there = length(biased) * -cos(dist) * 3. * PI;

      avg += dir * there / max;
    }
    return avg;
  }

  void main() {
    
    vec2 pos = getPos();
    vec2 currentSpeed = texture2D(oldSpeed, pos).rg;

    vec3 color = getColor();

    vec2 avg = getNextSpeed(-1.) + getNextSpeed(1.);
    avg /= 2.;

    // avg /= 10.;

    avg += -(pos- vec2(.5)) / 2.;
    
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
    colorRelations: [
      .5, -.8, .7,
      -.8, .5, .2,
      .8, 1, -.8,
    ],
    n: N,
    resolution,
    size,
    //@ts-ignore
    time: regl.prop('time'),
    // @ts-ignore
    oldSpeed: regl.prop('oldSpeed'),
  },
  attributes: {
    position: [[-1, -1], [1, 1], [1, -1], [-1, -1], [-1, 1], [1, 1]],
  },
  count: 6,
  // @ts-ignore
  framebuffer: regl.prop("target"),
})

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
    position: [[-1, -1], [1, 1], [1, -1], [-1, -1], [-1, 1], [1, 1]],
  },
  count: 6,
})

let tick = false
let renderNext = true;
let autoplay = true;
regl.frame(() => {
  if (!renderNext) return
  regl.clear({
    color: [0, 0, 0, 0]
  })
  influenceFbo.use(() => {
    regl.clear({
      color: [0, 0, 0, 0]
    })
  })

  tick = !tick
  const currentPosition = tick ? positionFbo_1 : positionFbo_2
  const nextPosition = tick ? positionFbo_2 : positionFbo_1
  const currentSpeed = tick ? speedFbo_1 : speedFbo_2
  const nextSpeed = tick ? speedFbo_2 : speedFbo_1

  drawInfluence({
    target: influenceFbo,
    resolution: influenceResolution,
    positions: currentPosition,
    influenceScale,
  })

  updateSpeed({
    positions: currentPosition,
    oldSpeed: currentSpeed,
    target: nextSpeed,
    time: Date.now(),
  })

  updatePosition({
    current: currentPosition,
    next: nextPosition,
    speed: nextSpeed,
  })

  drawInfluence({
    positions: nextPosition,
    resolution,
    influenceScale: 1,
  })
  drawTexture({
    tex: influenceFbo
  })
  // randomInit({})
  renderNext = autoplay;
})

window.addEventListener("keyup", (e) => {
  if (e.key === " ") {
    renderNext = true
  } else if (e.key === "p") {
    autoplay = !autoplay
    renderNext = autoplay
  }
})
  
