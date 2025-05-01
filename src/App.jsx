import { useEffect, useRef, useState } from 'react'
import { FilesetResolver, PoseLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';
import { Scene } from './scene';
import { Canvas } from "@react-three/fiber";


import './App.css'

function App() {
  
  const [init, setInit] = useState(false);
  const [fps, setFps]=useState(0);

  const refLastVideoTime = useRef(-1);
  const refPoseLandmarker = useRef(null);
  const refVideo=useRef();
  const refCanvas=useRef();

  const refSwords=useRef([]);

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
          outputSegmentationMasks: true,
        });
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
          processResults(detections);
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

  function drawMask(mask){
    const canvas = refCanvas.current;
    const ctx=canvas.getContext("2d");

    // const bitmap = mask.transferToImageBitmap();
    ctx.drawImage(mask, 0, 0, canvas.width, canvas.height);
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


    ctx.save();
    ctx.translate(hand.x*canvas.width, hand.y*canvas.height);
    ctx.rotate(hand_direction-Math.PI/2);
    ctx.drawImage(sword, 
                -sword.width*sword_scale/2, 
                -sword.height*sword_scale, 
                sword.width*sword_scale, sword.height*sword_scale);

    ctx.restore();


    // draw debug coordinates
    // ctx.save();
    //   ctx.fillStyle="red";
    //   ctx.fillText(`lefthand= (${left_hand.x.toFixed(2)}, ${left_hand.y.toFixed(2)})`, 0,100);
    //   ctx.fillText(`righthand= (${right_hand.x.toFixed(2)}, ${right_hand.y.toFixed(2)})`, 0,200);
    // ctx.restore();
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
    initDetection();

    // load swords
    const sword1=new Image();
    sword1.src="/image/sword-1.png";
    
    const sword2=new Image();
    sword2.src="/image/sword-2.png";

    refSwords.current.push(sword1);
    refSwords.current.push(sword2);

  },[]);

  return (
    <>
      <video ref={refVideo} id="_capture"></video>
      <canvas ref={refCanvas}></canvas>
      <label className='absolute top-0 left-0 z-10 text-red-500'>{fps}</label>   
      {/* <div className='fixed top-0 left-0 w-full h-1/2'> */}
      <Scene video={refVideo.current} canvas={refCanvas.current}/>
    </>
  )
}

export default App
