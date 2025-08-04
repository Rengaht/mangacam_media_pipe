export const vertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  vec4 modelPosition = modelMatrix * vec4(position, 1.0);
  vec4 viewPosition = viewMatrix * modelPosition;
  vec4 projectedPosition = projectionMatrix * viewPosition;

  gl_Position = projectedPosition;
}

`;

export const fragmentShader = `


varying vec2 vUv;

uniform sampler2D u_texture;
uniform sampler2D u_canvas;
uniform sampler2D u_mask;
uniform sampler2D u_bg;

uniform vec2 u_resolution;
uniform float pixelSize;
uniform float u_time;
uniform float blendColor;
uniform float u_opacity;
uniform float u_featherSize;


#define s2(a, b)				temp = a; a = min(a, b); b = max(temp, b);
#define mn3(a, b, c)			s2(a, b); s2(a, c);
#define mx3(a, b, c)			s2(b, c); s2(a, c);

#define mnmx3(a, b, c)			mx3(a, b, c); s2(a, b);                                   // 3 exchanges
#define mnmx4(a, b, c, d)		s2(a, b); s2(c, d); s2(a, c); s2(b, d);                   // 4 exchanges
#define mnmx5(a, b, c, d, e)	s2(a, b); s2(c, d); mn3(a, c, e); mx3(b, d, e);           // 6 exchanges
#define mnmx6(a, b, c, d, e, f) s2(a, d); s2(b, e); s2(c, f); mn3(a, b, c); mx3(d, e, f); // 7 exchanges


mat3 sx = mat3( 
    1.0, 2.0, 1.0, 
    0.0, 0.0, 0.0, 
   -1.0, -2.0, -1.0 
);

mat3 sy = mat3( 
    1.0, 0.0, -1.0, 
    2.0, 0.0, -2.0, 
    1.0, 0.0, -1.0 
);

