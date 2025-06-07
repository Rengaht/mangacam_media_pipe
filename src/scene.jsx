import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { vertexShader, fragmentShader } from './shaders';



const TintColors=[
    [0, 0, 0],
    [247, 39, 152],
    [245, 125, 31],
    [235, 244, 0]
];

const Cube = ({ video, canvas, mask }) => {
    const mesh = useRef();

    // const texture = useMemo(() => new THREE.CanvasTexture(canvas), [canvas]);
    const uniforms = useMemo(() => ({
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        pixelSize: { value: 8 },
        u_canvas: { value: null },
        u_texture: { value: null },
        u_mask: { value: null },
    }), []);

  

    useFrame((state) => {

        const { clock } = state;
        mesh.current.material.uniforms.u_time.value = clock.getElapsedTime();

        // set uniforms
        if(video?.readyState>=2 && mesh.current.material.uniforms.u_texture.value==null){
            mesh.current.material.uniforms.u_texture.value = new THREE.VideoTexture(video);
            // mesh.current.geomtry.args[0]=[video.videoWidth, video.videoHeight, 1, 1];
        }
        if(canvas!=null && mesh.current.material.uniforms.u_canvas.value==null){
            mesh.current.material.uniforms.u_canvas.value = new THREE.CanvasTexture(canvas);
        }
        if(mesh.current.material.uniforms.u_canvas.value!=null){
            mesh.current.material.uniforms.u_canvas.value.needsUpdate=true;
        }
        // if(mask!=null && mesh.current.material.uniforms.u_mask.value==null){
        //     const texture= new THREE.CanvasTexture(mask);
        //     // texture.onload=()=>{
        //     //     texture.needsUpdate=true;
        //     // }
        //     mesh.current.material.uniforms.u_mask.value=texture;
        // }
        // if(mesh.current.material.uniforms.u_mask.value!=null){
        //     mesh.current.material.uniforms.u_mask.value.needsUpdate=true;
        // }

        // mesh.current.material.uniforms.u_resolution.value = new THREE.Vector2([window.innerWidth, window.innerHeight]);
        // mesh.current.material.uniforms.u_texture.value.needsUpdate=true;
        // texture.needsUpdate=true;
        // console.log(video?.videoWidth, video?.videoHeight);

        const ratio=video?.videoWidth/video?.videoHeight;
        // if(!isNaN(ratio)) mesh.current.scale.set(1, ratio, 1);

    });

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
            <planeGeometry args={[1920,1080,1,1]} />
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
    <Canvas orthographic camera={{zoom: 1, position: [0, 0, 100]}}>
        <Cube {...props} />        
    </Canvas>
);

export { Scene, Cube };