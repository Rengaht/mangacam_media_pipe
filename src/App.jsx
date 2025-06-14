import { useEffect, useRef, useState } from 'react'
import { FilesetResolver, PoseLandmarker, DrawingUtils, ImageSegmenter } from '@mediapipe/tasks-vision';
import { Scene } from './scene';
import { useSound } from './useSound';
import gsap from 'gsap';
import { SlowMo } from "gsap/EasePack";

gsap.registerPlugin(SlowMo);



import './App.css'

const REMOVE_BG=false;
const DRAW_HAT=true;
const SOUND_THRESHOLD=0.02;

// const PLAY_TIME=2;
// const OUTRO_TIME=100;
// const INTRO_TIME=2;

const PLAY_TIME=15;
const OUTRO_TIME=8;
const INTRO_TIME=5;

const TEXT_FADE_TIME=2;
const INTRO_CHAR_TIME=4;
const SCENE_FADE_TIME=3;

const IMAGE_COUNT_LEFT=4;
const IMAGE_COUNT_RIGHT=4;

const RESOLUTION_WIDTH=1200;
const RESOLUTION_HEIGHT=1080;

// const SWORD_FILE_NAME='sword.png';

const STATE={
  INTRO: "intro",
  PLAY: "play",
  OUTRO: "outro",
}

