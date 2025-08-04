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

vec4 smoothedMask(vec2 xy) {
    float featherRadius = u_featherSize / min(u_resolution.x, u_resolution.y);
    vec2 texel = vec2(1.0) / u_resolution;

    // Sample surrounding pixels
    float center = texture2D(u_mask, xy).r;
    float sum = 0.0;
    float total = 0.0;

    // simple 3x3 Gaussian blur approximation
    for(int x = -1; x <= 1; ++x) {
        for(int y = -1; y <= 1; ++y) {
            vec2 offset = vec2(float(x), float(y)) * texel * featherRadius;
            float weight = 1.0 - length(vec2(x, y)) / 1.414; // simple distance weight
            float samplee = texture2D(u_mask, xy + offset).r;
            sum += samplee * weight;
            total += weight;
        }
    }

    float feathered = sum / total;
    return vec4(feathered, feathered, feathered, 1.0);
}

vec4 getLayerColor(vec2 xy){

    vec4 color = texture2D(u_texture, xy);
    vec4 mask= smoothedMask(xy);
    
    if(mask.rgb==vec3(0.0, 1.0, 0.0)){
        color=vec4(0.)*mask.g + color*(1.0-mask.g);
    }

    vec4 canvas = texture2D(u_canvas, xy);
    

    vec4 destcolor;
    if(canvas.rgb==vec3(0.0, 1.0, 0.0)){
        destcolor=color*(1.0-canvas.a);        
    }else{
        destcolor=length(canvas)>0.0? canvas:color;
    }

    return destcolor;
}



// The MIT License
// Copyright © 2013 Inigo Quilez
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
// https://www.youtube.com/c/InigoQuilez
// https://iquilezles.org
vec2 grad( ivec2 z )  // replace this anything that returns a random vector
{
    // 2D to 1D  (feel free to replace by some other)
    int n = z.x+z.y*11111;

    // Hugo Elias hash (feel free to replace by another one)
    n = (n<<13)^n;
    n = (n*(n*n*15731+789221)+1376312589)>>16;

    // Perlin style vectors
    n &= 7;
    vec2 gr = vec2(n&1,n>>1)*2.0-1.0;
    return ( n>=6 ) ? vec2(0.0,gr.x) : 
           ( n>=4 ) ? vec2(gr.x,0.0) :
                              gr;                            
}
float valueAtPoint(sampler2D image, vec2 coord, vec2 texel, vec2 point) {
    vec3 luma = vec3(0.299, 0.587, 0.114);

    vec4 color=getLayerColor(coord + texel * point);
    return dot(color.xyz, luma);
}

float noise( in vec2 p ) {
    ivec2 i = ivec2(floor( p ));
     vec2 f =       fract( p );
	
	vec2 u = f*f*(3.0-2.0*f); // feel free to replace by a quintic smoothstep instead

    return mix( mix( dot( grad( i+ivec2(0,0) ), f-vec2(0.0,0.0) ), 
                     dot( grad( i+ivec2(1,0) ), f-vec2(1.0,0.0) ), u.x),
                mix( dot( grad( i+ivec2(0,1) ), f-vec2(0.0,1.0) ), 
                     dot( grad( i+ivec2(1,1) ), f-vec2(1.0,1.0) ), u.x), u.y);
}


float diffuseValue(int x, int y) {
    float cutoff = 40.0;
    float offset =  0.5 / cutoff;
    float noiseValue = clamp(texture(u_texture, vUv).r, 0.0, cutoff) / cutoff - offset;

    return valueAtPoint(u_texture, vUv + noiseValue, vec2(1.0 / u_resolution.x, 1.0 / u_resolution.y), vec2(x, y)) * 0.6;
    
}

float normalValue(int x, int y) {
    float cutoff = 50.0;
    float offset = 0.5 / cutoff;
    float noiseValue = clamp(texture(u_texture, vUv).r, 0.0, cutoff) / cutoff - offset;

    return valueAtPoint(u_texture, vUv + noiseValue, vec2(1.0 / u_resolution.x, 1.0 / u_resolution.y), vec2(x, y)) * 0.3;
}

float getValue(int x, int y) {
    float noiseValue = noise(gl_FragCoord.xy);
    noiseValue = noiseValue * 2.0 - 1.0;
    noiseValue *= 10.0;

    return diffuseValue(x, y) + normalValue(x, y) * noiseValue;
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

float lines(float l, vec2 fragCoord, vec2 resolution, float thickness, float e) {
  vec2 uv = fragCoord.xy * resolution;
  float c = (0.5 + 0.5 * sin(uv.x * 0.5));
  float f = (c + thickness) * l;
  return smoothstep(0.5 - e, 0.5 + e, f);
}


void main() {
  
    vec2 uv = vUv;
    if(blendColor==0.0){
        gl_FragColor =texture2D(u_canvas, uv);
        return;
    }

    float real_color=valueAtPoint(u_texture, uv, vec2(0.0), vec2(0, 0));
    float line= lines(real_color, gl_FragCoord.xy, u_resolution, 2., 0.01);
    gl_FragColor = vec4(line, line, line, 1.0);
    return;

    float sobelValue = combinedSobelValue();
    sobelValue = smoothstep(0.01, 0.03, sobelValue);
    

    vec4 lineColor = vec4(0., 0., 0., 1.0);

    if (sobelValue > 0.1) {
        gl_FragColor = lineColor;
    } else {
        gl_FragColor = vec4(1.0);
    }
    
    float mask = smoothedMask(uv).r;
    vec4 canvas = texture2D(u_canvas, uv);
    if(canvas.a>0.){
        gl_FragColor.a=u_opacity;
    }else{                
        gl_FragColor.a=(1.0-mask) * u_opacity;
    }
    
    
    // gl_FragColor = destcolor*u_opacity;
    
    
    // gl_FragColor=destcolor;

}

`;