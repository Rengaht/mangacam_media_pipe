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

uniform vec2 u_resolution;
uniform float pixelSize;
uniform float u_time;
uniform float blendColor;
uniform float u_opacity;


vec4 palette[10] = vec4[](
    vec4(0.0, 0.0, 0.0, 1.0),                     // Fallback / default
    vec4(183.0, 9.0, 76.0, 255.0)/255.0,          // #B7094C
    vec4(160.0, 26.0, 88.0, 255.0)/255.0,         // #A01A58
    vec4(137.0, 43.0, 100.0, 255.0)/255.0,        // #892B64
    vec4(114.0, 60.0, 112.0, 255.0)/255.0,        // #723C70
    vec4(92.0, 77.0, 125.0, 255.0)/255.0,         // #5C4D7D
    vec4(69.0, 94.0, 137.0, 255.0)/255.0,         // #455E89
    vec4(46.0, 111.0, 149.0, 255.0)/255.0,        // #2E6F95
    vec4(23.0, 128.0, 161.0, 255.0)/255.0,        // #1780A1
    vec4(0.0, 145.0, 173.0, 255.0)/255.0          // #0091AD
);

vec4 palette2[10] = vec4[](
    vec4(84.0, 71.0, 140.0, 255.0)/255.0,   // #54478C
    vec4(44.0, 105.0, 154.0, 255.0)/255.0,  // #2C699A
    vec4(4.0, 139.0, 168.0, 255.0)/255.0,   // #048BA8
    vec4(13.0, 179.0, 158.0, 255.0)/255.0,  // #0DB39E
    vec4(22.0, 219.0, 147.0, 255.0)/255.0,  // #16DB93
    vec4(131.0, 227.0, 119.0, 255.0)/255.0, // #83E377
    vec4(185.0, 231.0, 105.0, 255.0)/255.0, // #B9E769
    vec4(239.0, 234.0, 90.0, 255.0)/255.0,  // #EFEA5A
    vec4(241.0, 196.0, 83.0, 255.0)/255.0,  // #F1C453
    vec4(242.0, 158.0, 76.0, 255.0)/255.0   // #F29E4C
);

vec4 palette3[6] = vec4[](
    vec4(0.0, 0.0, 0.0, 1.0), // #000000
    vec4(247.0, 37.0, 133.0, 255.0)/255.0, // #F72585
    vec4(114.0, 9.0, 183.0, 255.0)/255.0,  // #7209B7
    vec4(58.0, 12.0, 163.0, 255.0)/255.0,  // #3A0CA3
    vec4(67.0, 97.0, 238.0, 255.0)/255.0,  // #4361EE
    vec4(76.0, 201.0, 240.0, 255.0)/255.0  // #4CC9F0
);



float rand(vec2 n) { 
	return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
}
float rand(float n){return fract(sin(n) * 43758.5453123);}

float noise(float p){
	float fl = floor(p);
  float fc = fract(p);
	return mix(rand(fl), rand(fl + 1.0), fc);
}


float noise(vec2 p){
	vec2 ip = floor(p);
	vec2 u = fract(p);
	u = u*u*(3.0-2.0*u);
	
	float res = mix(
		mix(rand(ip),rand(ip+vec2(1.0,0.0)),u.x),
		mix(rand(ip+vec2(0.0,1.0)),rand(ip+vec2(1.0,1.0)),u.x),u.y);
	return res*res;
}

vec4 refineColor(vec4 color){
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    // add contract
    gray = (gray - 0.5) * 2.0 + 0.5;

    // float edge=length(edge(blockUV));
    
    // vec3 output_color=color.rgb;
    
    // float discrete=1.0/4.0;
    // output_color=floor(output_color/discrete)*discrete;
    // // output_color=pow(output_color, vec3(2.0));
    // output_color=smoothstep(vec3(0.3), vec3(0.7),output_color);

    int level=int(floor(gray*6.0));
    return palette3[level]*blendColor+color*(1.0-blendColor);
}


void main() {
  
    vec2 uv = vUv;
    vec2 pixelUV = floor(uv * u_resolution / (pixelSize)) * (pixelSize) / u_resolution;
    float noise1=noise(pixelUV.x*1.2 + pixelUV.y * 80.2 + sin(u_time*20.5)*200.0);
    vec2 offset=vec2(0.0, smoothstep(0.95, 1.0,noise1))*20.0*pixelSize/u_resolution;


    pixelUV += offset;

    float threshold=0.05;
    if(blendColor==0.0){
        float portion=noise(vec2(pixelUV.x*1.33 + u_time*(noise1>0.9? 0.55:-0.65) ,pixelUV.y*29.2 + u_time*0.15));

        if(portion>threshold){
            // pixelUV=uv;
            gl_FragColor = texture2D(u_canvas, uv);
            return;
        }else{                   
            // gl_FragColor = texture2D(u_canvas, vec2(clamp(pixelUV.x+portion*(portion>0.8 ? -1.0 : 1.0)*25.0, 0.0, 1.0), pixelUV.y));
            gl_FragColor = texture2D(u_canvas, vec2(portion>0.8 ? 0.0 : 1.0, pixelUV.y));
            return;
        }        
    }
    
    
    float scale=1200.0/1440.0;
    vec4 color = texture2D(u_texture, vec2((pixelUV.x-0.5)*scale+0.5,pixelUV.y));

    // gl_FragColor = color;

    vec4 canvas = texture2D(u_canvas, pixelUV);
    vec4 destcolor;
    if(canvas.rgb==vec3(0.0, 1.0, 0.0)){
        destcolor=color*(1.0-canvas.a);        
    }else{
        destcolor=length(canvas)>0.0? canvas:color;
    }
    
    
    
    gl_FragColor = refineColor(destcolor)*u_opacity;
    // gl_FragColor=canvas;
    
    // gl_FragColor= vec4(mask.r, 1.0,0.0,1.0);

    // gl_FragColor = vec4(uv.x, uv.y,0.0,1.0);

}

`;