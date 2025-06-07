import { useEffect, useRef } from "react";
import { Howl } from "howler";

const NumSfx=5;

export function useSound(){
    // const [sound, setSound] = React.useState(null);
    const refBgm=useRef();
    const refSword=useRef([]);


    
    useEffect(()=>{

        refBgm.current=new Howl({
            src: ['/sound/bgm.mp3'],
            autoplay: true,
            loop: true,
            volume: 0.5,
        });
        refBgm.current.play();


        for(let i=0;i<NumSfx;i++){
            refSword.current[i]=new Howl({
                src: [`/sound/sword-${i+1}.mp3`],
                volume: 1.0,
            });
        }


    },[]);
    
    const playSound = () => {
        
        const index=Math.floor(Math.random() * NumSfx);
        if(refSword.current[index]){
            refSword.current[index].stop();
            refSword.current[index].play();
            
            console.log('play sound', index);
        }
    };
    
    return { playSound };
}