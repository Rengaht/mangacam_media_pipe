import { useEffect, useRef } from "react";
import { Scene } from "./scene";

export default function Test(){

    const refImage=useRef();
    const refCanvas=useRef();

    function drawNextScene(){
        const canvas = refCanvas.current;
        const ctx=canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    
        ctx.fillStyle="rgba(0,0,0,1.0)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const nextScene=refImage.current;
        let scale=Math.max(canvas.height/nextScene.height, canvas.width/nextScene.width);
        
        ctx.drawImage(nextScene, 
                      (canvas.width-nextScene.width*scale)/2,
                      (canvas.height-nextScene.height*scale)/2,
                      nextScene.width*scale,
                      nextScene.height*scale,                  
                      (canvas.width-nextScene.width*scale)/2,
                      (canvas.height-nextScene.height*scale)/2,
                      nextScene.width*scale,
                      nextScene.height*scale,                  
                    );

        requestAnimationFrame(()=>{
            drawNextScene();
        });
            
    }
    useEffect(()=>{
        drawNextScene();

    },[]);

    return (
        <div className="h-full aspect-[250/225] relative">
            <img ref={refImage} src="/image/next.png" className="hidden" width={1200} height={1080}/>
            <canvas ref={refCanvas} className="absolute top-0 left-0 w-full h-full hidden"/>
            <Scene width="1200" height="1080" canvas={refCanvas.current}
                opacity={1.0}
                state="outro"/>
        </div>
    );

}