function App() {
  
  const [init, setInit] = useState(false);
  const [detected, setDetected] = useState(false);
  const [state, setState] = useState(STATE.INTRO);
  
  
  const [fps, setFps]=useState(0);

  const refLastVideoTime = useRef(-1);
  const refPoseLandmarker = useRef(null);
  const refImageSegmenter = useRef(null);

  const refVideo=useRef();
  const refCanvas=useRef();
  const refOpacity=useRef({value: 1.0});

  const refSwords=useRef([]);
  const refHat=useRef();

  const refCharacterLeft=useRef([]);
  const refCharacterRight=useRef([]);
  const refRightIndex=useRef(0);
  const refLeftIndex=useRef(0);

  const refNextScene=useRef(null);
  const refState=useRef(STATE.INTRO);

  const refRightProgress=useRef({value: 0});
  const refLeftProgress=useRef({value: 0});
  const refNextSceneProgress=useRef({value: 0});
  const refReady=useRef(false);
  const refTransition=useRef(false);

  const refMask=useRef();

  const { playSound, fadeOut, fadeIn } = useSound();
  
  const refLastHand=useRef();



  async function startCamera() {
    
    try{
      const video = refVideo.current;
      
      const stream=await navigator.mediaDevices.getUserMedia({
        video: true,
        
      });
      
      video.srcObject = stream;
      video.play();
      console.log("Camera started", video.videoWidth, video.videoHeight);
      // refCanvas.current.width = video.videoWidth;
      // refCanvas.current.height = video.videoHeight;
      // refMask.current.width = video.videoWidth;
      // refMask.current.height = video.videoHeight;


    }catch(err){
      console.error("Error accessing camera: ", err);
    }
    
  }

  async function initMediaPipe() {
    const vision = await FilesetResolver.forVisionTasks(
      // path/to/wasm/root
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );
    refPoseLandmarker.current = await PoseLandmarker.createFromOptions(
        vision,
        {
          baseOptions: {
            modelAssetPath: "/model/pose_landmarker_lite.task",
            // modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
            delegate: "GPU",
          },
          runningMode: 'VIDEO',
          numPoses: 2,
          outputSegmentationMasks: false,
        });
    if(REMOVE_BG){
      refImageSegmenter.current = await ImageSegmenter.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "model/selfie_segmenter_landscape.tflite",
        },
        outputCategoryMask: false,
        outputConfidenceMasks: true,
        runningMode: "VIDEO"
      });

    }
  }
  function onImageSegment(result) {
    
    const video = refVideo.current;
    const context=refMask.current.getContext("2d");
    
    const { videoWidth, videoHeight } = video;
    const { width, height } = refMask.current;

    
    if (videoWidth !== width || videoHeight !== height) {

      console.log("videoWidth: ", videoWidth, "videoHeight: ", videoHeight);
      console.log("width: ", width, "height: ", height);
  
      refMask.current.width = videoWidth;
      refMask.current.height = videoHeight;
    }
    
    let imageData = context.getImageData(
      0,
      0,
      videoWidth,
      videoHeight
    ).data;
  
    
    const mask = result.confidenceMasks[0].getAsFloat32Array();
    
    let j = 0;
    for (let i = 0; i < mask.length; ++i) {
      const maskVal = Math.round(mask[i] * 255.0);
      imageData[j] = 0.0;
      imageData[j + 1] = 255-maskVal;
      imageData[j + 2] = 0.0;
      imageData[j + 3] = 255- maskVal;
      j += 4;
    }
    
    const uint8Array = new Uint8ClampedArray(imageData.buffer);
    const dataNew = new ImageData(
      uint8Array,
      videoWidth,
      videoHeight
    );
    
    context.putImageData(dataNew, 0, 0, 0, 0, width, height);

    
  
  }

  function fadeScene(dest, duration, delay=0.0, onComplete) {
    
    console.log("fadeScene: ", dest, duration, delay);

    if(dest==0){
      // fade text
      gsap.to("#_text", {
        opacity: 0,
        duration: TEXT_FADE_TIME,
        ease: "power4.inOut",
      });
    }

    refTransition.current=true;
    
    gsap.killTweensOf(refOpacity.current);
    gsap.to(refOpacity.current, {
      value: dest,
      duration: duration || SCENE_FADE_TIME,
      delay: delay + (dest==0? TEXT_FADE_TIME: 0),
      ease: "power4.inOut",
      onComplete:()=>{
        refTransition.current=false;
        if(onComplete) onComplete();
      }
    });
  }
  async function renderLoop() {

    const video = refVideo.current;
    // const video=document.getElementById("_capture");
    
    if (video?.currentTime !== refLastVideoTime.current) {

      const canvas = refCanvas.current;
      const ctx=canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      

      
        if(video.readyState >= 2){
          const detections = await refPoseLandmarker.current?.detectForVideo(video, video.currentTime*1000);
          
          switch(refState.current){
            case STATE.INTRO:
              if(refReady.current && detections.landmarks.length > 0 && !refTransition.current){
                fadeScene(0.0, SCENE_FADE_TIME/2, 0.0, ()=>{
                  setState(()=>STATE.PLAY);
                  setDetected(()=>true);                               
                });
              }else{
                drawCharacter();
                // setDetected(false);
              }
              break;
            case STATE.PLAY:
              processResults(detections);
              break;
            // default:
            case STATE.OUTRO:
              drawNextScene();
              break;
          }
          


          if(REMOVE_BG && refImageSegmenter.current){
            refImageSegmenter.current?.segmentForVideo(video, video.currentTime*1000, onImageSegment)
          }
        }
        

        setFps(Math.round(1/(video.currentTime-refLastVideoTime.current)));
        refLastVideoTime.current = video.currentTime;
        
      // }catch(err){
      //   console.error("Error during detection: ", err);
      // }
    }
    
    // if(!init) return;

    requestAnimationFrame(() => {
      renderLoop();
    });

  }
  function processResults(results) {
   

      if(results.landmarks){
        const landmarks = results.landmarks;
        // drawLandMarks(landmarks);
        drawSword(landmarks);
        if(DRAW_HAT){
          drawHat(landmarks);
        }
      }
    
      if(results.segmentationMasks && results.segmentationMasks.length > 0){
        // drawMask(results.segmentationMasks[0].canvas);
      }
  }

  function computeVelocity(vec){
    if(refLastHand.current){
      const lastHand=refLastHand.current;
      const delta={
        x: vec.x-lastHand.x,
        y: vec.y-lastHand.y
      };
      // console.log(delta);
      const dist=distance(delta, {x: 0, y: 0});
      // console.log("distance: ", dist);
      if(dist > SOUND_THRESHOLD){
        playSound();
      }
    }
    refLastHand.current=vec;
  }
  
  function distance(p1, p2){
    return Math.sqrt(Math.pow(p2.x-p1.x,2)+Math.pow(p2.y-p1.y,2));
  }
  function drawSword(landmarks){
    
    if(!landmarks || landmarks.length === 0) return;

    // choose one hand

    let arm_index=19;
    let hand_index=15;

    let left_hand=landmarks[0][15];
    let right_hand=landmarks[0][16];
    
    if(left_hand.visibility < 0.5 && right_hand.visibility < 0.5){
      // no hands detected
      return;
    }
    if(left_hand.visibility < 0.5){
      // only right hand detected
      arm_index=20;
      hand_index=16;
    }else if(right_hand.visibility < 0.5){
      // only left hand detected
      arm_index=19;
      hand_index=15;

    }else if(left_hand.y > right_hand.y){
      // choose the higher if both exist
      arm_index=20;
      hand_index=16;
    }

    const canvas = refCanvas.current;
    const ctx=canvas.getContext("2d");
      

    const hand=landmarks[0][hand_index];    
    if(hand.visibility > 0.5){
      const vec={
        x: hand.x-landmarks[0][arm_index].x,
        y: hand.y-landmarks[0][arm_index].y,
      };
      const hand_direction=Math.atan2(vec.y, vec.x);
      // const right_hand_direction=landmarks[0].landmarks[20]-right_hand;
      computeVelocity(vec);

      
      const sword=refSwords.current[0];

      // set length of sword to half of the distance between hands
      // const sword_length=distance(left_hand,right_hand)/2;
      const sword_scale=0.66*canvas.height/sword.height;

      // ctx.drawImage(refMask.current, 0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(hand.x*canvas.width, hand.y*canvas.height);
      ctx.rotate(hand_direction-Math.PI/2);
      ctx.drawImage(sword, 
                  -sword.width*sword_scale/2, 
                  -sword.height*sword_scale, 
                  sword.width*sword_scale,
                  sword.height*sword_scale);

      ctx.restore();
    }
  }
    
  function drawHat(landmarks){
    if(!landmarks || landmarks.length === 0) return;
  
    const canvas = refCanvas.current;
      const ctx=canvas.getContext("2d");
    

      const hat=refHat.current;
      
      
      const head_center=landmarks[0][0];
      if(!head_center || head_center.visibility < 0.5) return;


      const head_width=distance(landmarks[0][12], landmarks[0][11]);
      const head_height=Math.max(1.0/6.0, head_width*1.2);

      const hat_scale=head_height*canvas.height/hat.height;
      const hat_width=hat.width*hat_scale;
      const hat_height=hat.height*hat_scale;
      
      ctx.save();
      ctx.translate(head_center.x*canvas.width, head_center.y*canvas.height);
      // ctx.rotate(-Math.PI/2);
      ctx.drawImage(hat, 
                  -hat_width/2, 
                  -hat_height, 
                  hat_width, hat_height);
      ctx.restore();
    
  }
  function drawCharacter(){
    const canvas = refCanvas.current;
    const ctx=canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // draw green back
    
    ctx.fillStyle="rgba(0,255,0,1.0)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle="white";

    const characterLeft=refCharacterLeft.current[refLeftIndex.current];
    const characterRight=refCharacterRight.current[refRightIndex.current];

    const pl=refLeftProgress.current.value;
    const pr=refRightProgress.current.value;
    
    const scaleLeft=canvas.width/characterLeft.width *(pl);
    const scaleRight=canvas.width/characterRight.width *(pr);
    // console.log(refCharacterProgress.current.value);
    ctx.save();
      ctx.fillStyle=`rgba(255,255,255,${pl})`;
      ctx.drawImage(characterLeft, 
          canvas.width/2-characterLeft.width*scaleLeft/2, 
          // canvas.height/2-characterLeft.height*scaleLeft/2, 
          canvas.height-characterLeft.height*scaleLeft, 
          characterLeft.width*scaleLeft, characterLeft.height*scaleLeft);
      
      ctx.fillStyle=`rgba(255,255,255,${pr})`;
      ctx.drawImage(characterRight, 
          canvas.width/2-characterRight.width*scaleRight/2, 
          // canvas.height/2-characterRight.height*scaleRight/2, 
          canvas.height-characterRight.height*scaleRight, 
          characterRight.width*scaleRight, 
          characterRight.height*scaleRight);
    ctx.restore();
  }

  function drawNextScene(){
    const canvas = refCanvas.current;
    const ctx=canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle="rgba(0,0,0,1.0)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const nextScene=refNextScene.current;
    let scale=Math.max(canvas.height/nextScene.height, canvas.width/nextScene.width);
    const scalex=scale*Math.min(refNextSceneProgress.current.value*3, 1);

    const delayy=0.33;
    scale*=Math.max(0,(refNextSceneProgress.current.value-delayy)/(1-delayy));

    ctx.drawImage(nextScene, 
                  (canvas.width-nextScene.width*scalex)/2,
                  (canvas.height-nextScene.height*scale)/2,
                  nextScene.width*scalex,
                  nextScene.height*scale,                  
                  (canvas.width-nextScene.width*scalex)/2,
                  (canvas.height-nextScene.height*scale)/2,
                  nextScene.width*scalex,
                  nextScene.height*scale,                  
                );
  }

  function toggleText(index, delay){

    const text=document.getElementById('_text');
    text.src=`/image/text-${index}.png`;

    gsap.to("#_text",{
      opacity: 1,
      duration: TEXT_FADE_TIME,
      delay: delay || 0,
      ease: "power4.out",
    });
  }
  

  function drawLandMarks(landmarks) {
    const canvas = refCanvas.current;
    const ctx=canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawingUtils = new DrawingUtils(ctx);
    for (const landmark of landmarks){
      drawingUtils.drawLandmarks(landmark, {
        radius: (data) => DrawingUtils.lerp(data.from?.z, -0.15, 0.1, 5, 1)
      });
      drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS);
    }
  }
  function initDetection(){
    if(refPoseLandmarker.current){
      refPoseLandmarker.current?.close();
      setInit(false);
    }

    startCamera().then(()=>{


      initMediaPipe().then(()=>{
        console.log("MediaPipe initialized");
        setInit(true);
        
        // start render loop
        renderLoop();
        

      }).catch(err=>{
        console.error("Error initializing MediaPipe: ", err);
      });
    });
    

  }

  useEffect(()=>{

    console.log('state changed: ', state);
    refState.current=state;

    

    switch(state){
      case STATE.INTRO:
        setDetected(false);

        fadeIn();
        fadeScene(1.0, SCENE_FADE_TIME, 1.0,()=>{
          toggleText(1);
          
          setTimeout(()=>{
            refReady.current=true;              
          }, INTRO_TIME*1000);

        });
        
        break;
      case STATE.PLAY:
        fadeScene(1.0, SCENE_FADE_TIME, 0.0,()=>{
          toggleText(2);

          setTimeout(()=>{
            gsap.to('#_text', {
              opacity: 0,
              duration: TEXT_FADE_TIME,
              ease: "power4.inOut",
              onComplete:()=>{
                toggleText(3);
              }
            });
            
          }, TEXT_FADE_TIME*1000*2);

          setTimeout(()=>{
            
            fadeOut();

            fadeScene(0.0, SCENE_FADE_TIME, 0.0, ()=>{
              
              setState(()=>STATE.OUTRO);

            });
                      
          }, PLAY_TIME*1000);
        });
        break;
      case STATE.OUTRO:
        fadeScene(1.0, 0.2, 2.0,()=>{
          
          
          gsap.to(refNextSceneProgress.current, {
            value: 1.0,
            duration: 1.0,
            delay: 1,
            ease: "slow(0.3,0.7,false)",
            onComplete:()=>{

              toggleText(4, TEXT_FADE_TIME);


              setTimeout(()=>{
                gsap.to('#_text', {
                  opacity: 0,
                  duration: 0.5,
                  ease: "power4.inOut",
                }); 
                gsap.to(refNextSceneProgress.current, {
                  value: 0.0,
                  duration: 1.0,
                  ease: "slow(0.3,0.7,false)",
                  onComplete:()=>{
                  
                    fadeScene(0.0, 0.2, 0, ()=>{
                      setState(()=>STATE.INTRO);      
                      refReady.current=false; 
                    });
                  }
                });
                 
              }, OUTRO_TIME*1000);

            }
          })
        });

        break;
    }

    // toggleText();


  },[state]);

  // useEffect(()=>{
  //   toggleText(!detected);
  // },[detected]);

  useEffect(()=>{
    initDetection();

    // load swords
    const sword1=new Image();
    sword1.src="/image/sword-3.png";
    
    const sword2=new Image();
    sword2.src="/image/sword.png";

    refSwords.current.push(sword1);
    refSwords.current.push(sword2);

    const hat=new Image();
    hat.src="/image/hat.png";
    refHat.current=hat;

    for(var i=0;i<IMAGE_COUNT_LEFT;++i){
      const character=new Image();
      character.src=`/image/character/image-${i+1}.png`;
      refCharacterRight.current.push(character);
    }
    for(var i=IMAGE_COUNT_LEFT-1;i<IMAGE_COUNT_LEFT+IMAGE_COUNT_RIGHT;++i){
      const character=new Image();
      character.src=`/image/character/image-${i+1}.png`;
      refCharacterLeft.current.push(character);
    }

    refNextScene.current=new Image();
    refNextScene.current.src="/image/next.png";


    gsap.fromTo(refLeftProgress.current, {
      value: 0
    },{ 
      value: 1, 
      duration: INTRO_CHAR_TIME,
      repeat: -1,
      // ease:"power4.inOut",
      onRepeat: ()=>{
        refLeftIndex.current=(refLeftIndex.current+1)%refCharacterLeft.current.length;        
      }
    });
    gsap.fromTo(refRightProgress.current, {
      value: 0
    },{ 
      value: 1, 
      duration: INTRO_CHAR_TIME,
      delay: INTRO_CHAR_TIME/2,
      repeat: -1,
      // repeatDelay: due/500,
      // ease:"power4.out",
      onRepeat: ()=>{
        refRightIndex.current=(refRightIndex.current+1)%refCharacterRight.current.length;        
      }
    });
    

    return ()=>{
      clearInterval(p);
      if(refPoseLandmarker.current){
        refPoseLandmarker.current?.close();
      }

      
    }

  },[]);

  return (
    <div className={`h-full aspect-[250/225] relative`}>
      <video ref={refVideo} id="_capture" className='hidden'></video>
      <canvas id="_canvas" ref={refCanvas} className='hidden' width={RESOLUTION_WIDTH} height={RESOLUTION_HEIGHT}></canvas>
      <canvas id="_mask" ref={refMask} className='hidden' width={RESOLUTION_WIDTH} height={RESOLUTION_HEIGHT}></canvas>
      <label className='absolute top-0 left-0 z-10 text-red-500'>{fps}</label>   
      {/* <div className='fixed top-0 left-0 w-full h-1/2'> */}
      <Scene width={RESOLUTION_WIDTH} height={RESOLUTION_HEIGHT}
        video={refVideo.current} canvas={refCanvas.current} mask={refMask.current} 
        state={refState.current}
        opacity={refOpacity.current.value}/>

      {/* <img id="_end" src="/image/text-3.png" className='hidden absolute top-0 left-0 w-full h-full z-10 opacity-0 object-cover object-left'/>
      <img id="_cover" src="/image/text-1.png" className='absolute top-0 left-0 w-full h-full z-10 object-cover object-left'/> */}
      
      <img id="_text" src="/image/text-1.png" 
          className='absolute top-0 left-0 w-full h-full z-10 object-cover object-center'/>

    </div>
  )
}

export default App
