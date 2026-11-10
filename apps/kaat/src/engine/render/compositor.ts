/**
 * WebGL2 compositor. Draws a kaat-core `FrameDescription` (bottom → top layers) into a canvas.
 * Shared verbatim by the preview render worker and the export worker, so both apply transforms,
 * crop, effects and transitions identically.
 *
 * Coordinate system: project pixels, origin top-left, +y down. A layer's natural size is its
 * source fitted (contain) into the project frame; `transform.scale` multiplies that.
 */
import type { BlurEffect, ColorEffect, FrameDescription, RenderLayer } from '@khata/kaat-core'

export interface LayerTexture {
  tex: WebGLTexture
  width: number
  height: number
  /** Source rotation in degrees (0/90/180/270) still to apply when sampling. */
  rotation: number
  /** Texture is premultiplied by alpha (text rasters). */
  premultiplied: boolean
}

export type TextureResolver = (layer: RenderLayer) => LayerTexture | undefined

const VS = `#version 300 es
in vec2 a_pos;
uniform mat3 u_matrix;
out vec2 v_quad;
void main() {
  v_quad = a_pos + 0.5;
  vec3 p = u_matrix * vec3(a_pos, 1.0);
  gl_Position = vec4(p.xy, 0.0, 1.0);
}`

const FS = `#version 300 es
precision highp float;
in vec2 v_quad;
uniform sampler2D u_tex;
uniform vec4 u_uvRect;      // crop: x, y, w, h in texture space (pre-rotation)
uniform int u_rotation;     // 0..3 quarter turns
uniform float u_opacity;
uniform vec3 u_color;       // brightness, contrast, saturation (-1..1)
uniform vec4 u_tint;        // rgb, amount
uniform float u_reveal;
uniform int u_mode;         // 0 texture, 1 solid
uniform vec4 u_solid;
uniform bool u_premultiplied;
out vec4 outColor;

vec2 rotateUv(vec2 q, int r) {
  if (r == 1) return vec2(q.y, 1.0 - q.x);
  if (r == 2) return vec2(1.0 - q.x, 1.0 - q.y);
  if (r == 3) return vec2(1.0 - q.y, q.x);
  return q;
}

void main() {
  if (v_quad.x > u_reveal) discard;
  vec4 c;
  if (u_mode == 1) {
    c = u_solid;
  } else {
    vec2 q = u_uvRect.xy + v_quad * u_uvRect.zw;
    c = texture(u_tex, rotateUv(q, u_rotation));
    if (u_premultiplied && c.a > 0.0) c.rgb /= c.a;
  }
  // Colour adjust.
  c.rgb += u_color.x;
  c.rgb = (c.rgb - 0.5) * (1.0 + u_color.y) + 0.5;
  float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  c.rgb = mix(vec3(l), c.rgb, 1.0 + u_color.z);
  c.rgb = mix(c.rgb, u_tint.rgb, u_tint.a);
  c.rgb = clamp(c.rgb, 0.0, 1.0);
  float a = c.a * u_opacity;
  outColor = vec4(c.rgb * a, a); // premultiplied output
}`

const BLUR_FS = `#version 300 es
precision highp float;
in vec2 v_quad;
uniform sampler2D u_tex;
uniform vec2 u_dir;     // texel step * direction
uniform float u_sigma;  // in texels
out vec4 outColor;
void main() {
  vec4 acc = vec4(0.0);
  float wsum = 0.0;
  int r = int(ceil(u_sigma * 2.5));
  for (int i = -40; i <= 40; i++) {
    if (i < -r || i > r) continue;
    float w = exp(-float(i * i) / (2.0 * u_sigma * u_sigma));
    acc += texture(u_tex, v_quad + u_dir * float(i)) * w;
    wsum += w;
  }
  outColor = acc / wsum;
}`

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(s) ?? 'shader')
  return s
}

function program(gl: WebGL2RenderingContext, fs: string): WebGLProgram {
  const p = gl.createProgram()!
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VS))
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs))
  gl.bindAttribLocation(p, 0, 'a_pos')
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link')
  return p
}

export function parseColor(hex: string | undefined, alpha = 1): [number, number, number, number] {
  const h = (hex ?? '#000000').replace('#', '')
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h.padEnd(6, '0')
  const n = Number.parseInt(full.slice(0, 6), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, alpha]
}

interface Target {
  fb: WebGLFramebuffer
  tex: WebGLTexture
  w: number
  h: number
}

