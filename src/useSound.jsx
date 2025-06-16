import { useEffect, useRef } from "react";
import { Howl } from "howler";

const NumSfx=5;
const FADE_TIME=5000; // 1 second

export function useSound(){
    // const [sound, setSound] = React.useState(null);
    const refBgm=useRef();
    const refGame=useRef();
    const refSword=useRef([]);


    
    useEffect(()=>{

        refBgm.current=new Howl({
            src: ['/sound/start.mp3'],
            autoplay: true,
            loop: true,
            volume: 0.5,
        });
        refBgm.current.play();

        refGame.current=new Howl({
            src: ['/sound/game.mp3'],
            autoplay: false,
            loop: false,
            volume: 0.5,
        });


        for(let i=0;i<NumSfx;i++){
            refSword.current[i]=new Howl({
                src: [`/sound/sword-${i+1}.mp3`],
                volume: 1.0,
            });
        }

        return ()=>{
            if(refBgm.current){
                refBgm.current.stop();
                refBgm.current.unload();
            }
            for(let i=0;i<NumSfx;i++){
                if(refSword.current[i]){
                    refSword.current[i].stop();
                    refSword.current[i].unload();
                }
            }
        };


    },[]);
    const fadeOut=()=>{
        if(refBgm.current){
            refBgm.current.fade(0.5, 0.0, FADE_TIME);         
        }
    }
    const fadeIn=()=>{
        if(refBgm.current){
            refBgm.current.fade(0.0, 0.5, FADE_TIME);         
        }
    }
    const playGameBgm=()=>{
        
        refBgm.current.stop();
        
        if(refGame.current){
            refGame.current.stop();
            refGame.current.seek(0); // reset to the beginning
            refGame.current.play();
            console.log('play game sound');
        }
    }
    const playStartBgm=()=>{

        refGame.current.stop();

        if(refBgm.current){
            refBgm.current.stop();
            refBgm.current.seek(0);
            refBgm.current.play();
            console.log('play start sound');
        }
    }
    const playSound = () => {
        
        const index=Math.floor(Math.random() * NumSfx);
        if(refSword.current[index]){
            refSword.current[index].stop();
            refSword.current[index].play();

            // console.log('play sound', index);
        }
    };
    
    return { playSound, fadeOut, fadeIn, playGameBgm, playStartBgm };
}