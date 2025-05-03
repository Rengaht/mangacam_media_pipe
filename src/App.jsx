import { useEffect, useRef, useState } from 'react'
import { FilesetResolver, PoseLandmarker, DrawingUtils, ImageSegmenter } from '@mediapipe/tasks-vision';
import { Scene } from './scene';
import gsap from 'gsap';

import './App.css'

const REMOVE_BG=false;

function App() {
  
  const [init, setInit] = useState(false);
  const [detected, setDetected] = useState(false);
  
  const [fps, setFps]=useState(0);

  const refLastVideoTime = useRef(-1);
  const refPoseLandmarker = useRef(null);
  const refImageSegmenter = useRef(null);

  const refVideo=useRef();
  const refCanvas=useRef();

  const refSwords=useRef([]);
  const refHat=useRef();

  const refCharacterLeft=useRef([]);
  const refCharacterRight=useRef([]);
  const refRightIndex=useRef(0);
  const refLeftIndex=useRef(0);

  const refRightProgress=useRef({value: 0});
  const refLeftProgress=useRef({value: 0});

  const refMask=useRef();

  async function startCamera() {
    
    try{
      const video = refVideo.current;
      
      const stream=await navigator.mediaDevices.getUserMedia({
        video: true,
        
      });
      
      video.srcObject = stream;
      video.play();

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
  async function renderLoop() {

    const video = refVideo.current;
    // const video=document.getElementById("_capture");
    
    if (video.currentTime !== refLastVideoTime.current) {

      const canvas = refCanvas.current;
      const ctx=canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    
      
      // try{
        if(video.readyState >= 2){
          const detections = await refPoseLandmarker.current?.detectForVideo(video, video.currentTime*1000);
          
          // no people detected
          if(detections.landmarks.length === 0){
            drawCharacter();
            // toggleText(true);
            setDetected(false);

          }else{
            processResults(detections);
            // toggleText(false);
            setDetected(true);
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
        // console.log("Landmarks: ", landmarks);
        // Process landmarks here
      }
    
      if(results.segmentationMasks && results.segmentationMasks.length > 0){
        // drawMask(results.segmentationMasks[0].canvas);
      }
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
    
    if(left_hand.y > right_hand.y){
      arm_index=20;
      hand_index=16;
    }

    const hand=landmarks[0][hand_index];    
    const hand_direction=Math.atan2(hand.y-landmarks[0][arm_index].y, hand.x-landmarks[0][arm_index].x);
    // const right_hand_direction=landmarks[0].landmarks[20]-right_hand;

    const canvas = refCanvas.current;
    const ctx=canvas.getContext("2d");
    
    const sword=refSwords.current[0];

    // set length of sword to half of the distance between hands
    // const sword_length=distance(left_hand,right_hand)/2;
    const sword_scale=0.66*canvas.height/sword.height;

    ctx.drawImage(refMask.current, 0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(hand.x*canvas.width, hand.y*canvas.height);
    ctx.rotate(hand_direction-Math.PI/2);
    ctx.drawImage(sword, 
                -sword.width*sword_scale/2, 
                -sword.height*sword_scale, 
                sword.width*sword_scale, sword.height*sword_scale);

    ctx.restore();


    // draw hat
    const hat=refHat.current;
    
    const head_center=landmarks[0][0];
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
          canvas.height/2-characterLeft.height*scaleLeft/2, 
          characterLeft.width*scaleLeft, characterLeft.height*scaleLeft);
      
      ctx.fillStyle=`rgba(255,255,255,${pr})`;
      ctx.drawImage(characterRight, 
          canvas.width/2-characterRight.width*scaleRight/2, 
          canvas.height/2-characterRight.height*scaleRight/2, 
          characterRight.width*scaleRight, 
          characterRight.height*scaleRight);
    ctx.restore();
  }

  function toggleText(cover){

    if(cover){
      gsap.to("#_end",{
          
          opacity: 0,
          duration: 0.25,
          ease: "power4.out",
          onComplete:()=>{
            gsap.to("#_cover",{
              opacity: 1,
              duration: 0.25,
              delay: 0.25,
              ease: "power4.out",
            });
          }
      })
    }else{
      gsap.to("#_cover",{
          opacity: 0,
          duration: 0.25,
          ease: "power4.out",
          onComplete:()=>{
            gsap.to("#_end",{
              opacity: 1,
              duration: 0.5,
              delay: 2.0,
              ease: "power4.out",
            });
          }
      })
    }
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
    toggleText(!detected);
  },[detected]);

  useEffect(()=>{
    initDetection();

    // load swords
    const sword1=new Image();
    sword1.src="/image/sword-1.png";
    
    const sword2=new Image();
    sword2.src="/image/sword-2.png";

    refSwords.current.push(sword1);
    refSwords.current.push(sword2);

    const hat=new Image();
    hat.src="/image/hat.png";
    refHat.current=hat;

    for(var i=0;i<2;++i){
      const character=new Image();
      character.src=`/image/character/image-${i+1}.png`;
      refCharacterRight.current.push(character);
    }
    for(var i=2;i<5;++i){
      const character=new Image();
      character.src=`/image/character/image-${i+1}.png`;
      refCharacterLeft.current.push(character);
    }

    const due=1500;
    gsap.fromTo(refLeftProgress.current, {
      value: 0
    },{ 
      value: 1, 
      duration: due/1000,
      repeat: -1,
      ease:"power4.inOut",
      onRepeat: ()=>{
        refLeftIndex.current=(refLeftIndex.current+1)%refCharacterLeft.current.length;        
      }
    });
    gsap.fromTo(refRightProgress.current, {
      value: 0
    },{ 
      value: 1, 
      duration: due/1000,
      delay: due/2/1000,
      repeat: -1,
      ease:"power4.out",
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
    <>
      <video ref={refVideo} id="_capture"></video>
      <canvas id="_canvas" ref={refCanvas}></canvas>
      <canvas id="_mask" ref={refMask}></canvas>
      <label className='absolute top-0 left-0 z-10 text-red-500'>{fps}</label>   
      {/* <div className='fixed top-0 left-0 w-full h-1/2'> */}
      <Scene video={refVideo.current} canvas={refCanvas.current} mask={refMask.current}/>

      <img id="_end" src="/image/end.png" className='absolute top-0 left-0 w-full h-full z-10 opacity-0'/>
      <img id="_cover" src="/image/cover.png" className='absolute top-0 left-0 w-full h-full z-10'/>

    </>
  )
}

export default App