export class Compositor {
  readonly gl: WebGL2RenderingContext
  private layerProg: WebGLProgram
  private blurProg: WebGLProgram
  private uniforms: Record<string, WebGLUniformLocation | null> = {}
  private blurUniforms: Record<string, WebGLUniformLocation | null> = {}
  private vao: WebGLVertexArrayObject
  private targets: Target[] = []
  private copyProg: WebGLProgram

  constructor(
    readonly canvas: OffscreenCanvas,
    opts: { preserveDrawingBuffer?: boolean } = {},
  ) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: opts.preserveDrawingBuffer ?? false,
      powerPreference: 'high-performance',
      desynchronized: false,
    })
    if (!gl) throw Object.assign(new Error('WebGL2 is unavailable'), { code: 'RENDER_FAILED' })
    this.gl = gl
    this.layerProg = program(gl, FS)
    this.blurProg = program(gl, BLUR_FS)
    this.copyProg = this.layerProg
    for (const n of [
      'u_matrix',
      'u_tex',
      'u_uvRect',
      'u_rotation',
      'u_opacity',
      'u_color',
      'u_tint',
      'u_reveal',
      'u_mode',
      'u_solid',
      'u_premultiplied',
    ])
      this.uniforms[n] = gl.getUniformLocation(this.layerProg, n)
    for (const n of ['u_matrix', 'u_tex', 'u_dir', 'u_sigma'])
      this.blurUniforms[n] = gl.getUniformLocation(this.blurProg, n)
    this.vao = gl.createVertexArray()!
    gl.bindVertexArray(this.vao)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]),
      gl.STATIC_DRAW,
    )
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.BROWSER_DEFAULT_WEBGL)
  }

  resize(width: number, height: number): void {
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width
      this.canvas.height = height
    }
  }

  /** Create a texture from a decoded frame, image or canvas. Optionally downscale to fit `max`. */
  upload(
    source: TexImageSource,
    width: number,
    height: number,
    opts: {
      maxWidth?: number
      maxHeight?: number
      rotation?: number
      premultiplied?: boolean
    } = {},
  ): LayerTexture {
    const gl = this.gl
    const tex = this.newTexture()
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
    const rotation = opts.rotation ?? 0
    const lt: LayerTexture = { tex, width, height, rotation, premultiplied: !!opts.premultiplied }
    const maxW = opts.maxWidth ?? Number.POSITIVE_INFINITY
    const maxH = opts.maxHeight ?? Number.POSITIVE_INFINITY
    // Keep VRAM bounded: big sources (4K) are reduced to the size the preview actually needs.
    if (width > maxW * 1.25 || height > maxH * 1.25) {
      const k = Math.min(maxW / width, maxH / height)
      const w = Math.max(2, Math.round(width * k))
      const h = Math.max(2, Math.round(height * k))
      const small = this.renderToTexture(lt, w, h)
      gl.deleteTexture(tex)
      return small
    }
    return lt
  }

  deleteTexture(t: LayerTexture): void {
    this.gl.deleteTexture(t.tex)
  }

  /**
   * Render a frame. `scale` maps project pixels to canvas pixels (preview quality); the canvas must
   * already be sized `round(project * scale)`.
   */
  render(
    frame: FrameDescription,
    resolve: TextureResolver,
    scale: number,
  ): { drawn: number; missing: string[] } {
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    const [r, g, b] = parseColor(frame.background)
    gl.clearColor(r, g, b, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.bindVertexArray(this.vao)
    let drawn = 0
    const missing: string[] = []
    for (const layer of frame.layers) {
      if (layer.transform.opacity <= 0.0005 || layer.reveal <= 0) continue
      if (layer.kind === 'solid') {
        this.drawSolid(frame, layer)
        drawn++
        continue
      }
      let tex = resolve(layer)
      if (!tex) {
        missing.push(layer.key)
        continue
      }
      const blur = layer.effects.find((e): e is BlurEffect => e.type === 'blur' && e.radius > 0)
      let ownsTex = false
      if (blur) {
        tex = this.blurred(tex, (blur.radius * scale) / 2)
        ownsTex = true
      }
      this.drawLayer(frame, layer, tex, !!blur)
      if (ownsTex) this.gl.deleteTexture(tex.tex)
      drawn++
    }
    return { drawn, missing }
  }

  /** Read back the canvas as RGBA (visual regression tests). */
  readPixels(): Uint8Array {
    const gl = this.gl
    const out = new Uint8Array(this.canvas.width * this.canvas.height * 4)
    gl.readPixels(0, 0, this.canvas.width, this.canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, out)
    return out
  }

  dispose(): void {
    for (const t of this.targets) {
      this.gl.deleteFramebuffer(t.fb)
      this.gl.deleteTexture(t.tex)
    }
    this.targets = []
    this.gl.getExtension('WEBGL_lose_context')?.loseContext()
  }

  // ── internals ────────────────────────────────────────────────────────────────────────────────

  private newTexture(): WebGLTexture {
    const gl = this.gl
    const tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return tex
  }

  /** Copy `src` (applying its rotation) into a new w×h texture. */
  private renderToTexture(src: LayerTexture, w: number, h: number): LayerTexture {
    const gl = this.gl
    const tex = this.newTexture()
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    const fb = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    gl.viewport(0, 0, w, h)
    gl.disable(gl.BLEND)
    gl.useProgram(this.copyProg)
    gl.bindVertexArray(this.vao)
    // Unit quad → whole target. Framebuffer row 0 is texture t=0, same as an upload: stays upright.
    gl.uniformMatrix3fv(this.uniforms.u_matrix!, false, [2, 0, 0, 0, 2, 0, 0, 0, 1])
    this.setPlainUniforms(src, 1)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.deleteFramebuffer(fb)
    gl.enable(gl.BLEND)
    // The copy applied the rotation; the layer shader writes premultiplied colour.
    return { tex, width: w, height: h, rotation: 0, premultiplied: true }
  }

  private setPlainUniforms(src: LayerTexture, opacity: number): void {
    const gl = this.gl
    const u = this.uniforms
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, src.tex)
    gl.uniform1i(u.u_tex!, 0)
    gl.uniform4f(u.u_uvRect!, 0, 0, 1, 1)
    gl.uniform1i(u.u_rotation!, Math.round((src.rotation % 360) / 90) & 3)
    gl.uniform1f(u.u_opacity!, opacity)
    gl.uniform3f(u.u_color!, 0, 0, 0)
    gl.uniform4f(u.u_tint!, 0, 0, 0, 0)
    gl.uniform1f(u.u_reveal!, 2)
    gl.uniform1i(u.u_mode!, 0)
    gl.uniform1i(u.u_premultiplied!, src.premultiplied ? 1 : 0)
  }

  private target(w: number, h: number): Target {
    const gl = this.gl
    const tex = this.newTexture()
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    const fb = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    return { fb, tex, w, h }
  }

  /** Separable gaussian blur into a new texture (caller deletes it). */
  private blurred(src: LayerTexture, sigmaPx: number): LayerTexture {
    const gl = this.gl
    const w = Math.max(2, Math.min(src.width, 2048))
    const h = Math.max(2, Math.round((w / src.width) * src.height))
    // Normalise orientation/crop first so the blur works in display space.
    const base = this.renderToTexture(src, w, h)
    const sigma = Math.max(0.5, Math.min(16, sigmaPx * (w / Math.max(1, src.width))))
    const a = this.target(w, h)
    const b = this.target(w, h)
    gl.disable(gl.BLEND)
    gl.useProgram(this.blurProg)
    gl.bindVertexArray(this.vao)
    gl.viewport(0, 0, w, h)
    gl.uniformMatrix3fv(this.blurUniforms.u_matrix!, false, [2, 0, 0, 0, 2, 0, 0, 0, 1])
    gl.uniform1f(this.blurUniforms.u_sigma!, sigma)
    gl.activeTexture(gl.TEXTURE0)
    gl.uniform1i(this.blurUniforms.u_tex!, 0)
    gl.bindFramebuffer(gl.FRAMEBUFFER, a.fb)
    gl.bindTexture(gl.TEXTURE_2D, base.tex)
    gl.uniform2f(this.blurUniforms.u_dir!, 1 / w, 0)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    gl.bindFramebuffer(gl.FRAMEBUFFER, b.fb)
    gl.bindTexture(gl.TEXTURE_2D, a.tex)
    gl.uniform2f(this.blurUniforms.u_dir!, 0, 1 / h)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.deleteFramebuffer(a.fb)
    gl.deleteTexture(a.tex)
    gl.deleteFramebuffer(b.fb)
    gl.deleteTexture(base.tex)
    gl.enable(gl.BLEND)
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    return { tex: b.tex, width: src.width, height: src.height, rotation: 0, premultiplied: true }
  }

  private layerMatrix(
    frame: FrameDescription,
    layer: RenderLayer,
    natW: number,
    natH: number,
  ): number[] {
    const W = frame.width
    const H = frame.height
    const t = layer.transform
    const crop = layer.crop
    const cw = Math.max(0, 1 - crop.left - crop.right)
    const ch = Math.max(0, 1 - crop.top - crop.bottom)
    const w = natW * t.scale * cw
    const h = natH * t.scale * ch
    // Keep the uncropped part where it was: offset the quad centre by the crop imbalance.
    const ox = ((crop.left - crop.right) / 2) * natW * t.scale
    const oy = ((crop.top - crop.bottom) / 2) * natH * t.scale
    const rad = (t.rotation * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    const cx = W / 2 + t.x + layer.offsetX
    const cy = H / 2 + t.y
    // local (u,v) in [-0.5,0.5] → project px: R·(S·uv + o) + c
    const a = cos * w
    const b = sin * w
    const c = -sin * h
    const d = cos * h
    const tx = cx + cos * ox - sin * oy
    const ty = cy + sin * ox + cos * oy
    // project px → clip: x' = 2x/W - 1, y' = 1 - 2y/H (column-major mat3).
    const sx = 2 / W
    const sy = -2 / H
    return [a * sx, b * sy, 0, c * sx, d * sy, 0, tx * sx - 1, ty * sy + 1, 1]
  }

  private naturalSize(
    frame: FrameDescription,
    layer: RenderLayer,
    tex: LayerTexture,
  ): [number, number] {
    if (layer.kind === 'text') return [tex.width, tex.height]
    const sw = layer.sourceWidth || tex.width
    const sh = layer.sourceHeight || tex.height
    const k = Math.min(frame.width / sw, frame.height / sh)
    return [sw * k, sh * k]
  }

  private drawLayer(
    frame: FrameDescription,
    layer: RenderLayer,
    tex: LayerTexture,
    blurredAlready: boolean,
  ): void {
    const gl = this.gl
    const u = this.uniforms
    const [natW, natH] = this.naturalSize(frame, layer, tex)
    gl.useProgram(this.layerProg)
    gl.uniformMatrix3fv(u.u_matrix!, false, this.layerMatrix(frame, layer, natW, natH))
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, tex.tex)
    gl.uniform1i(u.u_tex!, 0)
    // Crop rect in display space; the shader rotates it into the coded frame.
    const c = layer.crop
    gl.uniform4f(
      u.u_uvRect!,
      c.left,
      c.top,
      Math.max(0, 1 - c.left - c.right),
      Math.max(0, 1 - c.top - c.bottom),
    )
    gl.uniform1i(
      u.u_rotation!,
      blurredAlready ? 0 : Math.round((((tex.rotation % 360) + 360) % 360) / 90) & 3,
    )
    gl.uniform1f(u.u_opacity!, Math.min(1, Math.max(0, layer.transform.opacity)))
    const color = layer.effects.find((e): e is ColorEffect => e.type === 'color')
    gl.uniform3f(u.u_color!, color?.brightness ?? 0, color?.contrast ?? 0, color?.saturation ?? 0)
    const [tr, tg, tb] = parseColor(layer.tintColor)
    gl.uniform4f(u.u_tint!, tr, tg, tb, layer.tint)
    gl.uniform1f(u.u_reveal!, layer.reveal >= 1 ? 2 : layer.reveal)
    gl.uniform1i(u.u_mode!, 0)
    gl.uniform1i(u.u_premultiplied!, tex.premultiplied ? 1 : 0)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  private drawSolid(frame: FrameDescription, layer: RenderLayer): void {
    const gl = this.gl
    const u = this.uniforms
    gl.useProgram(this.layerProg)
    gl.uniformMatrix3fv(
      u.u_matrix!,
      false,
      this.layerMatrix(frame, layer, frame.width, frame.height),
    )
    gl.uniform4f(u.u_uvRect!, 0, 0, 1, 1)
    gl.uniform1i(u.u_rotation!, 0)
    gl.uniform1f(u.u_opacity!, layer.transform.opacity)
    gl.uniform3f(u.u_color!, 0, 0, 0)
    gl.uniform4f(u.u_tint!, 0, 0, 0, 0)
    gl.uniform1f(u.u_reveal!, 2)
    gl.uniform1i(u.u_mode!, 1)
    gl.uniform4fv(u.u_solid!, parseColor(layer.color))
    gl.uniform1i(u.u_premultiplied!, 0)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }
}