vec3 rgb2hsv(vec3 c)
{
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c)
{
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

vec3 toon(vec2 uv) {
	vec4 texel = texture(u_texture, uv);
    vec3 c = texel.rgb;
    vec3 f = vec3(3.,5.,6.);
    c = rgb2hsv(c);
    c = floor(c * f) / f;
    return c;
}
vec3 median(vec2 uv, vec2 tsize) {

  vec3 v[9];
  mat3 I; 

  for(int dX = -1; dX <= 1; ++dX) {
      for(int dY = -1; dY <= 1; ++dY) {
      	vec2 offset = vec2(float(dX), float(dY));
		vec3 c = toon(uv.xy + offset * tsize);
      	v[(dX + 1) * 3 + (dY + 1)] = c;
        I[dX + 1][dY + 1] = c.x * c.y * c.z;
        
    }
  }

  vec3 temp;
	vec3 orig = v[4];
  // Starting with a subset of size 6, remove the min and max each time
  mnmx6(v[0], v[1], v[2], v[3], v[4], v[5]);
  mnmx5(v[1], v[2], v[3], v[4], v[6]);
  mnmx4(v[2], v[3], v[4], v[7]);
  mnmx3(v[3], v[4], v[8]);
    
  float gx = dot(sx[0], I[0]) + dot(sx[1], I[1]) + dot(sx[2], I[2]); 
  float gy = dot(sy[0], I[0]) + dot(sy[1], I[1]) + dot(sy[2], I[2]);

  float g = sqrt(pow(gx, 2.0)+pow(gy, 2.0));
  vec3 tooned=mix(v[4], orig, g) - g;

  return hsv2rgb(tooned);
}
vec4 blur13(sampler2D image, vec2 uv, vec2 resolution, vec2 direction) {
  vec4 color = vec4(0.0);
  vec2 off1 = vec2(1.411764705882353) * direction;
  vec2 off2 = vec2(3.2941176470588234) * direction;
  vec2 off3 = vec2(5.176470588235294) * direction;
  color += texture2D(image, uv) * 0.1964825501511404;
  color += texture2D(image, uv + (off1 / resolution)) * 0.2969069646728344;
  color += texture2D(image, uv - (off1 / resolution)) * 0.2969069646728344;
  color += texture2D(image, uv + (off2 / resolution)) * 0.09447039785044732;
  color += texture2D(image, uv - (off2 / resolution)) * 0.09447039785044732;
  color += texture2D(image, uv + (off3 / resolution)) * 0.010381362401148057;
  color += texture2D(image, uv - (off3 / resolution)) * 0.010381362401148057;
  return color;
}

vec4 smoothedMask(vec2 xy) {

    return blur13(u_mask, xy, u_resolution.xy, vec2(5.0, 0.0));

    // float featherRadius = u_featherSize / min(u_resolution.x, u_resolution.y);
    // vec2 texel = vec2(1.0) / u_resolution;

    // // Sample surrounding pixels
    // float center = texture2D(u_mask, xy).r;
    // float sum = 0.0;
    // float total = 0.0;

    // // simple 3x3 Gaussian blur approximation
    // for(int x = -1; x <= 1; ++x) {
    //     for(int y = -1; y <= 1; ++y) {
    //         vec2 offset = vec2(float(x), float(y)) * texel * featherRadius;
    //         float weight = 1.0 - length(vec2(x, y)) / 1.414; // simple distance weight
    //         float samplee = texture2D(u_mask, xy + offset).r;
    //         sum += samplee * weight;
    //         total += weight;
    //     }
    // }

    // float feathered = sum / total;
    // return vec4(feathered, feathered, feathered, 1.0);
}

vec4 getLayerColor(vec2 xy){

    // vec4 color = texture2D(u_texture, xy);
    vec4 color = vec4(median(xy, 1.2 / u_resolution.xy), 1.0);
    vec4 mask= smoothedMask(xy);
    
    color=vec4(0.)*(1.0-mask.a) + color*(mask.a);
    
    vec4 canvas = texture2D(u_canvas, xy);
    

    vec4 destcolor;
    // if(canvas.rgb==vec3(0.0, 0.0, 0.0)){
    //     destcolor=color*(1.0-canvas.a);        
    // }else{
        destcolor=length(canvas)>0.0? canvas:color;
    // }

    return destcolor;
}



float scale=2.35;
vec3 inkColor=vec3(0.3);
float thickness=0.95;
vec2 range=vec2(0.17,1.0);
float angleStep=4.;
float angle=0.;
float rim=0.9;
float noiseScale=0.3;
float noiseAmplitude=0.2;
float linesNoiseScale=12.;
float linesNoiseAmplitude=0.5;

#define TAU 6.28318530718
#define PI 3.141592653589793




vec2 hash(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)),
           dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float noise(vec2 p) {
  const float K1 = 0.366025404;
  const float K2 = 0.211324865;
  vec2 i = floor(p + (p.x + p.y) * K1);
  vec2 a = p - i + (i.x + i.y) * K2;
  vec2 o = (a.x > a.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec2 b = a - o + K2;
  vec2 c = a - 1.0 + 2.0 * K2;

  vec3 h = max(0.5 - vec3(dot(a,a), dot(b,b), dot(c,c)), 0.0);
  vec3 n = h * h * h * h * vec3(dot(a, hash(i + 0.0)),
                                dot(b, hash(i + o)),
                                dot(c, hash(i + 1.0)));
  return dot(n, vec3(70.0));
}

float luma(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}

float lines(float l, vec2 fragCoord, vec2 resolution, float thickness, float e) {
  vec2 uv = fragCoord.xy * resolution;
  float c = (0.5 + 0.5 * sin(uv.x * 0.5));
  float f = (c + thickness) * l;
  return smoothstep(0.5 - e, 0.5 + e, f);
}

float blendDarken(float base, float blend) {
    return min(blend,base);
}

vec3 blendDarken(vec3 base, vec3 blend) {
    return vec3(blendDarken(base.r,blend.r),blendDarken(base.g,blend.g),blendDarken(base.b,blend.b));
}

vec3 blendDarken(vec3 base, vec3 blend, float opacity) {
    return (blendDarken(base, blend) * opacity + base * (1.0 - opacity));
}

float getValue(int x, int y) {
    
    vec3 luma = vec3(0.299, 0.587, 0.114);
    vec4 color=getLayerColor(vUv + vec2(x, y) * vec2(1.0 / u_resolution.x, 1.0 / u_resolution.y));

    return dot(color.xyz, luma);
}

float combinedSobelValue() {
    // kernel definition (in glsl matrices are filled in column-major order)
    const mat3 Gx = mat3(-1, -2, -1, 0, 0, 0, 1, 2, 1);// x direction kernel
    const mat3 Gy = mat3(-1, 0, 1, -2, 0, 2, -1, 0, 1);// y direction kernel

    // fetch the 3x3 neighbourhood of a fragment

    // first column
    float tx0y0 = getValue(-1, -1);
    float tx0y1 = getValue(-1, 0);
    float tx0y2 = getValue(-1, 1);

    // second column
    float tx1y0 = getValue(0, -1);
    float tx1y1 = getValue(0, 0);
    float tx1y2 = getValue(0, 1);

    // third column
    float tx2y0 = getValue(1, -1);
    float tx2y1 = getValue(1, 0);
    float tx2y2 = getValue(1, 1);

    // gradient value in x direction
    float valueGx = Gx[0][0] * tx0y0 + Gx[1][0] * tx1y0 + Gx[2][0] * tx2y0 +
    Gx[0][1] * tx0y1 + Gx[1][1] * tx1y1 + Gx[2][1] * tx2y1 +
    Gx[0][2] * tx0y2 + Gx[1][2] * tx1y2 + Gx[2][2] * tx2y2;

    // gradient value in y direction
    float valueGy = Gy[0][0] * tx0y0 + Gy[1][0] * tx1y0 + Gy[2][0] * tx2y0 +
    Gy[0][1] * tx0y1 + Gy[1][1] * tx1y1 + Gy[2][1] * tx2y1 +
    Gy[0][2] * tx0y2 + Gy[1][2] * tx1y2 + Gy[2][2] * tx2y2;

    // magnitude of the total gradient
    float G = (valueGx * valueGx) + (valueGy * valueGy);
    return clamp(G, 0.0, 1.0);
}


void main() {

    vec2 uv=vUv;
    if(blendColor==0.0){
        gl_FragColor =texture2D(u_canvas, uv);
        return;
    }
//   gl_FragColor=getLayerColor(uv);
    // gl_FragColor=vec4(vec3(1.0-smoothedMask(uv).r), 1.0);
    // gl_FragColor=texture2D(u_mask, uv);
    // return ;

    vec4 paper=getLayerColor(vUv);

  float l = luma(paper.rgb);
  l = range.x + l * (range.y - range.x);

  float a = angle;
  float r = smoothstep(0.2, 0.8, l); // no camera-based rim lighting since there's no normal

  float de = 0.001 * length(vec2(dFdx(gl_FragCoord.x), dFdy(gl_FragCoord.y)));
  float e = 0.1 * de;

  vec2 coords = scale * 100.0 * (uv.xy / (de * 500.0));
  coords += linesNoiseAmplitude * noise(linesNoiseScale * uv.xy-u_time*0.15);

  float border = 1.0-combinedSobelValue();
  l *= border;

  a *= 1.-r;
  a += PI / 2.0;

  mat2 rot = mat2(cos(a), -sin(a), sin(a), cos(a));
  coords = rot * coords;

    float line = lines(l, coords, vec2(5.0), thickness + noiseAmplitude * noise(noiseScale * coords.xy+u_time*0.05), e);
     if (line < 0.1) {
        gl_FragColor = vec4(inkColor * line, 1.0);
    } else {
        // gl_FragColor = vec4(vec3(smoothstep(0.1, 0.35, l)),1.0);
        gl_FragColor=vec4(1.0);
    }

    
    
    float mask = smoothedMask(uv).a;
    vec4 canvas = texture2D(u_canvas, uv);
    if(canvas.a>0.){
        gl_FragColor.a=u_opacity;
    }else{                
        gl_FragColor.a=(mask) * u_opacity;
        
    }

    if (gl_FragColor.r != gl_FragColor.g || gl_FragColor.r != gl_FragColor.b) {
        gl_FragColor = vec4(vec3(0.0), gl_FragColor.a);
    }
  
}

`