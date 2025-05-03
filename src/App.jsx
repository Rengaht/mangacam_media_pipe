import { useEffect, useRef, useState } from 'react'
import { FilesetResolver, PoseLandmarker, DrawingUtils, ImageSegmenter } from '@mediapipe/tasks-vision';
import { Scene } from './scene';


import './App.css'

const REMOVE_BG=false;

function App() {
  
  const [init, setInit] = useState(false);
  const [fps, setFps]=useState(0);

  const refLastVideoTime = useRef(-1);
  const refPoseLandmarker = useRef(null);
  const refImageSegmenter = useRef(null);

  const refVideo=useRef();
  const refCanvas=useRef();

  const refSwords=useRef([]);
  const refHat=useRef();

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
          processResults(detections);

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

    const hat=new Image();
    hat.src="/image/hat.png";
    refHat.current=hat;


  },[]);

  return (
    <>
      <video ref={refVideo} id="_capture"></video>
      <canvas id="_canvas" ref={refCanvas}></canvas>
      <canvas id="_mask" ref={refMask}></canvas>
      <label className='absolute top-0 left-0 z-10 text-red-500'>{fps}</label>   
      {/* <div className='fixed top-0 left-0 w-full h-1/2'> */}
      <Scene video={refVideo.current} canvas={refCanvas.current} mask={refMask.current}/>
    </>
  )
}

export default App
