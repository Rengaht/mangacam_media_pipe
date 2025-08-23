import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { vertexShader, fragmentShader } from './shaders-2';

import { Leva, useControls } from 'leva';

const TintColors=[
    [0, 0, 0],
    [247, 39, 152],
    [245, 125, 31],
    [235, 244, 0]
];

const Cube = ({ video, canvas, mask, bg, state: sceneState, width, height, opacity, removeBg }) => {
    const mesh = useRef();

    const {scale, inkColor, thickness, range, angleStep, angle, rim, noiseScale, noiseAmplitude, linesNoiseScale, linesNoiseAmplitude, paperBg} = useControls({
        scale: { value: 20.0, min: 0.1, max: 50.0, step: 0.01 },
        inkColor: { value: [0.3, 0.3, 0.3], step: 0.01 },
        thickness: { value: 0.18, min: 0.001, max: 4.0, step: 0.001 },
        range: { value: [0.0, 0.6], min: 0.0, max: 1.0, step: 0.01 },
        angleStep: { value: 4.0, min: 0.01, max: 10.0, step: 0.01 },
        angle: { value: Math.PI/2.0, min: 0.0, max: 6.28, step: 0.01 },
        rim: { value: 0.9, min: 0.0, max: 1.0, step: 0.01 },
        noiseScale: { value: 0.2, min: 0.01, max: 3.0, step: 0.01 },
        noiseAmplitude: { value: 24.7, min: 0.01, max: 100.0, step: 0.01 },
        linesNoiseScale: { value:0.35, min: 0.01, max: 3.0, step: 0.01 },
        linesNoiseAmplitude: { value: 11.6, min: 0.01, max: 50.0, step: 0.01 }, 
        paperBg:{value: removeBg?1.0:0.0, min: 0.0, max: 1.0, step: 0.001 }
        
    });


    // const texture = useMemo(() => new THREE.CanvasTexture(canvas), [canvas]);
    const uniforms = useMemo(() => ({
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(width, height) },
        pixelSize: { value: 8 },
        u_canvas: { value: null },
        u_texture: { value: null },
        u_mask: { value: null },
        blendColor: { value: sceneState === 'outro' ? 0 : 1 },
        u_opacity: { value: opacity }, // Use opacity variable
        u_bg: { value: null },
        u_featherSize: { value: 10.0 },
        scale: { value: scale },
        inkColor: { value: new THREE.Color(`rgb(${inkColor[0]*255}, ${inkColor[1]*255}, ${inkColor[2]*255})`) },
        thickness: { value: thickness }, // Use thickness variable
        range: { value: new THREE.Vector2(range[0], range[1]) }, // Use range variable
        angleStep: { value: angleStep }, // Use angleStep variable
        angle: { value: angle }, // Use angle variable
        rim: { value: rim }, // Use rim variable
        noiseScale: { value: noiseScale }, // Use noiseScale variable
        noiseAmplitude: { value: noiseAmplitude }, // Use noiseAmplitude variable
        linesNoiseScale: { value: linesNoiseScale }, // Use linesNoiseScale variable
        linesNoiseAmplitude: { value: linesNoiseAmplitude }, // Use linesNoiseAmplitude variable
        drawBg: { value: paperBg },
    }), []);

  

    useFrame((state) => {

        const { clock } = state;
        mesh.current.material.uniforms.u_time.value = clock.getElapsedTime();

        // set uniforms
        if(video?.readyState>=2 && sceneState=='play' && mesh.current.material.uniforms.u_texture.value==null){
            mesh.current.material.uniforms.u_texture.value = new THREE.VideoTexture(video);
            // mesh.current.geomtry.args[0]=[video.videoWidth, video.videoHeight, 1, 1];
        }
        if(canvas!=null && mesh.current.material.uniforms.u_canvas.value==null){
            mesh.current.material.uniforms.u_canvas.value = new THREE.CanvasTexture(canvas);
        }
        if(mesh.current.material.uniforms.u_canvas.value!=null){
            mesh.current.material.uniforms.u_canvas.value.needsUpdate=true;
        }

        if(sceneState=='outro') mesh.current.material.uniforms.blendColor.value = 0.0;
        else mesh.current.material.uniforms.blendColor.value = 1.0;

        // if(opacity!=null) mesh.current.material.uniforms.u_opacity.value = opacity;

        if(mask!=null && mesh.current.material.uniforms.u_mask.value==null){
            const texture= new THREE.CanvasTexture(mask);
            mesh.current.material.uniforms.u_mask.value=texture;
        }
        if(mesh.current.material.uniforms.u_mask.value!=null){
            mesh.current.material.uniforms.u_mask.value.needsUpdate=true;
        }


        // update parameters
        mesh.current.material.uniforms.scale.value = scale;
        mesh.current.material.uniforms.inkColor.value = new THREE.Color(`rgb(${inkColor[0]*255}, ${inkColor[1]*255}, ${inkColor[2]*255})`);
        mesh.current.material.uniforms.thickness.value = thickness;
        mesh.current.material.uniforms.range.value = new THREE.Vector2(range[0], range[1]);
        mesh.current.material.uniforms.angleStep.value = angleStep;
        mesh.current.material.uniforms.angle.value = angle;
        mesh.current.material.uniforms.rim.value = rim;
        mesh.current.material.uniforms.noiseScale.value = noiseScale;
        mesh.current.material.uniforms.noiseAmplitude.value = noiseAmplitude;
        mesh.current.material.uniforms.linesNoiseScale.value = linesNoiseScale;
        mesh.current.material.uniforms.linesNoiseAmplitude.value = linesNoiseAmplitude;
        mesh.current.material.uniforms.drawBg.value = paperBg;


    });
    // useEffect(()=>{
    //     console.log('bg updated');
    //     if(bg!=null && mesh.current.material.uniforms.u_bg.value!=null){
    //         mesh.current.material.uniforms.u_bg.value.needsUpdate=true;
    //     }
    // },[bg]);

    useEffect(()=>{

    

        // set size to window

        // function onResize(){
            // mesh.current.scale.set(window.innerWidth, window.innerHeight, 1);
        //     mesh.current.scale.set(10,10);
        // }
        // window.addEventListener('resize', onResize);

        // onResize();
        // console.log(video?.width, video?.height);

        return () => {
            // window.removeEventListener('resize', onResize);
        }

    },[]);

    // if(!video) return;

    return (
        <mesh ref={mesh}>
            <planeGeometry args={[width,height,1,1]} />
            <shaderMaterial
                fragmentShader={fragmentShader}
                vertexShader={vertexShader}
                uniforms={uniforms}
            />
            {/* <meshPhongMaterial /> */}
        </mesh>
    );
};

const Scene = (props) => (
    <>
    <Leva  />
    <Canvas id="_canvas_three" orthographic camera={{zoom: 1, position: [0, 0, 100]}}>
        <Cube {...props} />        
    </Canvas>
    </>
);

export { Scene, Cube };