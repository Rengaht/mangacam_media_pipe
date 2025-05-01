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

uniform vec2 u_resolution;
uniform float pixelSize;
uniform float u_time;

vec4 refineColor(vec4 color){
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    // add contract
    gray = (gray - 0.5) * 2.0 + 0.5;

    // float edge=length(edge(blockUV));
    
    vec3 output_color=color.rgb;
    
    float discrete=1.0/4.0;
    output_color=floor(output_color/discrete)*discrete;
    // output_color=pow(output_color, vec3(2.0));
    output_color=smoothstep(vec3(0.3), vec3(0.7),output_color);

    return vec4(output_color, 1.0);
}

void main() {
  
    vec2 uv = vUv;
    vec2 pixelUV = floor(uv * u_resolution / (pixelSize)) * (pixelSize) / u_resolution;
    
    vec4 color = texture2D(u_texture, pixelUV);
    vec4 canvas = texture2D(u_canvas, pixelUV);

    vec4 destcolor=length(canvas)>0.0? canvas:color;
    
    

    gl_FragColor = refineColor(destcolor);

    // gl_FragColor = vec4(uv.x, uv.y,0.0,1.0);

}

`;