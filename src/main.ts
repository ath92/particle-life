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

const N = 200 // N particles on the width, N particles on the height.
const size = 5
const spread = 9

const resolution = [
  window.innerWidth,
  window.innerHeight,
]

const influenceScale = 2

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
  // type: 'float',
})

const influenceFbo = regl.framebuffer({
  width: Math.round(influenceResolution[0]),
  height: Math.round(influenceResolution[1]),
  depth: false,
  depthTexture: false,
  depthStencil: false,
  stencil: false,
  color: influenceTexture,
  // colorType: 'float'
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
// randomColors({ seed: [1, 1] })
randomInit({ fbo: colorsFbo, seed: [5,7]})
randomInit({ fbo: speedFbo_1, seed: [2,1] })

const drawInfluence = regl({
  frag: `
    precision highp float;
    varying vec2 uv;
    varying vec3 vColor;
    uniform float influenceScale;
    uniform float spread;
    uniform float size;
    uniform float alphaScale;
    const float pi = 3.14159265359;
    void main() {
      float dist = sqrt(uv.x * uv.x + uv.y * uv.y);
      float radialFade = min(max((1. - dist) * (1. / influenceScale / spread / size) * alphaScale, 0.), 1.);
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
    uniform float spread;

    varying vec3 vColor;
    varying vec2 uv;

    void main() {
      vec2 texCoords = offset / n;
      vec2 pos = texture2D(positionsTexture, texCoords).xy * 2. - vec2(1.);

      vec2 normalizedPosition = position * size * spread / resolution;
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
    // @ts-ignore
    spread: regl.prop('spread'),
    // @ts-ignore
    alphaScale: regl.prop('alphaScale')
  },

  depth: {
    enable: false
  },

  blend: {
    enable: true,
    func: {
      srcRGB: 'src alpha', // written by fragment shader
      srcAlpha: 'one',
      dstRGB: 'dst alpha', // what's already in the buffer
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
  uniform vec2 mouse;
  uniform float spread;

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
    for (float i = 0.; i < max; i++) {
      // float dist = floor(i * 5. / max) / 5.;
      float dist = i / max;
      vec2 dir = vec2(
        sin(i * 2. * PI / max * 5. + rand(gl_FragCoord.xy)), 
        cos(i * 2. * PI / max * 5. + rand(gl_FragCoord.xy * 1.1))
      ) * dxdy;

      vec4 influence = sampleInfluence(dir * dist);
      vec3 biased = colorRelations * (influence.rgb - getColor());
      // vec3 biased = getBiasedVal(influence.rgb);

      float there = (length(biased)) * -cos(dist * 0.5 *PI ) * (1. / (dist + 0.01));

      avg += dir * there / max;
    }
    return avg;
  }

  void main() {
    
    vec2 pos = getPos();
    vec2 currentSpeed = texture2D(oldSpeed, pos).rg;

    vec3 color = getColor();

    vec2 avg = getNextSpeed(-1.) + getNextSpeed(1.);
    // avg /= 2.;

    // avg += -(pos - mouse) / 1025.;

    avg = currentSpeed * 0.8 + 0.2 * avg;
    
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
      -0.546, 0.295, 0.685,
      -.646, 0.658, -0.552,
      0.477, 0.627, -.532,
    ],
    n: N,
    resolution,
    size,
    //@ts-ignore
    time: regl.prop('time'),
    // @ts-ignore
    oldSpeed: regl.prop('oldSpeed'),
    // @ts-ignore
    mouse: regl.prop('mouse'),
    spread,

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


let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;

window.addEventListener("mousemove", (e) => {
  mouseX = e.clientX  / window.innerWidth;
  mouseY = 1 - e.clientY / window.innerHeight;
})

let isMouseDown = false;
window.addEventListener("mousedown", () => isMouseDown = true)
window.addEventListener("mouseup", () => isMouseDown = false)

// const drawMouse = regl({
//   frag: `
//     precision highp float;
//     uniform vec2 mouse;
//     uniform bool isMouseDown;
//     uniform sampler2D current;
//     varying vec2 uv;

//     void main() {
//       float dist = sqrt(uv.x * uv.x + uv.y * uv.y);
//       float radialFade = min(max((1. - dist) * (1. / influenceScale / spread / size) * alphaScale, 0.), 1.);

//       vec4 curr = texture2D(current, uv);
//       gl_FragColor = mix(curr, vec4(0), radialFade);
//     }
//   `,
//   vert: `
//   precision highp float;
//   attribute vec2 position;
//   uniform vec2 mouse;
//   uniform float sizeFactor;
//   varying vec2 uv;
//   void main() {
//     gl_Position = vec4(position*sizeFactor + mouse), 0, 1);
//     uv = position / 2. + vec2(.5);
//   }
//   `,
//   uniforms: {
//     // @ts-ignore
//     current: regl.prop("current"),
//     isMouseDown,
//     mouse: [mouseX, mouseY],
//     sizeFactor: 0.1,
//   },
//   attributes: {
//     position: [[-1, -1], [1, 1], [1, -1], [-1, -1], [-1, 1], [1, 1]],
//   },
//   count: 6,
//   // @ts-ignore
//   framebuffer: regl.prop("next"),
// })


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
    spread,
    alphaScale: 1,
  })

  // drawMouse({
  //   current: 
  // })

  updateSpeed({
    positions: currentPosition,
    oldSpeed: currentSpeed,
    target: nextSpeed,
    time: Date.now(),
    mouse: [mouseX, mouseY],
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
    spread: 1,
    alphaScale: 5,
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
