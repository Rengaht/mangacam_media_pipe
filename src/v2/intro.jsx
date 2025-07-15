import { useEffect, useRef, useState } from "react"
import gsap from "gsap";

const INTERVAL_CHAR=2.5;
const COUNT_CHAR=6;

export function Intro(){

    const [index, setIndex]=useState(0);
    const refVal=useRef({value:0});

    useEffect(()=>{

        gsap.fromTo('#intro_charactor', {scale:1},{
            scale:2,
            duration: INTERVAL_CHAR,
            repeat:-1,
            onRepeat:()=>{
                setIndex((prevIndex)=>{
                    if(prevIndex===undefined){
                        return 0;
                    }
                    return (prevIndex+1)%COUNT_CHAR;
                });
            },
            ease:'linear'
        })


    },[]);

    return (
        <div className="absolute top-0 left-0 w-full h-full *:w-full *:h-full *:absolute"> 
            <img id="intro_bg" src={`image/character/bg-${index+1}.jpg`}></img>
            <img id="intro_charactor" src={`image/character/image-${index+1}.png`}></img>
        </div>
    )
}